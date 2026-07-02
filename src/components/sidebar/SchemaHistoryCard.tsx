import { Bookmark, Download, Highlighter } from 'lucide-react';
import type { Schema, SchemaSnapshot, SchemaUpdate } from '@/lib/definitions.ts';
import { describeSchemaAction } from '@/lib/schema-history.ts';

export interface SchemaHistoryCardProps {
  update: SchemaUpdate;
  /** Current schema, used to resolve class names in the change description. */
  schema: Schema;
  /** Snapshots taken at this update (empty → not snapshotted). */
  snapshots: SchemaSnapshot[];
}

/**
 * One row in the schema history: a human-friendly description of the change and
 * when it happened. When the update was snapshotted, the right shows a bookmark,
 * plus a Highlighter (a model was run) and/or Download (an export happened); the
 * version's nickname (latest snapshot's label) shows under the description.
 * Presentational and display-only.
 */
export function SchemaHistoryCard({ update, schema, snapshots }: SchemaHistoryCardProps) {
  const snapshotted = snapshots.length > 0;
  const kinds = new Set(snapshots.map((s) => s.kind ?? 'manual'));
  // Latest snapshot at this update carries the version nickname to show.
  const label = [...snapshots].sort((a, b) => b.snapshotIndex - a.snapshotIndex)[0]?.label;

  return (
    <div className="flex items-start justify-between gap-2 px-2 py-1.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm">{describeSchemaAction(update.action, schema)}</span>
        <span className="text-xs text-muted-foreground">
          {new Date(update.createdAt).toLocaleString()}
        </span>
        {snapshotted && label && (
          <span className="text-xs font-medium text-[#9370DB]">{label}</span>
        )}
      </div>
      {snapshotted && (
        <div className="mt-0.5 flex shrink-0 items-center gap-1 text-[#9370DB]">
          {kinds.has('mlRun') && (
            <Highlighter aria-label="Model run" strokeWidth={2} className="size-4" />
          )}
          {kinds.has('export') && (
            <Download aria-label="Exported" strokeWidth={2} className="size-4" />
          )}
          <Bookmark aria-label="Snapshotted" className="size-4 fill-current" />
        </div>
      )}
    </div>
  );
}
