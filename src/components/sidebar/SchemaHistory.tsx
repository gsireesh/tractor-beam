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
import type { Schema, SchemaUpdate } from '@/lib/definitions.ts';

export interface SchemaHistoryProps {
  schema: Schema;
}

/**
 * History button + dropdown showing the schema's change log (the event-sourced
 * update store, doc 02), newest-first, with a bookmark on snapshotted updates.
 * Mirrors the ML-run history dropdown in ModelControls. Reads through the typed
 * schemaRepo seam — never @/lib/schema-storage directly.
 */
export function SchemaHistory({ schema }: SchemaHistoryProps) {
  const [updates, setUpdates] = useState<SchemaUpdate[]>([]);
  // updateIndex values that have a snapshot taken at them → render a bookmark.
  const [snapshotIndices, setSnapshotIndices] = useState<Set<number>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const drawerRoot = useMemo(() => document.getElementById('tractor-beam-drawer-root'), []);

  // Refetch the log + snapshots each time the menu opens, newest-first.
  async function refresh() {
    setLoaded(false);
    const [allUpdates, versions] = await Promise.all([
      schemaRepo.listUpdates(schema.id),
      schemaRepo.listVersions(schema.id),
    ]);
    setUpdates([...allUpdates].sort((a, b) => b.updateIndex - a.updateIndex));
    setSnapshotIndices(new Set(versions.map((v) => v.lastAppliedUpdateIndex)));
    setLoaded(true);
  }

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
                snapshotted={snapshotIndices.has(u.updateIndex)}
              />
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}
