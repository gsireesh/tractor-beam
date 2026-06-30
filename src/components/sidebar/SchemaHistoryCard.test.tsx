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
    render(<SchemaHistoryCard update={makeUpdate({ createdAt })} schema={schema} snapshotted={false} />);

    expect(screen.getByText('Added highlighter "Materials"')).toBeInTheDocument();
    expect(screen.getByText(new Date(createdAt).toLocaleString())).toBeInTheDocument();
  });

  it('shows the bookmark only when the update is snapshotted', () => {
    const { rerender } = render(
      <SchemaHistoryCard update={makeUpdate()} schema={schema} snapshotted={false} />,
    );
    expect(screen.queryByLabelText('Snapshotted')).not.toBeInTheDocument();

    rerender(<SchemaHistoryCard update={makeUpdate()} schema={schema} snapshotted={true} />);
    expect(screen.getByLabelText('Snapshotted')).toBeInTheDocument();
  });
});
