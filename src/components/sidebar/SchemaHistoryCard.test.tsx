// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { SchemaHistoryCard, type SchemaHistoryCardProps } from './SchemaHistoryCard';
import type { Schema, SchemaSnapshot, SchemaUpdate } from '@/lib/definitions.ts';

const schema: Schema = {
  id: 's1',
  name: 'Paper',
  classes: [{ id: 'c1', name: 'Materials', description: '', color: 'red', instances: [] }],
};

function makeUpdate(overrides: Partial<SchemaUpdate> = {}): SchemaUpdate {
  return {
    updateIndex: 1,
    schemaId: 's1',
    action: { actionType: 'addClass', schemaId: 's1', classInfo: schema.classes[0] },
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

let snapIdx = 0;
function makeSnapshot(overrides: Partial<SchemaSnapshot> = {}): SchemaSnapshot {
  return {
    snapshotIndex: ++snapIdx,
    schemaId: 's1',
    schema,
    createdAt: 0,
    lastAppliedUpdateIndex: 1,
    kind: 'manual',
    label: 'amber-ledger',
    ...overrides,
  };
}

function renderCard(overrides: Partial<SchemaHistoryCardProps> = {}) {
  const props: SchemaHistoryCardProps = {
    update: makeUpdate(),
    schema,
    snapshots: [],
    onRestore: vi.fn(),
    ...overrides,
  };
  render(<SchemaHistoryCard {...props} />);
  return props;
}

describe('SchemaHistoryCard', () => {
  it('renders the change description and timestamp', () => {
    const createdAt = 1_700_000_000_000;
    renderCard({ update: makeUpdate({ createdAt }) });
    expect(screen.getByText('Added highlighter "Materials"')).toBeInTheDocument();
    expect(screen.getByText(new Date(createdAt).toLocaleString())).toBeInTheDocument();
  });

  it('shows no snapshot indicators when not snapshotted', () => {
    renderCard({ snapshots: [] });
    expect(screen.queryByLabelText('Snapshotted')).not.toBeInTheDocument();
  });

  it('shows bookmark + version name for a manual snapshot (no kind icon)', () => {
    renderCard({ snapshots: [makeSnapshot({ kind: 'manual', label: 'quiet-thicket' })] });
    expect(screen.getByLabelText('Snapshotted')).toBeInTheDocument();
    expect(screen.getByText('quiet-thicket')).toBeInTheDocument();
    expect(screen.queryByLabelText('Model run')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Exported')).not.toBeInTheDocument();
  });

  it('shows the model-run icon for an mlRun snapshot', () => {
    renderCard({ snapshots: [makeSnapshot({ kind: 'mlRun' })] });
    expect(screen.getByLabelText('Model run')).toBeInTheDocument();
    expect(screen.getByLabelText('Snapshotted')).toBeInTheDocument();
    expect(screen.queryByLabelText('Exported')).not.toBeInTheDocument();
  });

  it('shows the export icon for an export snapshot', () => {
    renderCard({ snapshots: [makeSnapshot({ kind: 'export' })] });
    expect(screen.getByLabelText('Exported')).toBeInTheDocument();
    expect(screen.getByLabelText('Snapshotted')).toBeInTheDocument();
    expect(screen.queryByLabelText('Model run')).not.toBeInTheDocument();
  });

  it('shows the latest snapshot version name when several were taken at one update', () => {
    renderCard({
      snapshots: [
        makeSnapshot({ snapshotIndex: 10, label: 'old-name' }),
        makeSnapshot({ snapshotIndex: 20, label: 'new-name', kind: 'mlRun' }),
      ],
    });
    expect(screen.getByText('new-name')).toBeInTheDocument();
    expect(screen.queryByText('old-name')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Model run')).toBeInTheDocument();
  });

  it('describes a restore row using the resolved target version label', () => {
    renderCard({
      update: makeUpdate({
        action: { actionType: 'restore', schemaId: 's1', restoredFrom: 20, schema },
      }),
      versionLabelOf: (ref) => (ref === 20 ? 'amber-ledger' : undefined),
    });
    expect(screen.getByText('Restored to version "amber-ledger"')).toBeInTheDocument();
  });

  it('has a Restore button that calls onRestore', async () => {
    const user = userEvent.setup();
    const { onRestore } = renderCard();
    await user.click(screen.getByRole('button', { name: /restore to this version/i }));
    expect(onRestore).toHaveBeenCalledTimes(1);
  });
});
