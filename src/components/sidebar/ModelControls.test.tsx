// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { DrawerContext, type DrawerContextValue } from '@/contexts/DrawerContext.tsx';
import { ModelControls } from './ModelControls';
import type { MlAnnotationRun, Schema } from '@/lib/definitions.ts';

// Replace the storage seam with a spy so no IndexedDB is touched — the repo's own
// delegation is covered in repositories.test.ts; here we drive the UI.
const { findByMock, snapshotMock } = vi.hoisted(() => ({
  findByMock: vi.fn(),
  snapshotMock: vi.fn(),
}));
vi.mock('@/storage/repositories.ts', () => ({
  mlAnnotationRunRepo: { findBy: findByMock },
  schemaRepo: { snapshot: snapshotMock },
}));

// Config loading reaches chrome.storage, absent in jsdom. Stub it to a resolved
// null — the model-picker block is gated on a non-null config, so the history
// dropdown (what we're testing) renders regardless.
vi.mock('@/lib/config-storage.ts', () => ({
  loadModelConfig: vi.fn().mockResolvedValue(null),
  saveModelConfig: vi.fn(),
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

function renderControls() {
  return render(
    <DrawerContext.Provider value={ctx}>
      <ModelControls status="unloaded" progress={0} message="" setMlHighlights={() => {}} />
    </DrawerContext.Provider>,
  );
}

describe('ModelControls — ML run history', () => {
  beforeEach(() => {
    findByMock.mockReset();
    loadCachedAnnotations.mockReset();
    runAnnotationPipeline.mockReset();
    snapshotMock.mockReset().mockResolvedValue(undefined);
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

  it('snapshots the schema when a run is started', async () => {
    const user = userEvent.setup();
    renderControls();

    await user.click(screen.getByRole('button', { name: /highlight with ai/i }));

    // Captures the schema version this run was based on (doc 02 mlRun), and still
    // kicks off the pipeline.
    expect(snapshotMock).toHaveBeenCalledWith(activeSchema);
    expect(runAnnotationPipeline).toHaveBeenCalled();
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
