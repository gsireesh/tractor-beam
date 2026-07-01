import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APP_CONFIG } from '@/app-config';
import type { MlAnnotationRun, Schema } from '@/lib/definitions';

// The repository's job is to be the typed seam over the low-level IDB free
// functions in schema-storage — supplying the IDB config so callers don't thread
// it, and forwarding the args unchanged. We mock the free functions and assert
// that contract; we do NOT exercise real IndexedDB here.
//
// vi.mock is hoisted above imports, so the spies are created via vi.hoisted (the
// factory can't close over ordinary outer variables).
const { getMlAnnotationRunsMock, createSnapshotMock, getUpdatesMock, getSnapshotsMock } = vi.hoisted(
  () => ({
    getMlAnnotationRunsMock: vi.fn(),
    createSnapshotMock: vi.fn(),
    getUpdatesMock: vi.fn(),
    getSnapshotsMock: vi.fn(),
  }),
);
vi.mock('@/lib/schema-storage', () => ({
  getMlAnnotationRuns: getMlAnnotationRunsMock,
  createSnapshot: createSnapshotMock,
  getUpdates: getUpdatesMock,
  getSnapshots: getSnapshotsMock,
}));

import { mlAnnotationRunRepo, schemaRepo } from './repositories';

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

describe('schemaRepo', () => {
  beforeEach(() => {
    createSnapshotMock.mockReset();
    getUpdatesMock.mockReset();
    getSnapshotsMock.mockReset();
  });

  it('listUpdates returns the full event log (afterUpdateIndex -1) with config injected', async () => {
    getUpdatesMock.mockResolvedValue([]);
    await schemaRepo.listUpdates('s1');
    expect(getUpdatesMock).toHaveBeenCalledWith(APP_CONFIG.indexedDBConfig, 's1', -1);
  });

  it('snapshot delegates to createSnapshot with the schema and config', async () => {
    const schema: Schema = { id: 's1', name: 'Paper', classes: [] };
    await schemaRepo.snapshot(schema);
    expect(createSnapshotMock).toHaveBeenCalledWith(APP_CONFIG.indexedDBConfig, schema);
  });
});
