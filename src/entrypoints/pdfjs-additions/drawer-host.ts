/**
 * Drawer host — the imperative bridge between the React drawer tree and the
 * vanilla-JS callers that reach it through `window.TractorBeamDrawer` (the
 * separate popover root, pdf.js chrome, etc.).
 *
 * Owns the module-level refs that the drawer components publish into (via
 * registerDrawerContent), the annotation/segmentation pipeline functions, and
 * the assembly of the window API. Kept JSX-free so it can be reasoned about and
 * tested without mounting React. Mirrors how highlights.tsx / pdf-api.ts
 * each own a single window.TractorBeam* API.
 */

import { mlAnnotationRunRepo } from '@/storage/repositories';
import type {
  Highlight,
  Instance,
  MlRunModel,
  MlRunScope,
  Schema,
  SchemaAction,
} from '@/lib/definitions';
import { loadModelConfig } from '@/lib/config-storage';
import type { ModelConfig } from '@/lib/ml/model-config';
import { runName } from '@/lib/friendly-name';
import { colorMapForSchema, mergePdfBoxes } from '@/lib/utils.ts';
import { VISUAL_BLOCK_CLASS_ID } from '@/components/highlights/HighlightOverlay.tsx';

// ─── Module-level refs for the window API ───
// Populated by DrawerContent via registerDrawerContent() while it is mounted,
// and read lazily by the window API closures below. Null/no-op until then.

let drawerDispatch: ((action: SchemaAction) => void) | null = null;
let getActiveSchemaFn: () => Schema | null = () => null;

// Bridge so the pipeline functions (invoked via the window API) can push ML
// highlights into the component's reactive state. Null until the drawer mounts.
let setMlHighlightsFn: ((highlights: Highlight[]) => void) | null = null;

// Bridge to clear the navigator/viewer filter. Whenever the ML set is wholesale
// replaced (a new run starts, or a cached run is loaded from history), a stale
// filter could silently hide the fresh annotations — so we reset it in lockstep.
let resetFilterFn: (() => void) | null = null;

// ─── Registration contract ───
// DrawerContent registers/clears the handle on mount/unmount. The window API
// reads these refs lazily, so they may legitimately be empty between install
// and the first mount (the closures null-guard for it).

export interface DrawerHandle {
  dispatch: (action: SchemaAction) => void;
  getActiveSchema: () => Schema | null;
  setMlHighlights: (highlights: Highlight[]) => void;
  resetFilter: () => void;
}

export function registerDrawerContent(handle: DrawerHandle): void {
  drawerDispatch = handle.dispatch;
  getActiveSchemaFn = handle.getActiveSchema;
  setMlHighlightsFn = handle.setMlHighlights;
  resetFilterFn = handle.resetFilter;
}

export function clearDrawerContent(): void {
  drawerDispatch = null;
  // Reset to the non-null default, not null — getActiveSchemaFn is never null,
  // so callers (getInstance, syncProvisionalHighlights) needn't guard it.
  getActiveSchemaFn = () => null;
  setMlHighlightsFn = null;
  resetFilterFn = null;
}

async function runSegmentationPipeline() {
  console.log('[drawer] Drawing segmentation boxes');
  if (!window.TractorBeamPdf) {
    console.error('[drawer] TractorBeamPdf not available');
    return;
  }

  console.log('[drawer] Extracting visual blocks...');
  const PDFViewerApplication = window.PDFViewerApplication;
  const blocks = await window.TractorBeamPdf.extractVisualBlocks(PDFViewerApplication);
  console.log(`[drawer] Extracted ${blocks.length} visual blocks`);

  window.TractorBeamHighlights.setHighlights(
    'layout',
    blocks.map((block) => {
      const superBlock = mergePdfBoxes(block.items.map((item) => item.box));
      return {
        id: block.blockId,
        classId: VISUAL_BLOCK_CLASS_ID,
        schemaId: 'visual',
        source: 'ml' as const,
        color: 'visual',
        coords: [superBlock],
        positiveExample: true,
      };
    }),
  );
}

async function loadCachedAnnotations(schemaId: string, pdfUrl: string, runId?: string) {
  console.log('[drawer] Loading cached annotations from IndexedDB');
  const runs = await mlAnnotationRunRepo.findBy(schemaId, pdfUrl);
  if (runs.length === 0) {
    console.log('[drawer] No cached annotation runs found');
    return;
  }
  // With a runId, time-travel to that specific run; without one, default to the
  // most recent (the History icon's bare-click behavior).
  const run = runId
    ? runs.find((r) => r.id === runId)
    : runs.sort((a, b) => b.createdAt - a.createdAt)[0];
  if (!run) {
    console.warn(`[drawer] Requested cached run ${runId} not found`);
    return;
  }
  console.log(`[drawer] Loaded cached run ${run.id} with ${run.annotations.length} annotations`);
  const colorsByClass = colorMapForSchema(getActiveSchemaFn());
  const loaded: Highlight[] = run.annotations.map((a) => ({
    id: a.id,
    classId: a.classId,
    schemaId,
    coords: a.coords,
    source: 'ml' as const,
    text: a.text,
    color: colorsByClass[a.classId] ?? '',
    positiveExample: true,
  }));
  // Clear any active filter first, so the freshly loaded run isn't silently
  // hidden by a filter set up against the previous set. State change drives the
  // viewer sync via the [mlHighlights] effect.
  resetFilterFn?.();
  setMlHighlightsFn?.(loaded);
}

/** Map raw ML highlights to colored Highlight objects and push to the highlights module. */
export function syncProvisionalHighlights(mlHighlights: Highlight[]) {
  if (!window.TractorBeamHighlights) return;
  const schema = getActiveSchemaFn();
  if (!schema) {
    window.TractorBeamHighlights.setHighlights('provisional', []);
    return;
  }
  const colorsByClass = colorMapForSchema(schema);
  const highlights: Highlight[] = mlHighlights
    .filter((h) => h.schemaId === schema.id && colorsByClass[h.classId] !== undefined)
    .map((h) => ({ ...h, color: colorsByClass[h.classId] ?? h.color }));
  console.log(
    `[drawer] provisional highlight sync: ${highlights.length} ML for schema ${schema.id}`,
  );
  window.TractorBeamHighlights.setHighlights('provisional', highlights);
}

// ─── Run ownership ───
// The offscreen document BROADCASTS annotationResults/mlProgress to every open
// viewer tab, tagged only by requestId. This module is per-tab (one instance per
// viewer page), so the set of requestIds initiated here IS "runs this tab owns".
// Receivers (DrawerContainer's message listener) consult this to ignore another
// tab's run — otherwise a run on document A gets persisted under tab B's pdfUrl.
const ownedRequestIds = new Set<string>();

// Secret-stripped model snapshot per owned run, captured at initiation so the
// receiver can persist provenance with the run (the apiKey never leaves here).
const runModels = new Map<string, MlRunModel>();

// Friendly nickname per owned run, generated once at initiation so it stays
// stable across the per-block annotationResults broadcasts (which each restore
// the same run record by requestId).
const runNames = new Map<string, string>();

// The mlRun snapshot each run was based on (by snapshotIndex), so the stored run
// can reference it (doc 02: run → snapshot); the label is derived from it later.
const runSnapshotIndices = new Map<string, number>();

// Scope descriptor per owned run, captured at initiation for the same reason as
// runModels: the scope is chosen here but persisted by DrawerContainer's receiver.
// Absent for whole-document runs.
const runScopes = new Map<string, MlRunScope>();

/** True if this tab initiated the given annotation run. */
export function ownsAnnotationRequest(requestId: string): boolean {
  return ownedRequestIds.has(requestId);
}

/** The model snapshot recorded for a run this tab initiated, if any. */
export function getRunModel(requestId: string): MlRunModel | undefined {
  return runModels.get(requestId);
}

/** The friendly nickname assigned to a run this tab initiated, if any. */
export function getRunName(requestId: string): string | undefined {
  return runNames.get(requestId);
}

/** The mlRun snapshot (by index) a run this tab initiated was based on, if any. */
export function getRunSnapshotIndex(requestId: string): number | undefined {
  return runSnapshotIndices.get(requestId);
}

/** The scope recorded for a run this tab initiated, if any (absent = whole doc). */
export function getRunScope(requestId: string): MlRunScope | undefined {
  return runScopes.get(requestId);
}

/**
 * Distill the active selection into a credential-free snapshot for storage.
 * Only `provider`, `model`, and `baseUrl` are copied; the provider block's
 * sibling `apiKey` is never read, so it cannot reach IndexedDB.
 */
function modelSnapshot(config: ModelConfig): MlRunModel {
  const { provider, model } = config.selected;
  const block = config[provider];
  return {
    provider,
    model,
    baseUrl: 'baseUrl' in block ? block.baseUrl : undefined,
  };
}

// ─── Pipeline orchestration (called via window API) ───
async function runAnnotationPipeline(
  schema: Schema,
  requestId: string,
  scope?: MlRunScope,
  snapshotIndex?: number,
) {
  console.log(
    '[drawer] Starting annotation pipeline:',
    requestId,
    scope ? `scope=${scope.label}` : 'whole document',
  );
  ownedRequestIds.add(requestId);
  runNames.set(requestId, runName());
  if (snapshotIndex !== undefined) runSnapshotIndices.set(requestId, snapshotIndex);
  if (scope) runScopes.set(requestId, scope);

  // Reset ML highlights for the new run (state change re-syncs the viewer), and
  // clear any active filter so incoming results aren't hidden by a stale filter.
  resetFilterFn?.();
  setMlHighlightsFn?.([]);

  // 1. Extract visual blocks directly from the in-page API
  if (!window.TractorBeamPdf) {
    console.error('[drawer] TractorBeamPdf not available');
    return;
  }
  const PDFViewerApplication = window.PDFViewerApplication;
  if (!PDFViewerApplication) {
    console.error('[drawer] PDFViewerApplication not available');
    return;
  }

  console.log('[drawer] Extracting visual blocks...');
  const allBlocks = await window.TractorBeamPdf.extractVisualBlocks(PDFViewerApplication);
  // Every VisualBlock carries a pageNumber, so scoping is just a page-set filter here;
  // the offscreen doc consumes whatever blocks we send.
  const pageSet = scope ? new Set(scope.pages) : null;
  const blocks = pageSet ? allBlocks.filter((b) => pageSet.has(b.pageNumber)) : allBlocks;
  console.log(
    `[drawer] Extracted ${allBlocks.length} visual blocks; dispatching ${blocks.length}` +
      (scope ? ` for ${scope.label}` : ''),
  );

  // 2. Ensure the offscreen document is ready
  await chrome.runtime.sendMessage({ type: 'ensureOffscreen' }).catch(() => {
    console.warn('[drawer] ensureOffscreen failed — offscreen may already exist');
  });

  // 3. Read the per-provider model config (healed on read) and send the
  // complete message to the offscreen document. The active provider's secret
  // travels inside modelConfig — offscreen can't read chrome.storage itself.
  const modelConfig = await loadModelConfig();
  // Record what ran, for the history card. Set before dispatching so it's present
  // by the time results broadcast back. Credential-free (see modelSnapshot).
  runModels.set(requestId, modelSnapshot(modelConfig));

  chrome.runtime
    .sendMessage({
      type: 'runAnnotationPipeline',
      requestId,
      schema,
      blocks,
      modelConfig,
    })
    .catch((err) => {
      console.error('[drawer] Failed to send runAnnotationPipeline:', err);
    });
}

function cancelAnnotationPipeline(requestId: string) {
  console.log('[drawer] Cancelling annotation pipeline:', requestId);
  chrome.runtime
    .sendMessage({
      type: 'cancelAnnotationPipeline',
      requestId,
    })
    .catch(() => {
      console.log('Failed to cancel annotation!');
    });
}

// ─── Window API ───

declare global {
  interface Window {
    PDFViewerApplication?: { pdfDocument: unknown };
    TractorBeamDrawer: {
      dispatch: (action: SchemaAction) => void;
      getActiveSchema: () => Schema | null;
      getInstance: (schemaId: string, classId: string, instanceId: string) => Instance | null;
      runAnnotationPipeline: (
        schema: Schema,
        requestId: string,
        scope?: MlRunScope,
        snapshotIndex?: number,
      ) => Promise<void>;
      runSegmentationPipeline: () => Promise<void>;
      loadCachedAnnotations: (schemaId: string, pdfUrl: string, runId?: string) => Promise<void>;
      cancelAnnotationPipeline: (requestId: string) => void;
    };
  }
}

/** Assemble and install window.TractorBeamDrawer. Called once from init(). */
export function installDrawerApi(): void {
  window.TractorBeamDrawer = {
    dispatch: (action: SchemaAction) => {
      if (drawerDispatch) drawerDispatch(action);
      else console.warn('[drawer] dispatch called before drawer is ready');
    },
    getActiveSchema: () => getActiveSchemaFn(),
    getInstance: (schemaId: string, classId: string, instanceId: string) => {
      const schema = getActiveSchemaFn();
      if (!schema || schema.id !== schemaId) return null;
      const cls = schema.classes.find((c) => c.id === classId);
      if (!cls) return null;
      return cls.instances.find((i) => i.id === instanceId) ?? null;
    },
    runAnnotationPipeline,
    runSegmentationPipeline,
    loadCachedAnnotations,
    cancelAnnotationPipeline,
  };
}
