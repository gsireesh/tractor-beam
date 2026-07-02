import { useMemo, useState } from 'react';
import { History } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { IconButton } from '@/components/ui/IconButton.tsx';
import { schemaRepo } from '@/storage/repositories.ts';
import { SchemaHistoryCard } from '@/components/sidebar/SchemaHistoryCard.tsx';
import { useDrawerContext } from '@/contexts/DrawerContext.tsx';
import type { Schema, SchemaActionRef, SchemaSnapshot, SchemaUpdate } from '@/lib/definitions.ts';

export interface SchemaHistoryProps {
  schema: Schema;
}

/**
 * History button + dropdown showing the schema's change log (the event-sourced
 * update store, doc 02), newest-first, with a bookmark on snapshotted updates and
 * a per-row Restore. Reads through the typed schemaRepo seam.
 */
export function SchemaHistory({ schema }: SchemaHistoryProps) {
  const { dispatch } = useDrawerContext();
  const [updates, setUpdates] = useState<SchemaUpdate[]>([]);
  // updateIndex → the snapshot(s) taken at that update (bookmark, kind icons, version name).
  const [snapshotsByUpdate, setSnapshotsByUpdate] = useState<Map<number, SchemaSnapshot[]>>(
    new Map(),
  );
  // snapshotIndex → version label, to resolve a restore row's "Restored to …".
  const [labelByRef, setLabelByRef] = useState<Map<SchemaActionRef, string>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const drawerRoot = useMemo(() => document.getElementById('tractor-beam-drawer-root'), []);

  // Refetch the log + snapshots each time the menu opens, newest-first.
  async function refresh() {
    setLoaded(false);
    const [allUpdates, versions] = await Promise.all([
      schemaRepo.listUpdates(schema.id),
      schemaRepo.listVersions(schema.id),
    ]);
    const byUpdate = new Map<number, SchemaSnapshot[]>();
    const labels = new Map<SchemaActionRef, string>();
    for (const v of versions) {
      const list = byUpdate.get(v.lastAppliedUpdateIndex) ?? [];
      list.push(v);
      byUpdate.set(v.lastAppliedUpdateIndex, list);
      if (v.label) labels.set(v.snapshotIndex, v.label);
    }
    setUpdates([...allUpdates].sort((a, b) => b.updateIndex - a.updateIndex));
    setSnapshotsByUpdate(byUpdate);
    setLabelByRef(labels);
    setLoaded(true);
  }

  // Restore to the state at update T: version the target (reuse or create), then
  // append a forward `restore` op (doc 06). Refresh so the new row + bookmark show.
  async function restore(targetUpdateIndex: number) {
    const { snapshotIndex, schema: target } = await schemaRepo.versionAt(
      schema.id,
      targetUpdateIndex,
    );
    dispatch({
      actionType: 'restore',
      schemaId: schema.id,
      restoredFrom: snapshotIndex,
      schema: target,
    });
    await refresh();
  }

  const versionLabelOf = (ref: SchemaActionRef) => labelByRef.get(ref);

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) void refresh();
      }}
    >
      <DropdownMenuTrigger>
        <IconButton title="Schema history" icon={History} />
      </DropdownMenuTrigger>
      <DropdownMenuPortal container={drawerRoot}>
        <DropdownMenuContent align="end" className="z-[10001] max-h-80 w-72 overflow-y-auto p-0">
          {!loaded ? (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">Loading…</div>
          ) : updates.length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">No schema changes yet</div>
          ) : (
            updates.map((u) => (
              <SchemaHistoryCard
                key={u.updateIndex}
                update={u}
                schema={schema}
                snapshots={snapshotsByUpdate.get(u.updateIndex) ?? []}
                versionLabelOf={versionLabelOf}
                onRestore={() => void restore(u.updateIndex)}
              />
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}
