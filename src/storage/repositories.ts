/**
 * Repository layer for IndexedDB access — see docs/architecture/02-state-and-persistence.md.
 *
 * The architecture intends `src/storage/` to be the *only* place that imports the
 * low-level `@/lib/schema-storage` IDB functions; every other layer reaches data
 * through these typed repository objects ("repositories, not free functions"). This
 * file is the first slice of that seam — only the ML-annotation-run archive is
 * covered so far. As callsites migrate, more repositories (e.g. `schemaRepo`) move
 * here and the free functions in `schema-storage.ts` are deleted.
 */
import { createSnapshot, getMlAnnotationRuns, getSnapshots, getUpdates } from '@/lib/schema-storage';
import { APP_CONFIG } from '@/app-config';
import type {
  MlAnnotationRun,
  Schema,
  SchemaSnapshot,
  SchemaUpdate,
  SnapshotKind,
} from '@/lib/definitions';

/**
 * ML annotation runs are an *immutable archive* (doc 02): each run is written once
 * when a model pipeline completes and is later queried by key — never replayed into
 * living state. The repo owns the IDB config so callers needn't thread it through.
 */
export const mlAnnotationRunRepo = {
  /** Every archived run for `schemaId` on `pdfUrl`, in no particular order. */
  findBy(schemaId: string, pdfUrl: string): Promise<MlAnnotationRun[]> {
    return getMlAnnotationRuns(APP_CONFIG.indexedDBConfig, schemaId, pdfUrl);
  },
};

/**
 * The schema slice is an *event log* (doc 02): `listUpdates` is the change history
 * (each update = one dispatched action), `listVersions` the snapshots that mark
 * points in it. Read-only here; the write side (rebuild/appendEvent/snapshot)
 * migrates behind this repo per doc 02's reconstruction path.
 */
export const schemaRepo = {
  /** Every change event for a schema, oldest-key first (the full log). */
  listUpdates(schemaId: string): Promise<SchemaUpdate[]> {
    // getUpdates returns updates with index > afterUpdateIndex; -1 gets all.
    return getUpdates(APP_CONFIG.indexedDBConfig, schemaId, -1);
  },
  /** Every snapshot (version) recorded for a schema. */
  listVersions(schemaId: string): Promise<SchemaSnapshot[]> {
    return getSnapshots(APP_CONFIG.indexedDBConfig, schemaId);
  },
  /**
   * Record a snapshot (user version) of the schema's current state. A persistence
   * concern, not a SchemaAction (doc 02). `createSnapshot` stamps it with the
   * current global max updateIndex as the replay/version anchor. (A `kind:
   * 'manual'` discriminator will be added when that field lands on SchemaSnapshot.)
   *
   * Notifies snapshot subscribers on success so derived "unsaved changes"
   * indicators refresh regardless of which path (bookmark / export / ML run)
   * created the snapshot.
   */
  async snapshot(schema: Schema, kind: SnapshotKind = 'manual'): Promise<number> {
    // Returns the new snapshotIndex so callers (e.g. an ML run) can reference the
    // snapshot by id; the version label is generated on the snapshot itself.
    const snapshotIndex = await createSnapshot(APP_CONFIG.indexedDBConfig, schema, kind);
    snapshotListeners.forEach((listener) => listener());
    return snapshotIndex;
  },
};

// ─── Snapshot-created notifications ───
// Interim reactivity until the doc-02 store derives "dirty" centrally: any
// `schemaRepo.snapshot` fires these so UI (the bookmark button) can re-derive.
const snapshotListeners = new Set<() => void>();

/** Subscribe to schema-snapshot creation; returns an unsubscribe function. */
export function onSnapshotCreated(listener: () => void): () => void {
  snapshotListeners.add(listener);
  return () => snapshotListeners.delete(listener);
}
