import { useEffect, useRef, useState } from 'react';
import { Bookmark } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton.tsx';
import { schemaRepo } from '@/storage/repositories.ts';
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
 * "Dirty" is derived, never stored (doc 02). We read the baseline once from the
 * event log on mount / schema switch, then flip to dirty on any edit — an edit is
 * exactly when `schema`'s identity changes for the same id (the reducer produced
 * new state). We deliberately DON'T re-read the log on edit: that would race the
 * async createUpdate write, and "there was an edit" already implies dirty.
 * Snapshotting is a persistence concern, not a SchemaAction, so this calls the
 * repo write seam directly.
 */
export function SchemaBookmarkButton({ schema }: SchemaBookmarkButtonProps) {
  const [dirty, setDirty] = useState(false);
  const prevId = useRef<string | null>(null);

  useEffect(() => {
    if (prevId.current === schema.id) {
      // Same schema, new object → a dispatch mutated it → unsaved.
      setDirty(true);
      return;
    }
    // Mount or schema switch → compute the baseline from storage.
    prevId.current = schema.id;
    let cancelled = false;
    void Promise.all([schemaRepo.listUpdates(schema.id), schemaRepo.listVersions(schema.id)]).then(
      ([updates, versions]) => {
        if (cancelled) return;
        const maxUpdate = updates.reduce((m, u) => Math.max(m, u.updateIndex), 0);
        const maxAnchor = versions.reduce((m, v) => Math.max(m, v.lastAppliedUpdateIndex), 0);
        setDirty(versions.length === 0 || maxUpdate > maxAnchor);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [schema]);

  async function bookmark() {
    await schemaRepo.snapshot(schema);
    // The snapshot captured the current schema, so we're now clean.
    setDirty(false);
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
