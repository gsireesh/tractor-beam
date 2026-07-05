// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { DrawerContext, type DrawerContextValue } from '@/contexts/DrawerContext.tsx';
import { ModelControls, type ModelControlsProps } from './ModelControls';
import type { MlAnnotationRun, Schema } from '@/lib/definitions.ts';

// Replace the storage seam with a spy so no IndexedDB is touched — the repo's own
// delegation is covered in repositories.test.ts; here we drive the UI.
const { findByMock, snapshotMock, listVersionsMock } = vi.hoisted(() => ({
  findByMock: vi.fn(),
  snapshotMock: vi.fn(),
  listVersionsMock: vi.fn(),
}));
vi.mock('@/storage/repositories.ts', () => ({
  mlAnnotationRunRepo: { findBy: findByMock },
  schemaRepo: { snapshot: snapshotMock, listVersions: listVersionsMock },
}));

// Config loading reaches chrome.storage, absent in jsdom. Stub it to a resolved
// null — the model-picker block is gated on a non-null config, so the history
// dropdown (what we're testing) renders regardless.
vi.mock('@/lib/config-storage.ts', () => ({
  loadModelConfig: vi.fn().mockResolvedValue(null),
  saveModelConfig: vi.fn(),
  // ModelControls subscribes on mount; return a no-op unsubscribe.
  subscribeModelConfig: vi.fn(() => () => {}),
}));

// Readiness gating is orthogonal to the history/run-dispatch behavior under test
// here, and its live probe reaches chrome.runtime (absent in jsdom). Force `ready`
// so the run button is enabled; readiness itself is covered by readiness.test.ts.
vi.mock('@/components/model-configuration/ModelReadiness.tsx', () => ({
  useModelReadiness: () => ({ state: 'ready' }),
  ModelReadinessIndicator: () => null,
}));

const activeSchema: Schema = { id: 'schema-1', name: 'Invoices', classes: [] };
const pdfUrl = 'https://example.com/doc.pdf';

function run(overrides: Partial<MlAnnotationRun>): MlAnnotationRun {
  return {
    id: 'run-x',
    pdfUrl,
    schemaId: activeSchema.id,
    annotations: [],
    createdAt: 0,
    ...overrides,
  };
}

const ctx: DrawerContextValue = {
  activeSchema,
  pdfUrl,
  dispatch: () => {},
  removeMlHighlight: () => {},
};

// The load + run actions flow through the window bridge; spy on them.
const loadCachedAnnotations = vi.fn();
const runAnnotationPipeline = vi.fn();

function renderControls(overrides: Partial<ModelControlsProps> = {}) {
  return render(
    <DrawerContext.Provider value={ctx}>
      <ModelControls
        status="unloaded"
        progress={0}
        message=""
        setMlHighlights={() => {}}
        onRunStart={() => {}}
        failures={[]}
        {...overrides}
      />
    </DrawerContext.Provider>,
  );
}

describe('ModelControls — ML run history', () => {
  beforeEach(() => {
    findByMock.mockReset();
    loadCachedAnnotations.mockReset();
    runAnnotationPipeline.mockReset();
    snapshotMock.mockReset().mockResolvedValue(undefined);
    listVersionsMock.mockReset().mockResolvedValue([]);
    window.TractorBeamDrawer = {
      loadCachedAnnotations,
      runAnnotationPipeline,
    } as unknown as typeof window.TractorBeamDrawer;
  });

  it('lists prior runs newest-first when the history menu opens', async () => {
    const user = userEvent.setup();
    // Supplied oldest-first (and with distinguishable counts) to prove the
    // component re-sorts to newest-first.
    findByMock.mockResolvedValue([
      run({ id: 'older', createdAt: 1_700_000_000_000, annotations: makeAnns(1) }),
      run({ id: 'newer', createdAt: 1_700_100_000_000, annotations: makeAnns(2) }),
    ]);

    renderControls();
    await user.click(screen.getByTitle('Prior AI runs'));

    // Wait for the async fetch to resolve into rendered items.
    const items = await screen.findAllByRole('menuitem');
    expect(items).toHaveLength(2);
    // Newest first: the 2-highlight run precedes the 1-highlight run.
    expect(within(items[0]).getByText('2 highlights')).toBeInTheDocument();
    expect(within(items[1]).getByText('1 highlight')).toBeInTheDocument();
  });

  it('loads the chosen run by its id through the window bridge', async () => {
    const user = userEvent.setup();
    findByMock.mockResolvedValue([
      run({ id: 'older', createdAt: 1_700_000_000_000, annotations: makeAnns(1) }),
      run({ id: 'newer', createdAt: 1_700_100_000_000, annotations: makeAnns(2) }),
    ]);

    renderControls();
    await user.click(screen.getByTitle('Prior AI runs'));

    const items = await screen.findAllByRole('menuitem');
    await user.click(within(items[1]).getByText('1 highlight')); // the older run

    expect(loadCachedAnnotations).toHaveBeenCalledWith(activeSchema.id, pdfUrl, 'older');
  });

  it('shows an empty state when there are no prior runs', async () => {
    const user = userEvent.setup();
    findByMock.mockResolvedValue([]);

    renderControls();
    await user.click(screen.getByTitle('Prior AI runs'));

    expect(await screen.findByText('No prior AI runs')).toBeInTheDocument();
  });

  it('snapshots the schema on run start and references it by snapshotIndex', async () => {
    const user = userEvent.setup();
    snapshotMock.mockResolvedValue(42); // the new snapshot's index
    renderControls();

    await user.click(screen.getByRole('button', { name: /highlight with ai/i }));

    // Creates the mlRun snapshot, then kicks off the pipeline referencing it by
    // the returned snapshotIndex (label is derived from the snapshot, not passed).
    // Whole-document run: scope arg is undefined, snapshotIndex is 4th.
    expect(snapshotMock).toHaveBeenCalledWith(activeSchema, 'mlRun');
    await waitFor(() =>
      expect(runAnnotationPipeline).toHaveBeenCalledWith(
        activeSchema,
        expect.any(String),
        undefined,
        42,
      ),
    );
  });

  it("expands a run's config without loading the run (stopPropagation inside the menu)", async () => {
    const user = userEvent.setup();
    findByMock.mockResolvedValue([
      run({
        id: 'r1',
        createdAt: 1_700_100_000_000,
        annotations: makeAnns(3),
        model: {
          provider: 'anthropic',
          model: 'claude-opus-4-8',
          baseUrl: 'https://proxy.example.com',
          params: { maxTokens: 2048 },
        },
      }),
    ]);

    renderControls();
    await user.click(screen.getByTitle('Prior AI runs'));

    // The model line shows; config is collapsed.
    expect(await screen.findByText(/Model:\s*claude-opus-4-8/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /config/i }));

    // Config revealed, and crucially the run was NOT loaded by that click.
    expect(screen.getByText('https://proxy.example.com')).toBeInTheDocument();
    expect(loadCachedAnnotations).not.toHaveBeenCalled();
  });
});

describe('ModelControls — run status', () => {
  beforeEach(() => {
    window.TractorBeamDrawer = {
      loadCachedAnnotations: vi.fn(),
      runAnnotationPipeline: vi.fn(),
    } as unknown as typeof window.TractorBeamDrawer;
  });

  it('shows a Stop control and progress while running', () => {
    renderControls({ status: 'running', progress: 0.5, message: 'Block 2/4' });
    expect(screen.getByTitle('Stop Annotation')).toBeInTheDocument();
    expect(screen.getByText('Block 2/4')).toBeInTheDocument();
  });

  it('reaches a terminal Done state — no stuck Stop control (the old green-dot bug)', () => {
    // Empty message exercises the 'Done.' fallback, distinct from the status label.
    renderControls({ status: 'done', progress: 1, message: '' });
    expect(screen.queryByTitle('Stop Annotation')).not.toBeInTheDocument();
    expect(screen.getByText('Done.')).toBeInTheDocument();
  });

  it('renders a cancelled run (previously the Cancelled message was invisible)', () => {
    renderControls({ status: 'cancelled', progress: 1, message: 'Cancelled' });
    expect(screen.getByText('Cancelled.')).toBeInTheDocument();
    expect(screen.queryByTitle('Stop Annotation')).not.toBeInTheDocument();
  });

  it('surfaces a failed run (previously mlTaskError had no listener)', () => {
    renderControls({ status: 'error', progress: 1, message: 'Authentication failed' });
    expect(screen.getByText('Authentication failed')).toBeInTheDocument();
  });

  it('shows a per-block failure count that expands to detail', async () => {
    const user = userEvent.setup();
    renderControls({
      status: 'done',
      progress: 1,
      failures: [
        { blockId: 'block-3', message: "Couldn't reach the model endpoint" },
        { blockId: 'block-7', message: "Couldn't reach the model endpoint" },
      ],
    });
    const trigger = screen.getByRole('button', { name: /2 blocks failed/i });
    await user.click(trigger);
    expect(await screen.findByText('block-3')).toBeInTheDocument();
    expect(screen.getByText('block-7')).toBeInTheDocument();
  });
});

// Build N minimal annotations so a run's `annotations.length` is controllable.
function makeAnns(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `a${i}`,
    text: 't',
    className: 'C',
    classId: 'c1',
    coords: [],
    pdfUrl,
    blockId: 'b1',
    createdAt: 0,
  }));
}
