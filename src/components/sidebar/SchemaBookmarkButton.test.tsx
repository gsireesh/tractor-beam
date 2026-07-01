// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { SchemaBookmarkButton } from './SchemaBookmarkButton';
import type { Schema } from '@/lib/definitions.ts';

const { snapshotMock } = vi.hoisted(() => ({ snapshotMock: vi.fn() }));
vi.mock('@/storage/repositories.ts', () => ({ schemaRepo: { snapshot: snapshotMock } }));

const schema: Schema = { id: 's1', name: 'Paper', classes: [] };

describe('SchemaBookmarkButton', () => {
  beforeEach(() => {
    snapshotMock.mockReset();
    snapshotMock.mockResolvedValue(undefined);
  });

  it('snapshots the current schema on click and shows saved feedback', async () => {
    const user = userEvent.setup();
    render(<SchemaBookmarkButton schema={schema} />);

    await user.click(screen.getByRole('button', { name: /bookmark this version/i }));

    expect(snapshotMock).toHaveBeenCalledExactlyOnceWith(schema);
    // Transient feedback: the title flips after the snapshot resolves.
    expect(await screen.findByRole('button', { name: /version bookmarked/i })).toBeInTheDocument();
  });
});
