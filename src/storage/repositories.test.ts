import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APP_CONFIG } from '@/app-config';
import type { MlAnnotationRun } from '@/lib/definitions';

// The repository's job is to be the typed seam over the low-level IDB free
// functions in schema-storage — supplying the IDB config so callers don't thread
// it, and forwarding the query args unchanged. We mock the free function and
// assert that contract; we do NOT exercise real IndexedDB here.
//
// vi.mock is hoisted above imports, so the spy is created via vi.hoisted (the
// factory can't close over ordinary outer variables).
const { getMlAnnotationRunsMock } = vi.hoisted(() => ({ getMlAnnotationRunsMock: vi.fn() }));
vi.mock('@/lib/schema-storage', () => ({ getMlAnnotationRuns: getMlAnnotationRunsMock }));

import { mlAnnotationRunRepo } from './repositories';

describe('mlAnnotationRunRepo.findBy', () => {
  beforeEach(() => {
    getMlAnnotationRunsMock.mockReset();
  });

  it('delegates to getMlAnnotationRuns, injecting the app IDB config', async () => {
    const runs: MlAnnotationRun[] = [
      { id: 'r1', pdfUrl: 'doc.pdf', schemaId: 's1', annotations: [], createdAt: 1 },
    ];
    getMlAnnotationRunsMock.mockResolvedValue(runs);

    const result = await mlAnnotationRunRepo.findBy('s1', 'doc.pdf');

    // The repo's value-add: callers pass only (schemaId, pdfUrl); the config is
    // supplied for them, in the right argument position.
    expect(getMlAnnotationRunsMock).toHaveBeenCalledWith(
      APP_CONFIG.indexedDBConfig,
      's1',
      'doc.pdf',
    );
    // And it passes the archive through untouched.
    expect(result).toBe(runs);
  });
});
