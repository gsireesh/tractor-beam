// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SchemaHistoryCard } from './SchemaHistoryCard';
import type { Schema, SchemaUpdate } from '@/lib/definitions.ts';

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

describe('SchemaHistoryCard', () => {
  it('renders the change description and timestamp', () => {
    const createdAt = 1_700_000_000_000;
    render(<SchemaHistoryCard update={makeUpdate({ createdAt })} schema={schema} kinds={[]} />);

    expect(screen.getByText('Added highlighter "Materials"')).toBeInTheDocument();
    expect(screen.getByText(new Date(createdAt).toLocaleString())).toBeInTheDocument();
  });

  it('shows no snapshot indicators when not snapshotted', () => {
    render(<SchemaHistoryCard update={makeUpdate()} schema={schema} kinds={[]} />);
    expect(screen.queryByLabelText('Snapshotted')).not.toBeInTheDocument();
  });

  it('shows only the bookmark for a manual snapshot', () => {
    render(<SchemaHistoryCard update={makeUpdate()} schema={schema} kinds={['manual']} />);
    expect(screen.getByLabelText('Snapshotted')).toBeInTheDocument();
    expect(screen.queryByLabelText('Model run')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Exported')).not.toBeInTheDocument();
  });

  it('shows the model-run icon (not export) for an mlRun snapshot', () => {
    render(<SchemaHistoryCard update={makeUpdate()} schema={schema} kinds={['mlRun']} />);
    expect(screen.getByLabelText('Snapshotted')).toBeInTheDocument();
    expect(screen.getByLabelText('Model run')).toBeInTheDocument();
    expect(screen.queryByLabelText('Exported')).not.toBeInTheDocument();
  });

  it('shows the export icon (not model-run) for an export snapshot', () => {
    render(<SchemaHistoryCard update={makeUpdate()} schema={schema} kinds={['export']} />);
    expect(screen.getByLabelText('Snapshotted')).toBeInTheDocument();
    expect(screen.getByLabelText('Exported')).toBeInTheDocument();
    expect(screen.queryByLabelText('Model run')).not.toBeInTheDocument();
  });
});
