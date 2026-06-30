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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layers2Icon, SignpostIcon } from 'lucide-react';
import { SchemaViewer } from '@/components/sidebar/SchemaViewer.tsx';
import { createSnapshot, rebuildState, storeMlAnnotationRun } from '@/lib/schema-storage';
import { APP_CONFIG } from '@/app-config';
import { Schema } from '@/lib/definitions';
import { schemasReducer } from '@/lib/schema-reducer';
import { usePersistedSchemaReducer } from '@/hooks/persisted-reducer';
import type { ExtensionMessage, MlProgressMessage } from '@/lib/messaging/message_definitions';
import {
  type DrawerView,
  getUiState,
  setDocumentUiState,
  setDrawerOpen,
  setLastSchemaId,
  type UiState,
} from '@/lib/config-storage';
import { DrawerContext } from '@/contexts/DrawerContext';
import { scrollToAnnotation } from '@/lib/pdf-navigation';
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
import {
  clearDrawerContent,
  getRunModel,
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
        <div className={`tractor-beam-drawer ${isOpen ? 'open' : ''}`}>
          <div className="p-4 text-sm text-muted-foreground">Loading...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <DrawerVisibilityToggle isOpen={isOpen} onToggle={toggle} />
      <div className={`tractor-beam-drawer ${isOpen ? 'open' : ''}`}>
        <DrawerContent initialSchemas={initialState} initialUiState={initialUiState} />
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
}: {
  initialSchemas: Schema[];
  initialUiState: UiState;
}) {
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

  // Bookmark the complete schema, then download the (possibly filtered) view.
  const handleExport = useCallback(
    (opts: ExportOptions) => {
      if (!activeSchema) return;
      createSnapshot(APP_CONFIG.indexedDBConfig, activeSchema).catch((e) =>
        console.error('[export] snapshot failed', e),
      );
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
      void setDocumentUiState(pdfUrl, { schemaId: id });
      void setLastSchemaId(id);
    },
    [pdfUrl],
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
  const [mlHighlights, setMlHighlights] = useState<Highlight[]>([]);
  const mlSignposts = useMemo<Signpost[]>(
    () => (activeSchema ? getSignpostsFromHighlights(mlHighlights, activeSchema) : []),
    [mlHighlights, activeSchema],
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
    });
    return () => clearDrawerContent();
  }, [dispatch, activeSchema]);

  // Push ML highlights to the viewer whenever they or the active schema change.
  // Keyed on the whole activeSchema object (not just its id) so a recolor re-fires
  // this — immer returns a new schema object on every edit. This mirrors how the
  // confirmed-sync effect reacts to activeSchema (via the confirmedHighlights memo),
  // so both highlight kinds recolor through the same trigger.
  useEffect(() => {
    syncProvisionalHighlights(mlHighlights);
  }, [mlHighlights, activeSchema]);

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
      `[drawer] confirmed highlight sync: ${confirmedHighlights.length} manual, pdfUrl="${pdfUrl}"`,
    );
    window.TractorBeamHighlights.setHighlights('confirmed', confirmedHighlights);
  }, [confirmedHighlights, pdfUrl]);

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
              Navigate Highlights
            </TabsTrigger>
          </TabsList>
          <TabsContent value={'schema'} className="overflow-scroll flex-1 min-h-0">
            <SchemaViewer schema={activeSchema} dispatch={dispatch} />
          </TabsContent>
          <TabsContent value={'navigation'} className="overflow-scroll flex-1 min-h-0">
            <InstanceNavigator confirmedSignposts={confirmedSignposts} mlSignposts={mlSignposts} />
          </TabsContent>
        </Tabs>
      </div>
      <div className="shrink-0">
        <ModelControls
          status={llmLoaded.stage}
          setMlHighlights={setMlHighlights}
          progress={llmLoaded.progress}
          message={llmLoaded.message}
        />
      </div>
    </DrawerContext.Provider>
  );
}
