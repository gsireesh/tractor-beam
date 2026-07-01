import { useCallback, useEffect, useRef, useState } from 'react';
import { Bookmark } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton.tsx';
import { onSnapshotCreated, schemaRepo } from '@/storage/repositories.ts';
import type { Schema } from '@/lib/definitions.ts';

export interface SchemaBookmarkButtonProps {
  schema: Schema;
}

/**
 * Snapshots the current schema (a user version) and reflects whether there are
 * unsaved changes since the last snapshot:
 *   - clean  → filled bookmark, disabled (nothing to save)
 *   - dirty  → outline bookmark, click to snapshot → clean
 *
 * "Dirty" is derived, never stored (doc 02):
 *   - baseline read from the event log on mount / schema switch (unsaved iff there
 *     are updates after the latest snapshot, or none yet);
 *   - flips to dirty on any edit — exactly when `schema`'s identity changes for the
 *     same id (we DON'T re-read the log on edit: that races the async createUpdate
 *     write, and "there was an edit" already implies dirty);
 *   - re-derives when a snapshot is created ANYWHERE (bookmark / export / ML run),
 *     via onSnapshotCreated — so the icon updates no matter which path saved.
 */
export function SchemaBookmarkButton({ schema }: SchemaBookmarkButtonProps) {
  const [dirty, setDirty] = useState(false);
  const prevId = useRef<string | null>(null);
  const latestId = useRef<string | null>(null);

  const refreshBaseline = useCallback(async (schemaId: string) => {
    const [updates, versions] = await Promise.all([
      schemaRepo.listUpdates(schemaId),
      schemaRepo.listVersions(schemaId),
    ]);
    if (schemaId !== latestId.current) return; // schema switched mid-fetch
    const maxUpdate = updates.reduce((m, u) => Math.max(m, u.updateIndex), 0);
    const maxAnchor = versions.reduce((m, v) => Math.max(m, v.lastAppliedUpdateIndex), 0);
    setDirty(versions.length === 0 || maxUpdate > maxAnchor);
  }, []);

  useEffect(() => {
    latestId.current = schema.id;
    if (prevId.current === schema.id) {
      setDirty(true); // same schema, new object → a dispatch mutated it → unsaved
      return;
    }
    prevId.current = schema.id;
    void refreshBaseline(schema.id);
  }, [schema, refreshBaseline]);

  // A snapshot created anywhere means this schema's current state is now saved.
  useEffect(
    () => onSnapshotCreated(() => void refreshBaseline(schema.id)),
    [schema.id, refreshBaseline],
  );

  async function bookmark() {
    await schemaRepo.snapshot(schema); // also fires onSnapshotCreated → re-derive
    setDirty(false); // optimistic; the snapshot captured the current schema
  }

  return (
    <IconButton
      title={dirty ? 'Bookmark this version — unsaved changes' : 'Version saved'}
      icon={Bookmark}
      // Disabled when clean (nothing to save), but keep it filled purple rather
      // than the default faded/gray look — override Button's disabled:opacity-50.
      disabled={!dirty}
      className="disabled:opacity-100"
      color={dirty ? null : '#9370DB'}
      fill={dirty ? undefined : '#9370DB'}
      onClick={() => void bookmark()}
    />
  );
}
