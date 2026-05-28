/**
 * In-page drawer — renders the SchemaViewer inside a collapsible
 * right-side panel within the PDF viewer page (Hypothesis-style).
 *
 * Exposes window.TractorBeamDrawer API, including annotation pipeline
 * orchestration (visual block extraction → offscreen ML → highlight rendering).
 */

import {useEffect, useRef, useState} from 'react';
import {createRoot, Root} from 'react-dom/client';
import {ArrowLeftRight, Layers2Icon, PencilLine, Plus, SignpostIcon} from 'lucide-react';
import {SchemaViewer} from '@/components/SchemaViewer';
import {getMlAnnotationRuns, getStates, storeMlAnnotationRun} from '@/lib/schema-storage';
import {APP_CONFIG} from '@/app-config';
import {Instance, PdfBox, Schema} from '@/lib/definitions';
import {SchemaAction, schemasReducer} from '@/lib/schema-reducer';
import {usePersistedReducer} from '@/hooks/persisted-reducer';
import type {ExtensionMessage} from '@/lib/messaging/message_definitions';
import {getClaudeApiKey, getModelConfig, getOllamaBaseUrl} from '@/lib/ml/config';
import {DrawerContext} from '@/contexts/DrawerContext';
import cssText from './drawer-styles.css?inline';
import {createNewSchema, mergePdfBoxes} from "@/lib/utils.ts";
import {VISUAL_BLOCK_CLASS_ID} from '@/components/HighlightOverlay.tsx';
import type {Highlight} from '@/lib/definitions.ts';
import {ModelControls} from "@/components/ModelControls.tsx";
import {IconButton} from '@/components/IconButton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';

const DRAWER_WIDTH = 380;

// ─── Module-level refs for the window API ───

let drawerDispatch: ((action: SchemaAction) => void) | null = null;
let getActiveSchemaFn: (() => Schema | null) = () => null;
let setOpenFn: ((value: boolean | ((prev: boolean) => boolean)) => void) | null = null;

interface MlHighlight { id: string; classId: string; coords: PdfBox[]; source: 'ml'; text?: string }

// Module-level accumulator for ML highlights (set directly via highlights API, no React state needed)
let mlHighlights: MlHighlight[] = [];

async function runSegmentationPipeline() {
  console.log('[drawer] Drawing segmentation boxes');
  if (!window.TractorBeamTextExtraction) {
    console.error('[drawer] TractorBeamTextExtraction not available');
    return;
  }

  console.log('[drawer] Extracting visual blocks...');
  const PDFViewerApplication = window.PDFViewerApplication;
  const blocks = await window.TractorBeamTextExtraction.extractVisualBlocks(PDFViewerApplication);
  console.log(`[drawer] Extracted ${blocks.length} visual blocks`);

  window.TractorBeamHighlights.setHighlights('layout', blocks.map((block) => {
    const superBlock = mergePdfBoxes(block.items.map((item) => item.box));
    return {
      id: block.blockId,
      classId: VISUAL_BLOCK_CLASS_ID,
      schemaId: "visual",
      color: "visual",
      coords: [superBlock],
      positiveExample: true,
  }}));

}

async function loadCachedAnnotations(schemaId: string, pdfUrl: string) {
  console.log('[drawer] Loading cached annotations from IndexedDB');
  const runs = await getMlAnnotationRuns(APP_CONFIG.indexedDBConfig, schemaId, pdfUrl);
  if (runs.length === 0) {
    console.log('[drawer] No cached annotation runs found');
    return;
  }
  const mostRecent = runs.sort((a, b) => b.createdAt - a.createdAt)[0];
  console.log(`[drawer] Loaded cached run ${mostRecent.id} with ${mostRecent.annotations.length} annotations`);
  mlHighlights = mostRecent.annotations.map((a) => ({
    id: a.id,
    classId: a.classId,
    coords: a.coords,
    source: 'ml' as const,
    text: a.text,
  }));
  syncProvisionalHighlights();
}

/** Map raw ML highlights to colored Highlight objects and push to the highlights module. */
function syncProvisionalHighlights() {
  if (!window.TractorBeamHighlights) return;
  const schema = getActiveSchemaFn();
  if (!schema) return;
  const colorsByClass = schema.classes.reduce((acc: Record<string, string>, cls) => { acc[cls.id] = cls.color; return acc; }, {});
  const highlights: Highlight[] = mlHighlights.map((h) => ({ ...h, schemaId: schema.id, color: colorsByClass[h.classId], positiveExample: true}));
  console.log(`[drawer] provisional highlight sync: ${highlights.length} ML`);
  window.TractorBeamHighlights.setHighlights('provisional', highlights);
}

// ─── Pipeline orchestration (called via window API) ───
async function runAnnotationPipeline(schema: Schema, requestId: string) {
  console.log('[drawer] Starting annotation pipeline:', requestId);

  // Reset ML highlights for the new run
  mlHighlights = [];
  syncProvisionalHighlights();

  // 1. Extract visual blocks directly from the in-page API
  if (!window.TractorBeamTextExtraction) {
    console.error('[drawer] TractorBeamTextExtraction not available');
    return;
  }
  const PDFViewerApplication = window.PDFViewerApplication;
  if (!PDFViewerApplication) {
    console.error('[drawer] PDFViewerApplication not available');
    return;
  }

  console.log('[drawer] Extracting visual blocks...');
  const blocks = await window.TractorBeamTextExtraction.extractVisualBlocks(PDFViewerApplication);
  console.log(`[drawer] Extracted ${blocks.length} visual blocks`);


  // 2. Ensure the offscreen document is ready
  await chrome.runtime.sendMessage({ type: 'ensureOffscreen' }).catch(() => {
    console.warn('[drawer] ensureOffscreen failed — offscreen may already exist');
  });

  // 3. Read model config and send the complete message to the offscreen document
  const modelConfig = await getModelConfig();
  const claudeApiKey = modelConfig.provider === 'claude' ? await getClaudeApiKey() ?? undefined : undefined;
  const ollamaBaseUrl = modelConfig.provider === 'ollama' ? await getOllamaBaseUrl() ?? undefined : undefined;

  chrome.runtime.sendMessage({
    type: 'runAnnotationPipeline',
    requestId,
    schema,
    blocks,
    modelConfig,
    claudeApiKey,
    ollamaBaseUrl,
  }).catch((err) => {
    console.error('[drawer] Failed to send runAnnotationPipeline:', err);
  });
}

function cancelAnnotationPipeline(requestId: string) {
  console.log('[drawer] Cancelling annotation pipeline:', requestId);
  chrome.runtime.sendMessage({
    type: 'cancelAnnotationPipeline',
    requestId,
  }).catch(() => {console.log("Failed to cancel annotation!")});
}

// ─── React components ───

function DrawerContainer() {
  const [initialState, setInitialState] = useState<Schema[] | null>(null);
  const [isOpen, setIsOpen] = useState(() => {
    return localStorage.getItem('tractor-beam-drawer-open') !== 'false';
  });
  // Load initial schema state from IndexedDB
  useEffect(() => {
    void getStates(APP_CONFIG.indexedDBConfig).then((request) => {
      request.onsuccess = () => setInitialState(request.result);
    });
  }, []);

  // Persist open/closed state
  useEffect(() => {
    localStorage.setItem('tractor-beam-drawer-open', String(isOpen));
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

  // Expose setIsOpen for the window API
  useEffect(() => {
    setOpenFn = setIsOpen;
    return () => { setOpenFn = null; };
  }, []);

  const toggle = () => setIsOpen(prev => !prev);

  if (!initialState) {
    return (
      <>
        <SidebarVisibilityToggle isOpen={isOpen} onToggle={toggle} />
        <div className={`tractor-beam-drawer ${isOpen ? 'open' : ''}`}>
          <div className="p-4 text-sm text-gray-500">Loading...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <SidebarVisibilityToggle isOpen={isOpen} onToggle={toggle} />
      <div className={`tractor-beam-drawer ${isOpen ? 'open' : ''}`}>
        <DrawerContent initialSchemas={initialState} />
      </div>
    </>
  );
}

function SidebarVisibilityToggle({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  return (
    <div className={`tractor-beam-toggle-tab ${isOpen ? 'drawer-open' : ''}`}>
      <button onClick={onToggle} title={isOpen ? 'Collapse panel' : 'Open panel'}>
        <span className="chevron">&#x276E;</span>
      </button>
    </div>
  );
}

function SchemaHeader({
  activeSchema,
  schemas,
  editing,
  onEditingChange,
  onRename,
  onSwitch,
  onNew,
}: {
  activeSchema: Schema | null;
  schemas: Schema[];
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onRename: (name: string) => void;
  onSwitch: (id: string) => void;
  onNew: () => void;
}) {
  const titleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editing) return;
    const handler = (e: MouseEvent) => {
      if (titleRef.current && !titleRef.current.contains(e.target as Node)) {
        onEditingChange(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editing, onEditingChange]);

  if (!activeSchema) return null;

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-gray-200">
      <div
        ref={titleRef}
        className="w-fit"
        onClick={() => { if (!editing) onEditingChange(true); }}
      >
        {editing ? (
          <input
            autoFocus
            placeholder="Schema name"
            className="border-2 bg-white text-base px-1 py-0.5 rounded"
            value={activeSchema.name}
            onChange={(e) => onRename(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onEditingChange(false); }}
          />
        ) : (
          <div className="flex items-center gap-1 group cursor-pointer">
            <span className="text-base">{activeSchema.name || 'Untitled schema'}</span>
            <PencilLine strokeWidth={1} size={16} className="invisible group-hover:visible shrink-0" />
          </div>
        )}
      </div>
      <div className="ml-auto flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger>
            <IconButton title="Switch schema" icon={ArrowLeftRight} size="icon-sm" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {schemas.map((s) => (
              <DropdownMenuItem key={s.id} onClick={() => onSwitch(s.id)}>
                {s.name || 'Untitled schema'}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <IconButton title="New schema" icon={Plus} size="icon-sm" onClick={onNew} />
      </div>
    </div>
  );
}
function DrawerContent({ initialSchemas }: { initialSchemas: Schema[] }) {
  const [schemas, dispatch] = usePersistedReducer<Schema[], SchemaAction>(
    schemasReducer,
    initialSchemas,
    APP_CONFIG.indexedDBConfig,
  );
  const [llmLoaded, setLlmLoaded] = useState({ stage: 'unloaded', progress: '', message: '' });


  const pdfUrl = new URLSearchParams(window.location.search).get('file') ?? '';
  const [activeSchemaId, setActiveSchemaId] = useState<string>(schemas[0]?.id ?? '');
  const activeSchema = schemas.find(s => s.id === activeSchemaId) ?? schemas[0];
  const [titleEditing, setTitleEditing] = useState<boolean>(false);

  // Expose refs for the window API
  useEffect(() => {
    drawerDispatch = dispatch;
    getActiveSchemaFn = () => activeSchema ?? null;
    return () => {
      drawerDispatch = null;
      getActiveSchemaFn = () => null;
    };
  }, [dispatch, activeSchema]);

  // Listen for messages from offscreen document (ML results)
  useEffect(() => {
    const listener = (message: ExtensionMessage) => {
      switch (message.type) {
        case 'mlProgress':
          setLlmLoaded({ stage: message.stage, progress: String(message.progress), message: message.message ?? '' });
          break;
        case 'annotationResults':
          if (message.annotations && message.requestId) {
            // Store for later review
            storeMlAnnotationRun(APP_CONFIG.indexedDBConfig, {
              id: message.requestId,
              pdfUrl: pdfUrl,
              schemaId: activeSchema?.id ?? '',
              annotations: message.annotations,
              createdAt: Date.now(),
            }).catch((err: unknown) => console.error('[drawer] Failed to store ML annotations:', err));

            // Accumulate and render ML annotations as provisional highlights
            const newMlHighlights: MlHighlight[] = message.annotations.map((a) => ({
              id: a.id,
              classId: a.classId,
              coords: a.coords,
              source: 'ml' as const,
              text: a.text,
            }));
            mlHighlights = [...mlHighlights, ...newMlHighlights];
            syncProvisionalHighlights();
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
    const instances: Highlight[] = [];

    if (activeSchema) {
      for (const cls of activeSchema.classes) {
        for (const inst of cls.instances) {
          if (inst.coords && inst.pdfUrl === pdfUrl) {
            instances.push({ id: inst.id, classId: cls.id, schemaId: activeSchema.id, coords: inst.coords, source: 'manual', color: cls.color, positiveExample: inst.positiveExample});
          }
        }
      }
    }

    console.log(`[drawer] confirmed highlight sync: ${instances.length} manual, pdfUrl="${pdfUrl}"`);
    window.TractorBeamHighlights.setHighlights('confirmed', instances);
  }, [schemas, activeSchema, pdfUrl]);

  return (
    <DrawerContext.Provider value={{ activeSchema, pdfUrl, dispatch }}>
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
          setActiveSchemaId(id);
          setTitleEditing(false);
        }}
        onNew={() => {
          const newSchema = createNewSchema('');
          dispatch({ actionType: 'addSchema', schema: newSchema });
          setActiveSchemaId(newSchema.id);
          setTitleEditing(true);
        }}
      />
      <div className="flex flex-col h-full overflow-scroll">
      <Tabs defaultValue="schema">
        <TabsList className="w-full">
          <TabsTrigger value={"schema"}><Layers2Icon/> Schema Editor</TabsTrigger>
          <TabsTrigger value={"navigation"}><SignpostIcon/>Semantic Index</TabsTrigger>
        </TabsList>
        <TabsContent value={"schema"}>
          <SchemaViewer schema={activeSchema} dispatch={dispatch} llmStatus={llmLoaded} />
        </TabsContent>
        <TabsContent value={"navigation"}>
          <div>wazoop</div>
        </TabsContent>
      </Tabs>
      </div>
      <div className="shrink-0">
        <ModelControls status={llmLoaded.stage} progress={llmLoaded.progress} message={llmLoaded.message} />
      </div>
    </DrawerContext.Provider>
  );
}

// ─── Window API ───

declare global {
  interface Window {
    TractorBeamDrawer: {
      toggle: () => void;
      open: () => void;
      close: () => void;
      dispatch: (action: SchemaAction) => void;
      getActiveSchema: () => Schema | null;
      getInstance: (schemaId: string, classId: string, instanceId: string) => Instance | null;
      runAnnotationPipeline: (schema: Schema, requestId: string) => Promise<void>;
      runSegmentationPipeline: () => Promise<void>;
      loadCachedAnnotations: (schemaId: string, pdfUrl: string) => Promise<void>;
      cancelAnnotationPipeline: (requestId: string) => void;
    };
  }
}

// ─── Initialization ───

let root: Root | null = null;

function init() {
  const style = document.createElement('style');
  style.textContent = cssText;
  document.head.appendChild(style);

  const container = document.createElement('div');
  container.id = 'tractor-beam-drawer-root';
  document.body.appendChild(container);

  root = createRoot(container);
  root.render(<DrawerContainer />);

  window.TractorBeamDrawer = {
    toggle: () => setOpenFn?.((prev: boolean) => !prev),
    open: () => setOpenFn?.(true),
    close: () => setOpenFn?.(false),
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

  console.log('[pdfjs-additions] Drawer initialized');
}

export function initDrawer() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
