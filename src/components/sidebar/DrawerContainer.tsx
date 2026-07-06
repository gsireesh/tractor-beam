/**
 * In-page drawer components — the collapsible right-side panel (Hypothesis-style)
 * that hosts the SchemaViewer, Semantic Index, and ML controls within the PDF
 * viewer page.
 *
 * DrawerContainer owns hydration + open/close; DrawerContent owns the schema
 * reducer, ML highlight state, and the offscreen-message pipeline. The imperative
 * window-API bridge lives in entrypoints/pdfjs-additions/drawer-host; this tree
 * publishes its handle into it via registerDrawerContent while mounted.
 */

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Layers2Icon, SignpostIcon } from 'lucide-react';
import { SchemaViewer } from '@/components/sidebar/SchemaViewer.tsx';
import { rebuildState, storeMlAnnotationRun } from '@/lib/schema-storage';
import { schemaRepo } from '@/storage/repositories';
import { APP_CONFIG } from '@/app-config';
import { Schema } from '@/lib/definitions';
import { schemasReducer } from '@/lib/schema-reducer';
import { usePersistedSchemaReducer } from '@/hooks/persisted-reducer';
import type { ExtensionMessage, MlProgressMessage } from '@/lib/messaging/message_definitions';
import type { BlockFailure } from '@/lib/ml/types';
import {
  type DrawerView,
  getUiState,
  setDocumentUiState,
  setDrawerOpen,
  setLastSchemaId,
  setPinnedFilter,
  type UiState,
} from '@/lib/config-storage';
import { DrawerContext } from '@/contexts/DrawerContext';
import { scrollToAnnotation } from '@/lib/pdf-navigation';
import {
  applyNavigatorFilter,
  deserializeFilter,
  EMPTY_FILTER,
  type NavigatorFilter,
  serializeFilter,
} from '@/lib/navigator-filters.ts';
import { buildOutlineTree, type OutlineNode, sectionPathForPage } from '@/lib/pdf/outline-tree.ts';
import {
  colorMapForSchema,
  createNewSchema,
  getHighlightsFromSchema,
  getSignpostsFromHighlights,
} from '@/lib/utils.ts';
import type { Highlight, Signpost } from '@/lib/definitions.ts';
import { ModelControls } from '@/components/sidebar/ModelControls.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InstanceNavigator } from '@/components/navigation/InstanceNavigator.tsx';
import { SchemaHeader } from '@/components/sidebar/SchemaHeader.tsx';
import { DrawerVisibilityToggle } from '@/components/sidebar/DrawerVisibilityToggle.tsx';
import { AnnotationMinimap } from '@/components/minimap/AnnotationMinimap.tsx';
import {
  clearDrawerContent,
  getRunModel,
  getRunScope,
  getRunName,
  getRunSnapshotIndex,
  ownsAnnotationRequest,
  registerDrawerContent,
  syncProvisionalHighlights,
} from '@/entrypoints/pdfjs-additions/drawer-host';
import { ExportOptions, exportSchema } from '@/lib/export.ts';
import { ExportModal } from '@/components/export/ExportModal.tsx';

const DRAWER_WIDTH = 380;

export function DrawerContainer() {
  const [initialState, setInitialState] = useState<Schema[] | null>(null);
  const [initialUiState, setInitialUiState] = useState<UiState | null>(null);
  // Open by default during hydration; reconciled from storage once it loads.
  const [isOpen, setIsOpen] = useState(true);
  const hydrated = useRef(false);
  // Suggested (ML) highlights live here, one level above DrawerContent, so the
  // minimap — a sibling of DrawerVisibilityToggle — can read them. DrawerContent still
  // owns all the writes; it receives state + setter as props. This moves ML state
  // toward the root-level `ml` store slice (docs/architecture/02); the minimap is a
  // read-only consumer, so it maps onto the future `useMlHighlights()` with no setter.
  const [mlHighlights, setMlHighlights] = useState<Highlight[]>([]);
  // Filter state lives here (not in DrawerContent) so the SAME predicate shapes
  // every ML surface: the navigator list, the in-page viewer, AND the minimap —
  // otherwise the minimap would show ticks for highlights hidden from the page.
  const [filter, setFilter] = useState<NavigatorFilter>(EMPTY_FILTER);
  // The PDF's table of contents as a nested tree, read once the PDF is ready. Used
  // to resolve which section a highlight's page falls in — for the section filter
  // dimension and the per-card section chips. Empty when the PDF has no outline.
  const [outlineRoots, setOutlineRoots] = useState<OutlineNode[]>([]);
  // page → outline node-key path, for the section-filter predicate. Derived from
  // the tree; empty until the outline loads (so section filtering is a no-op then).
  const sectionOf = useCallback(
    (page: number) => sectionPathForPage(outlineRoots, page).map((n) => n.key),
    [outlineRoots],
  );
  const filteredMlHighlights = useMemo(
    () => applyNavigatorFilter(mlHighlights, filter, sectionOf),
    [mlHighlights, filter, sectionOf],
  );

  // Read the outline once the PDF document is available. The drawer usually mounts
  // after the PDF loads, but poll briefly in case it isn't ready yet, then give up.
  useEffect(() => {
    let loaded = false;
    const tryLoad = () => {
      const app = window.PDFViewerApplication as
        | { pdfDocument?: { numPages?: number } }
        | undefined;
      if (!window.TractorBeamPdf || !app?.pdfDocument) return;
      loaded = true;
      const pageCount = app.pdfDocument.numPages ?? 1;
      void window.TractorBeamPdf.extractOutline(window.PDFViewerApplication)
        .then((entries) => setOutlineRoots(buildOutlineTree(entries, pageCount)))
        .catch((err: unknown) => console.warn('[drawer] Failed to read PDF outline:', err));
    };
    tryLoad();
    if (loaded) return;
    const iv = setInterval(() => {
      tryLoad();
      if (loaded) clearInterval(iv);
    }, 500);
    const giveUp = setTimeout(() => clearInterval(iv), 10000);
    return () => {
      clearInterval(iv);
      clearTimeout(giveUp);
    };
  }, []);

  // Load schema state (IndexedDB) and UI state (chrome.storage) together so the
  // drawer's saved position is ready when its content first renders.
  useEffect(() => {
    // IndexedDB and chrome.storage don't exist during WXT's Node pre-render; skip
    // hydration there (the static skeleton is the right output) — this re-runs for
    // real once the page loads in the extension.
    if (typeof window === 'undefined' || !window.indexedDB) return;
    void Promise.all([rebuildState(APP_CONFIG.indexedDBConfig), getUiState()])
      .then(([schemas, ui]) => {
        setInitialState(schemas);
        setInitialUiState(ui);
        setIsOpen(ui.drawerOpen);
        hydrated.current = true;
      })
      .catch((err: unknown) => console.error('[drawer] state hydration failed', err));
  }, []);

  // Persist open/closed state (after hydration, so we don't clobber the stored value).
  useEffect(() => {
    if (!hydrated.current) return;
    void setDrawerOpen(isOpen);
  }, [isOpen]);

  // Adjust PDF viewer layout when drawer opens/closes.
  useEffect(() => {
    const mainContainer = document.getElementById('mainContainer');
    if (mainContainer) {
      mainContainer.style.transition = 'right 0.25s ease-in-out';
      mainContainer.style.right = isOpen ? `${DRAWER_WIDTH}px` : '0px';
    }
    const timer = setTimeout(() => window.dispatchEvent(new Event('resize')), 260);
    return () => clearTimeout(timer);
  }, [isOpen]);

  const toggle = () => setIsOpen((prev) => !prev);

  if (!initialState || !initialUiState) {
    return (
      <>
        <DrawerVisibilityToggle isOpen={isOpen} onToggle={toggle} />
        <AnnotationMinimap mlHighlights={filteredMlHighlights} isOpen={isOpen} />
        <div className={`tractor-beam-drawer ${isOpen ? 'open' : ''}`}>
          <div className="p-4 text-sm text-muted-foreground">Loading...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <DrawerVisibilityToggle isOpen={isOpen} onToggle={toggle} />
      <AnnotationMinimap mlHighlights={filteredMlHighlights} isOpen={isOpen} />
      <div className={`tractor-beam-drawer ${isOpen ? 'open' : ''}`}>
        <DrawerContent
          initialSchemas={initialState}
          initialUiState={initialUiState}
          mlHighlights={mlHighlights}
          filteredMlHighlights={filteredMlHighlights}
          setMlHighlights={setMlHighlights}
          filter={filter}
          setFilter={setFilter}
          outlineRoots={outlineRoots}
        />
      </div>
    </>
  );
}

/**
 * Decide which schema to show when the drawer first opens for a document.
 *
 * Priority order:
 *   1. explicit deep link (?schema=…), when present and still valid
 *   2. this document's saved schema (uiState.documents[pdfUrl])
 *   3. the last schema used anywhere (uiState.lastSchemaId)
 *   4. the first schema in the list
 * Only ever return an id that still exists in `schemas` — saved/deep-link ids can
 * dangle after a schema is deleted. Fall back to '' if there are no schemas at all.
 */
function resolveInitialSchemaId(
  deepLinkSchemaId: string | null,
  schemas: Schema[],
  uiState: UiState,
  pdfUrl: string,
): string {
  const exists = (id: string | null | undefined) => id != null && schemas.some((s) => s.id === id);
  if (exists(deepLinkSchemaId)) {
    return deepLinkSchemaId!;
  } else if (uiState.documents[pdfUrl] != null && exists(uiState.documents[pdfUrl].schemaId)) {
    return uiState.documents[pdfUrl].schemaId;
  } else if (exists(uiState.lastSchemaId)) {
    return uiState.lastSchemaId!;
  } else {
    return schemas[0]?.id ?? '';
  }
}

function DrawerContent({
  initialSchemas,
  initialUiState,
  mlHighlights,
  filteredMlHighlights,
  setMlHighlights,
  filter,
  setFilter,
  outlineRoots,
}: {
  initialSchemas: Schema[];
  initialUiState: UiState;
  mlHighlights: Highlight[];
  /** ML highlights already run through the shared filter (computed in the parent,
   *  shared with the minimap). Used for the viewer sync; the raw `mlHighlights`
   *  still feeds the signpost list so its source counts stay total. */
  filteredMlHighlights: Highlight[];
  setMlHighlights: Dispatch<SetStateAction<Highlight[]>>;
  filter: NavigatorFilter;
  setFilter: Dispatch<SetStateAction<NavigatorFilter>>;
  /** PDF outline tree, for resolving section membership (filter + card chips). */
  outlineRoots: OutlineNode[];
}) {
  // page → section-key path, derived locally so the confirmed viewer sync honors
  // the section filter (the ML side is filtered in the parent).
  const sectionOf = useCallback(
    (page: number) => sectionPathForPage(outlineRoots, page).map((n) => n.key),
    [outlineRoots],
  );
  const [schemas, dispatch] = usePersistedSchemaReducer(
    schemasReducer,
    initialSchemas,
    APP_CONFIG.indexedDBConfig,
  );
  const [llmLoaded, setLlmLoaded] = useState<Omit<MlProgressMessage, 'type'>>({
    stage: 'unloaded',
    progress: 0,
    message: '',
  });
  // Per-block failures for the current run, accumulated from mlBlockError and
  // reset when the next run starts. Drives the run's "N blocks failed" warning.
  const [mlFailures, setMlFailures] = useState<BlockFailure[]>([]);

  const [exportOpen, setExportOpen] = useState(false);
  // The drawer root is a stable singleton; resolve it once rather than on every render.
  const drawerRoot = useMemo(() => document.getElementById('tractor-beam-drawer-root'), []);

  const viewerParams = new URLSearchParams(window.location.search);
  const pdfUrl = viewerParams.get('file') ?? '';
  // A deep link (?schema=…&instance=…) preselects the schema so the target
  // instance's highlight is among confirmedHighlights below. Otherwise, we restore
  // this document's saved schema, falling back to the last-used / first schema.
  const [activeSchemaId, setActiveSchemaId] = useState<string>(() =>
    resolveInitialSchemaId(viewerParams.get('schema'), schemas, initialUiState, pdfUrl),
  );
  const activeSchema = schemas.find((s) => s.id === activeSchemaId) ?? schemas[0];

  // ── Per-schema pinned filters ──
  // Opt-in persistence: when a schema is "pinned", its filter is the baseline that
  // reset / reset-on-load / schema-switch restore to (instead of EMPTY_FILTER), and
  // edits to the filter keep the pin up to date. Seeded from storage; our own writes
  // update both the local copy and chrome.storage.
  const [pinnedFilters, setPinnedFilters] = useState(initialUiState.pinnedFilters);
  const isPinned = !!activeSchema && activeSchema.id in pinnedFilters;
  // The filter a schema falls back to: its pinned filter, or the empty filter.
  const baselineFilter = useCallback(
    (schemaId?: string): NavigatorFilter =>
      schemaId && pinnedFilters[schemaId]
        ? deserializeFilter(pinnedFilters[schemaId])
        : EMPTY_FILTER,
    [pinnedFilters],
  );
  const resetFilter = useCallback(
    () => setFilter(baselineFilter(activeSchema?.id)),
    [baselineFilter, activeSchema?.id, setFilter],
  );
  const togglePin = useCallback(() => {
    if (!activeSchema) return;
    const id = activeSchema.id;
    if (id in pinnedFilters) {
      setPinnedFilters((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      void setPinnedFilter(id, null);
    } else {
      const serialized = serializeFilter(filter);
      setPinnedFilters((prev) => ({ ...prev, [id]: serialized }));
      void setPinnedFilter(id, serialized);
    }
  }, [activeSchema, pinnedFilters, filter]);

  // Restore the initial schema's pinned filter once, after it resolves. (Later
  // switches go through selectSchema; run/cached loads go through resetFilter.)
  const didRestorePin = useRef(false);
  useEffect(() => {
    if (didRestorePin.current || !activeSchema) return;
    didRestorePin.current = true;
    const base = baselineFilter(activeSchema.id);
    if (base !== EMPTY_FILTER) setFilter(base);
  }, [activeSchema, baselineFilter, setFilter]);

  // While a schema is pinned, keep its stored filter in sync with edits, so the pin
  // always reflects the current filter. Guarded so it only writes on real changes.
  useEffect(() => {
    if (!activeSchema || !(activeSchema.id in pinnedFilters)) return;
    const serialized = serializeFilter(filter);
    if (JSON.stringify(pinnedFilters[activeSchema.id]) === JSON.stringify(serialized)) return;
    setPinnedFilters((prev) => ({ ...prev, [activeSchema.id]: serialized }));
    void setPinnedFilter(activeSchema.id, serialized);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- persist on filter edits only; activeSchema/pinnedFilters read as latest-render closures
  }, [filter]);

  // Bookmark the complete schema, then download the (possibly filtered) view.
  const handleExport = useCallback(
    (opts: ExportOptions) => {
      if (!activeSchema) return;
      void schemaRepo
        .snapshot(activeSchema, 'export')
        .catch((e) => console.error('[export] snapshot failed', e));
      exportSchema(activeSchema, opts);
    },
    [activeSchema],
  );

  // Restore which tab this document was last on (Schema Editor vs. Semantic Index).
  const [view, setView] = useState<DrawerView>(initialUiState.documents[pdfUrl]?.view ?? 'schema');

  // Switch the active schema and remember it, both per-document and as the global
  // last-used schema (the fallback for documents we haven't seen yet).
  const selectSchema = useCallback(
    (id: string) => {
      setActiveSchemaId(id);
      // A different schema has different classes, so the old filter would be stale.
      // Fall back to the new schema's baseline: its pinned filter, or empty.
      setFilter(baselineFilter(id));
      void setDocumentUiState(pdfUrl, { schemaId: id });
      void setLastSchemaId(id);
    },
    [pdfUrl, baselineFilter, setFilter],
  );

  // Pin this document's resolved position on first open, so it persists independently
  // of the global last-used schema (which other documents move). Idempotent for
  // documents that already have a record; runs once per document since pdfUrl is
  // stable for the page's lifetime. Writes the initial resolved schema/tab only —
  // later changes flow through selectSchema and the Tabs onValueChange.
  useEffect(() => {
    if (!pdfUrl || !activeSchemaId) return;
    void setDocumentUiState(pdfUrl, { schemaId: activeSchemaId, view });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional once-per-document write of the mount-time values
  }, [pdfUrl]);
  const confirmedHighlights = useMemo<Highlight[]>(
    () => (activeSchema ? getHighlightsFromSchema(activeSchema, pdfUrl) : []),
    [activeSchema, pdfUrl],
  );
  const confirmedSignposts = useMemo<Signpost[]>(
    () => (activeSchema ? getSignpostsFromHighlights(confirmedHighlights, activeSchema) : []),
    [confirmedHighlights, activeSchema],
  );
  const mlSignposts = useMemo<Signpost[]>(
    () => (activeSchema ? getSignpostsFromHighlights(mlHighlights, activeSchema) : []),
    [mlHighlights, activeSchema],
  );
  // The viewer must show exactly what the navigator shows, so the confirmed sync
  // effect below pushes this FILTERED array. (Section filtering has no outline
  // yet, so sectionOf defaults to a no-op — added in the ToC-section slice.) The
  // ML side is filtered in the parent (`filteredMlHighlights` prop) so the same
  // array also feeds the minimap.
  const filteredConfirmedHighlights = useMemo<Highlight[]>(
    () => applyNavigatorFilter(confirmedHighlights, filter, sectionOf),
    [confirmedHighlights, filter, sectionOf],
  );
  const removeMlHighlight = useCallback(
    (highlightId: string) => setMlHighlights((prev) => prev.filter((h) => h.id !== highlightId)),
    [],
  );
  const [titleEditing, setTitleEditing] = useState<boolean>(false);

  // Publish this component's handle to the window-API bridge while mounted.
  useEffect(() => {
    registerDrawerContent({
      dispatch,
      getActiveSchema: () => activeSchema ?? null,
      setMlHighlights,
      resetFilter,
    });
    return () => clearDrawerContent();
  }, [dispatch, activeSchema, resetFilter]);

  // Push ML highlights to the viewer whenever they or the active schema change.
  // Keyed on the whole activeSchema object (not just its id) so a recolor re-fires
  // this — immer returns a new schema object on every edit. This mirrors how the
  // confirmed-sync effect reacts to activeSchema (via the confirmedHighlights memo),
  // so both highlight kinds recolor through the same trigger.
  useEffect(() => {
    syncProvisionalHighlights(filteredMlHighlights);
  }, [filteredMlHighlights, activeSchema]);

  // Listen for messages from offscreen document (ML results)
  useEffect(() => {
    const listener = (message: ExtensionMessage) => {
      switch (message.type) {
        case 'mlProgress':
          // Results/progress are broadcast to every viewer tab tagged only by
          // requestId. Ignore progress for a run another tab started; allow
          // requestId-less generic progress (e.g. model load) through.
          if (message.requestId && !ownsAnnotationRequest(message.requestId)) break;
          setLlmLoaded({
            stage: message.stage,
            progress: message.progress,
            message: message.message,
          });
          break;
        case 'mlTaskError':
          // A fatal pipeline error (e.g. a bad key surfaced before any block, or
          // an offline short-circuit). Previously broadcast with no listener —
          // now it drives the run into a visible `error` state.
          if (message.requestId && !ownsAnnotationRequest(message.requestId)) break;
          setLlmLoaded({ stage: 'error', progress: 1, message: message.error });
          break;
        case 'mlBlockError':
          // A single block failed (previously console.warn-swallowed). Accumulate
          // for this run's warning list; ignore blocks from another tab's run.
          if (message.requestId && !ownsAnnotationRequest(message.requestId)) break;
          setMlFailures((prev) => [
            ...prev,
            { blockId: message.blockId, message: message.message },
          ]);
          break;
        case 'annotationResults':
          // Only persist/render results for a run THIS tab initiated — otherwise
          // another document's annotations get saved under this tab's pdfUrl.
          if (
            message.annotations &&
            message.requestId &&
            ownsAnnotationRequest(message.requestId)
          ) {
            // Store for later review
            storeMlAnnotationRun(APP_CONFIG.indexedDBConfig, {
              id: message.requestId,
              pdfUrl: pdfUrl,
              schemaId: activeSchema?.id ?? '',
              annotations: message.annotations,
              createdAt: Date.now(),
              model: getRunModel(message.requestId),
              scope: getRunScope(message.requestId),
              name: getRunName(message.requestId),
              snapshotIndex: getRunSnapshotIndex(message.requestId),
            }).catch((err: unknown) =>
              console.error('[drawer] Failed to store ML annotations:', err),
            );

            // Accumulate and render ML annotations as provisional highlights
            const colorsByClass = colorMapForSchema(activeSchema ?? null);
            const newMlHighlights: Highlight[] = message.annotations.map((a) => ({
              id: a.id,
              classId: a.classId,
              schemaId: activeSchema?.id ?? '',
              coords: a.coords,
              source: 'ml' as const,
              text: a.text,
              color: colorsByClass[a.classId] ?? '',
              positiveExample: true,
            }));
            setMlHighlights((prev) => [...prev, ...newMlHighlights]);
          }
          break;
      }
    };
    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  }, [activeSchema, pdfUrl]);

  // Push confirmed (human) highlights to the in-page highlights module
  useEffect(() => {
    if (!window.TractorBeamHighlights) return;
    console.log(
      `[drawer] confirmed highlight sync: ${filteredConfirmedHighlights.length} manual, pdfUrl="${pdfUrl}"`,
    );
    window.TractorBeamHighlights.setHighlights('confirmed', filteredConfirmedHighlights);
  }, [filteredConfirmedHighlights, pdfUrl]);

  // Deep link (?instance=…): scroll to and flash the target highlight once, after
  // its highlights have been synced above.
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (deepLinkHandled.current) return;
    const instanceId = viewerParams.get('instance');
    if (!instanceId) return;
    const target = confirmedHighlights.find((h) => h.id === instanceId);
    if (!target) return;
    deepLinkHandled.current = true;
    // Same "jump to highlight" pair the sidebar's InstanceNavigator uses.
    scrollToAnnotation(target.coords);
    window.TractorBeamHighlights?.flashHighlight(target.id);
  }, [confirmedHighlights]);

  return (
    <DrawerContext.Provider value={{ activeSchema, pdfUrl, dispatch, removeMlHighlight }}>
      <SchemaHeader
        activeSchema={activeSchema}
        schemas={schemas}
        editing={titleEditing}
        onEditingChange={setTitleEditing}
        onRename={(name) => {
          if (!activeSchema) return;
          dispatch({
            actionType: 'updateSchema',
            schemaId: activeSchema.id,
            schemaInfo: { ...activeSchema, name },
          });
        }}
        onSwitch={(id) => {
          selectSchema(id);
          setTitleEditing(false);
        }}
        onNew={() => {
          const newSchema = createNewSchema('');
          dispatch({ actionType: 'addSchema', schema: newSchema });
          selectSchema(newSchema.id);
          setTitleEditing(true);
        }}
        onDelete={() => {
          if (!activeSchema) return;
          const next = schemas.find((s) => s.id !== activeSchema.id);
          dispatch({ actionType: 'deleteSchema', schemaId: activeSchema.id });
          if (next) {
            selectSchema(next.id);
            setTitleEditing(false);
          } else {
            const fresh = createNewSchema('');
            dispatch({ actionType: 'addSchema', schema: fresh });
            selectSchema(fresh.id);
            setTitleEditing(true);
          }
        }}
        onOpenManager={() => {
          if (!activeSchema) return;
          void browser.runtime.sendMessage({
            type: 'openSchemaManager',
            schemaId: activeSchema.id,
          });
        }}
        onExport={() => {
          if (!activeSchema) return;
          setExportOpen(true);
        }}
      />
      <ExportModal
        open={exportOpen}
        schema={activeSchema ?? null}
        container={drawerRoot}
        onClose={() => setExportOpen(false)}
        onExport={handleExport}
      />
      <div className="flex flex-col h-full min-h-0">
        <Tabs
          className="flex-col flex-1 min-h-0"
          value={view}
          onValueChange={(v) => {
            setView(v as DrawerView);
            void setDocumentUiState(pdfUrl, { view: v as DrawerView });
          }}
        >
          <TabsList className="w-full">
            <TabsTrigger value={'schema'}>
              <Layers2Icon /> Highlighters
            </TabsTrigger>
            <TabsTrigger value={'navigation'}>
              <SignpostIcon />
              Navigate Highlights ({confirmedSignposts.length + mlSignposts.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value={'schema'} className="overflow-scroll flex-1 min-h-0">
            <SchemaViewer schema={activeSchema} dispatch={dispatch} />
          </TabsContent>
          <TabsContent value={'navigation'} className="overflow-scroll flex-1 min-h-0">
            <InstanceNavigator
              confirmedSignposts={confirmedSignposts}
              mlSignposts={mlSignposts}
              filter={filter}
              setFilter={setFilter}
              outlineRoots={outlineRoots}
              isPinned={isPinned}
              onTogglePin={togglePin}
            />
          </TabsContent>
        </Tabs>
      </div>
      <div className="shrink-0">
        <ModelControls
          status={llmLoaded.stage}
          setMlHighlights={setMlHighlights}
          progress={llmLoaded.progress}
          message={llmLoaded.message}
          onRunStart={() => {
            setLlmLoaded({ stage: 'running', progress: 0, message: 'Starting…' });
            setMlFailures([]); // clear the previous run's warnings
          }}
          failures={mlFailures}
        />
      </div>
    </DrawerContext.Provider>
  );
}
