/**
 * In-page drawer — renders the SchemaViewer inside a collapsible
 * right-side panel within the PDF viewer page (Hypothesis-style).
 *
 * Exposes window.TractorBeamDrawer API, including annotation pipeline
 * orchestration (visual block extraction → offscreen ML → highlight rendering).
 */

import { useState, useEffect } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { SchemaViewer } from '@/components/SchemaViewer';
import { getStates, storeMlAnnotationRun, getMlAnnotationRuns } from '@/lib/schema-storage';
import { APP_CONFIG } from '@/app-config';
import { Schema, PdfBox } from '@/lib/definitions';
import { schemasReducer, SchemaAction } from '@/lib/schema-reducer';
import { usePersistedReducer } from '@/hooks/persisted-reducer';
import type { ExtensionMessage } from '@/lib/messaging/message_definitions';
import { getModelConfig, getClaudeApiKey, getOllamaBaseUrl } from '@/lib/ml/config';
import { DrawerContext } from '@/contexts/DrawerContext';
import cssText from './drawer-styles.css?inline';
import {mergePdfBoxes} from "@/lib/utils.ts";
import { VISUAL_BLOCK_CLASS_ID } from '@/components/Highlight.tsx';
import type { Highlight } from '@/entrypoints/pdfjs-additions/highlights.tsx';

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
      coords: [superBlock]
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
  const highlights: Highlight[] = mlHighlights.map((h) => ({ ...h, schemaId: schema.id, color: colorsByClass[h.classId] }));
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
  const PDFViewerApplication = (window as any).PDFViewerApplication;
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
  }).catch(() => {});
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
        <ToggleTab isOpen={isOpen} onToggle={toggle} />
        <div className={`tractor-beam-drawer ${isOpen ? 'open' : ''}`}>
          <div className="p-4 text-sm text-gray-500">Loading...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <ToggleTab isOpen={isOpen} onToggle={toggle} />
      <div className={`tractor-beam-drawer ${isOpen ? 'open' : ''}`}>
        <DrawerContent initialSchemas={initialState} />
      </div>
    </>
  );
}

function ToggleTab({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  return (
    <div className={`tractor-beam-toggle-tab ${isOpen ? 'drawer-open' : ''}`}>
      <button onClick={onToggle} title={isOpen ? 'Collapse panel' : 'Open panel'}>
        <span className="chevron">&#x276E;</span>
      </button>
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
      <SchemaViewer schemas={schemas} dispatch={dispatch} llmStatus={llmLoaded} onActiveSchemaChange={setActiveSchemaId} />
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
