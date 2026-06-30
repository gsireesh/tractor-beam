import { Bookmark } from 'lucide-react';
import type { Schema, SchemaUpdate } from '@/lib/definitions.ts';
import { describeSchemaAction } from '@/lib/schema-history.ts';

export interface SchemaHistoryCardProps {
  update: SchemaUpdate;
  /** Current schema, used to resolve class names in the change description. */
  schema: Schema;
  /** Whether a snapshot (version) was taken at this update. */
  snapshotted: boolean;
}

/**
 * One row in the schema history: a human-friendly description of the change and
 * when it happened, with a bookmark on the right when the update was snapshotted.
 * Presentational and display-only.
 */
export function SchemaHistoryCard({ update, schema, snapshotted }: SchemaHistoryCardProps) {
  return (
    <div className="flex items-start justify-between gap-2 px-2 py-1.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm">{describeSchemaAction(update.action, schema)}</span>
        <span className="text-xs text-muted-foreground">
          {new Date(update.createdAt).toLocaleString()}
        </span>
      </div>
      {snapshotted && (
        <Bookmark
          aria-label="Snapshotted"
          className="mt-0.5 size-4 shrink-0 fill-current text-[#9370DB]"
        />
      )}
    </div>
  );
}
