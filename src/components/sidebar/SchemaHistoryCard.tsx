import { Bookmark, Download, Highlighter, RotateCcw } from 'lucide-react';
import type { Schema, SchemaActionRef, SchemaSnapshot, SchemaUpdate } from '@/lib/definitions.ts';
import { describeSchemaAction } from '@/lib/schema-history.ts';
import { IconButton } from '@/components/ui/IconButton.tsx';

export interface SchemaHistoryCardProps {
  update: SchemaUpdate;
  /** Current schema, used to resolve class names in the change description. */
  schema: Schema;
  /** Snapshots taken at this update (empty → not snapshotted). */
  snapshots: SchemaSnapshot[];
  /** Resolves a snapshot ref → version label (for describing a restore row). */
  versionLabelOf?: (ref: SchemaActionRef) => string | undefined;
  /** Restore the schema to the state at this update. */
  onRestore: () => void;
}

/**
 * One row in the schema history: a human-friendly description of the change and
 * when it happened, a Restore button, and — when snapshotted — a bookmark plus a
 * Highlighter (model run) / Download (export) icon and the version nickname.
 * Presentational; the actual restore work happens in the parent.
 */
export function SchemaHistoryCard({
  update,
  schema,
  snapshots,
  versionLabelOf,
  onRestore,
}: SchemaHistoryCardProps) {
  const snapshotted = snapshots.length > 0;
  const kinds = new Set(snapshots.map((s) => s.kind ?? 'manual'));
  // Latest snapshot at this update carries the version nickname to show.
  const label = [...snapshots].sort((a, b) => b.snapshotIndex - a.snapshotIndex)[0]?.label;

  return (
    <div className="flex items-start justify-between gap-2 px-2 py-1.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm">{describeSchemaAction(update.action, schema, versionLabelOf)}</span>
        <span className="text-xs text-muted-foreground">
          {new Date(update.createdAt).toLocaleString()}
        </span>
        {snapshotted && label && (
          <span className="text-xs font-medium text-[#9370DB]">{label}</span>
        )}
      </div>
      <div className="mt-0.5 flex shrink-0 items-center gap-1">
        {snapshotted && (
          <span className="flex items-center gap-1 text-[#9370DB]">
            {kinds.has('mlRun') && (
              <Highlighter aria-label="Model run" strokeWidth={2} className="size-4" />
            )}
            {kinds.has('export') && (
              <Download aria-label="Exported" strokeWidth={2} className="size-4" />
            )}
            <Bookmark aria-label="Snapshotted" className="size-4 fill-current" />
          </span>
        )}
        <IconButton
          title="Restore to this version"
          icon={RotateCcw}
          size="icon-sm"
          onClick={onRestore}
        />
      </div>
    </div>
  );
}
