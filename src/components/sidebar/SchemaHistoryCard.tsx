import { Bookmark, Download, Highlighter } from 'lucide-react';
import type { Schema, SchemaUpdate, SnapshotKind } from '@/lib/definitions.ts';
import { describeSchemaAction } from '@/lib/schema-history.ts';

export interface SchemaHistoryCardProps {
  update: SchemaUpdate;
  /** Current schema, used to resolve class names in the change description. */
  schema: Schema;
  /** Kinds of snapshot taken at this update (empty → not snapshotted). */
  kinds: SnapshotKind[];
}

/**
 * One row in the schema history: a human-friendly description of the change and
 * when it happened. When the update was snapshotted, the right shows a bookmark,
 * plus a Highlighter (a model was run) and/or Download (an export happened) to
 * indicate why the version was saved. Presentational and display-only.
 */
export function SchemaHistoryCard({ update, schema, kinds }: SchemaHistoryCardProps) {
  const snapshotted = kinds.length > 0;
  return (
    <div className="flex items-start justify-between gap-2 px-2 py-1.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm">{describeSchemaAction(update.action, schema)}</span>
        <span className="text-xs text-muted-foreground">
          {new Date(update.createdAt).toLocaleString()}
        </span>
      </div>
      {snapshotted && (
        <div className="mt-0.5 flex shrink-0 items-center gap-1 text-[#9370DB]">
          {kinds.includes('mlRun') && (
            <Highlighter aria-label="Model run" strokeWidth={2} className="size-4" />
          )}
          {kinds.includes('export') && (
            <Download aria-label="Exported" strokeWidth={2} className="size-4" />
          )}
          <Bookmark aria-label="Snapshotted" className="size-4 fill-current" />
        </div>
      )}
    </div>
  );
}
