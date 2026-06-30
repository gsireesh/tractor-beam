import type { MlAnnotationRun } from '@/lib/definitions.ts';

export interface MlRunCardProps {
  run: MlAnnotationRun;
  /**
   * Human-readable label for the schema version (snapshot) this run was produced
   * against. Currently always undefined: doc 02 plans a run → snapshot link via a
   * `snapshotIndex` field on MlAnnotationRun, but that field doesn't exist yet.
   * When it lands, resolve the snapshot to a label and pass it here — the "Schema
   * version" row then shows it instead of the placeholder.
   */
  snapshotLabel?: string;
}

/**
 * Compact, presentational summary of a single ML annotation run, sized to sit
 * inside a dropdown row. Pure: it takes a run and renders its metadata, with no
 * storage or context access of its own.
 */
export function MlRunCard({ run, snapshotLabel }: MlRunCardProps) {
  const count = run.annotations.length;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm font-medium">{new Date(run.createdAt).toLocaleString()}</span>
      <span className="text-xs text-muted-foreground">
        {count} highlight{count === 1 ? '' : 's'}
      </span>
      <span className="text-xs text-muted-foreground">
        Schema version: {snapshotLabel ?? 'not yet tracked'}
      </span>
    </div>
  );
}
