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
import { getMlAnnotationRuns } from '@/lib/schema-storage';
import { APP_CONFIG } from '@/app-config';
import type { MlAnnotationRun } from '@/lib/definitions';

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
