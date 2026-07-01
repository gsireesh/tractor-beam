// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { SchemaBookmarkButton } from './SchemaBookmarkButton';
import type { Schema, SchemaSnapshot, SchemaUpdate } from '@/lib/definitions.ts';

const { listUpdatesMock, listVersionsMock, snapshotMock, onSnapshotCreatedMock, listenerRef } =
  vi.hoisted(() => {
    const listenerRef: { current: (() => void) | null } = { current: null };
    return {
      listUpdatesMock: vi.fn(),
      listVersionsMock: vi.fn(),
      snapshotMock: vi.fn(),
      // Capture the subscriber so a test can simulate a snapshot from elsewhere.
      onSnapshotCreatedMock: vi.fn((fn: () => void) => {
        listenerRef.current = fn;
        return () => {};
      }),
      listenerRef,
    };
  });
vi.mock('@/storage/repositories.ts', () => ({
  schemaRepo: { listUpdates: listUpdatesMock, listVersions: listVersionsMock, snapshot: snapshotMock },
  onSnapshotCreated: onSnapshotCreatedMock,
}));

const schema: Schema = { id: 's1', name: 'Paper', classes: [] };
const update = (updateIndex: number) => ({ updateIndex }) as SchemaUpdate;
const version = (lastAppliedUpdateIndex: number) => ({ lastAppliedUpdateIndex }) as SchemaSnapshot;

describe('SchemaBookmarkButton dirty state', () => {
  beforeEach(() => {
    listUpdatesMock.mockReset();
    listVersionsMock.mockReset();
    snapshotMock.mockReset().mockResolvedValue(undefined);
    listenerRef.current = null;
  });

  it('is disabled (but kept full-opacity, not grayed) when clean', async () => {
    listUpdatesMock.mockResolvedValue([update(3)]);
    listVersionsMock.mockResolvedValue([version(3)]);

    render(<SchemaBookmarkButton schema={schema} />);
    const btn = await screen.findByRole('button', { name: /version saved/i });

    expect(btn).toBeDisabled();
    // The "not grayed" bit: Button's default disabled fade is overridden.
    expect(btn.className).toContain('disabled:opacity-100');
  });

  it('reads "unsaved changes" when there are edits after the last snapshot', async () => {
    listUpdatesMock.mockResolvedValue([update(5)]);
    listVersionsMock.mockResolvedValue([version(3)]);

    render(<SchemaBookmarkButton schema={schema} />);

    expect(await screen.findByRole('button', { name: /unsaved changes/i })).toBeInTheDocument();
  });

  it('is unsaved when the schema has never been snapshotted', async () => {
    listUpdatesMock.mockResolvedValue([update(1)]);
    listVersionsMock.mockResolvedValue([]);

    render(<SchemaBookmarkButton schema={schema} />);

    expect(await screen.findByRole('button', { name: /unsaved changes/i })).toBeInTheDocument();
  });

  it('snapshots on click and returns to the saved state', async () => {
    const user = userEvent.setup();
    listUpdatesMock.mockResolvedValue([update(5)]);
    listVersionsMock.mockResolvedValue([version(3)]);

    render(<SchemaBookmarkButton schema={schema} />);
    await user.click(await screen.findByRole('button', { name: /unsaved changes/i }));

    expect(snapshotMock).toHaveBeenCalledExactlyOnceWith(schema);
    expect(await screen.findByRole('button', { name: /version saved/i })).toBeDisabled();
  });

  it('returns to unsaved when the schema is edited (new object, same id)', async () => {
    listUpdatesMock.mockResolvedValue([update(3)]);
    listVersionsMock.mockResolvedValue([version(3)]);

    const { rerender } = render(<SchemaBookmarkButton schema={schema} />);
    await screen.findByRole('button', { name: /version saved/i }); // saved baseline

    // A dispatch produces a new schema object with the same id → unsaved edit.
    rerender(<SchemaBookmarkButton schema={{ ...schema, name: 'Paper edited' }} />);

    expect(await screen.findByRole('button', { name: /unsaved changes/i })).toBeInTheDocument();
  });

  it('updates to saved when a snapshot is created elsewhere (e.g. an ML run or export)', async () => {
    listUpdatesMock.mockResolvedValue([update(5)]);
    listVersionsMock.mockResolvedValue([version(3)]);

    render(<SchemaBookmarkButton schema={schema} />);
    await screen.findByRole('button', { name: /unsaved changes/i }); // dirty baseline

    // Another path snapshots the schema: the log is now covered by a new version.
    listVersionsMock.mockResolvedValue([version(3), version(5)]);
    await act(async () => {
      listenerRef.current?.(); // simulate the onSnapshotCreated fire
    });

    expect(await screen.findByRole('button', { name: /version saved/i })).toBeInTheDocument();
  });
});
