// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { SchemaHistory } from './SchemaHistory';
import type { Schema, SchemaSnapshot, SchemaUpdate } from '@/lib/definitions.ts';

// Read through the repo seam — mock it so no IndexedDB is touched.
const { listUpdatesMock, listVersionsMock } = vi.hoisted(() => ({
  listUpdatesMock: vi.fn(),
  listVersionsMock: vi.fn(),
}));
vi.mock('@/storage/repositories.ts', () => ({
  schemaRepo: { listUpdates: listUpdatesMock, listVersions: listVersionsMock },
}));

const schema: Schema = {
  id: 's1',
  name: 'Paper',
  classes: [{ id: 'c1', name: 'Materials', description: '', color: 'red', instances: [] }],
};

function update(overrides: Partial<SchemaUpdate>): SchemaUpdate {
  return {
    updateIndex: 1,
    schemaId: 's1',
    action: { actionType: 'addClass', schemaId: 's1', classInfo: schema.classes[0] },
    createdAt: 0,
    ...overrides,
  };
}

describe('SchemaHistory', () => {
  beforeEach(() => {
    listUpdatesMock.mockReset();
    listVersionsMock.mockReset();
  });

  it('lists changes newest-first and marks the snapshotted update with its kind', async () => {
    const user = userEvent.setup();
    // Supplied oldest-first to prove the component re-sorts by updateIndex desc.
    listUpdatesMock.mockResolvedValue([
      update({ updateIndex: 1 }), // addClass "Materials"
      update({
        updateIndex: 2,
        action: { actionType: 'updateInstance', schemaId: 's1', classId: 'c1', instanceId: 'i1', updates: { positiveExample: true } },
      }),
    ]);
    // Only update #2 was snapshotted — by an ML run, named "warm-lantern".
    listVersionsMock.mockResolvedValue([
      { snapshotIndex: 5, lastAppliedUpdateIndex: 2, kind: 'mlRun', label: 'warm-lantern' } as SchemaSnapshot,
    ]);

    render(<SchemaHistory schema={schema} />);
    await user.click(screen.getByTitle('Schema history'));

    const newer = await screen.findByText('Marked example positive');
    const older = screen.getByText('Added highlighter "Materials"');

    // Newest-first: the update #2 row precedes the update #1 row.
    expect(newer.compareDocumentPosition(older) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // The snapshot indicators (bookmark + model-run) are on update #2's row only.
    const newerRow = newer.closest('div.justify-between') as HTMLElement;
    const olderRow = older.closest('div.justify-between') as HTMLElement;
    expect(within(newerRow).getByLabelText('Snapshotted')).toBeInTheDocument();
    expect(within(newerRow).getByLabelText('Model run')).toBeInTheDocument();
    expect(within(newerRow).getByText('warm-lantern')).toBeInTheDocument(); // version name
    expect(within(olderRow).queryByLabelText('Snapshotted')).not.toBeInTheDocument();
  });

  it('shows an empty state when the schema has no changes', async () => {
    const user = userEvent.setup();
    listUpdatesMock.mockResolvedValue([]);
    listVersionsMock.mockResolvedValue([]);

    render(<SchemaHistory schema={schema} />);
    await user.click(screen.getByTitle('Schema history'));

    expect(await screen.findByText('No schema changes yet')).toBeInTheDocument();
  });
});
