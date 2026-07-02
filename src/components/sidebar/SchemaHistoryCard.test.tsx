// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SchemaHistoryCard } from './SchemaHistoryCard';
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

describe('SchemaHistoryCard', () => {
  it('renders the change description and timestamp', () => {
    const createdAt = 1_700_000_000_000;
    render(<SchemaHistoryCard update={makeUpdate({ createdAt })} schema={schema} snapshots={[]} />);

    expect(screen.getByText('Added highlighter "Materials"')).toBeInTheDocument();
    expect(screen.getByText(new Date(createdAt).toLocaleString())).toBeInTheDocument();
  });

  it('shows no snapshot indicators when not snapshotted', () => {
    render(<SchemaHistoryCard update={makeUpdate()} schema={schema} snapshots={[]} />);
    expect(screen.queryByLabelText('Snapshotted')).not.toBeInTheDocument();
  });

  it('shows bookmark + version name for a manual snapshot (no kind icon)', () => {
    render(
      <SchemaHistoryCard
        update={makeUpdate()}
        schema={schema}
        snapshots={[makeSnapshot({ kind: 'manual', label: 'quiet-thicket' })]}
      />,
    );
    expect(screen.getByLabelText('Snapshotted')).toBeInTheDocument();
    expect(screen.getByText('quiet-thicket')).toBeInTheDocument();
    expect(screen.queryByLabelText('Model run')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Exported')).not.toBeInTheDocument();
  });

  it('shows the model-run icon for an mlRun snapshot', () => {
    render(
      <SchemaHistoryCard
        update={makeUpdate()}
        schema={schema}
        snapshots={[makeSnapshot({ kind: 'mlRun' })]}
      />,
    );
    expect(screen.getByLabelText('Model run')).toBeInTheDocument();
    expect(screen.getByLabelText('Snapshotted')).toBeInTheDocument();
    expect(screen.queryByLabelText('Exported')).not.toBeInTheDocument();
  });

  it('shows the export icon for an export snapshot', () => {
    render(
      <SchemaHistoryCard
        update={makeUpdate()}
        schema={schema}
        snapshots={[makeSnapshot({ kind: 'export' })]}
      />,
    );
    expect(screen.getByLabelText('Exported')).toBeInTheDocument();
    expect(screen.getByLabelText('Snapshotted')).toBeInTheDocument();
    expect(screen.queryByLabelText('Model run')).not.toBeInTheDocument();
  });

  it('shows the latest snapshot version name when several were taken at one update', () => {
    render(
      <SchemaHistoryCard
        update={makeUpdate()}
        schema={schema}
        snapshots={[
          makeSnapshot({ snapshotIndex: 10, label: 'old-name' }),
          makeSnapshot({ snapshotIndex: 20, label: 'new-name', kind: 'mlRun' }),
        ]}
      />,
    );
    expect(screen.getByText('new-name')).toBeInTheDocument();
    expect(screen.queryByText('old-name')).not.toBeInTheDocument();
    // Both kinds' indicators show (manual bookmark + the mlRun icon).
    expect(screen.getByLabelText('Model run')).toBeInTheDocument();
  });
});
