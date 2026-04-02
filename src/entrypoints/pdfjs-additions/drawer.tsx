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
import { getStates, storeMlAnnotationRun } from '@/lib/schema-storage';
import { APP_CONFIG } from '@/app-config';
import { Schema, PdfBox } from '@/lib/definitions';
import { schemasReducer, SchemaAction } from '@/lib/schema-reducer';
import { usePersistedReducer } from '@/hooks/persisted-reducer';
import type { ExtensionMessage } from '@/lib/messaging/message_definitions';
import { getModelConfig, getClaudeApiKey, getOllamaBaseUrl } from '@/lib/ml/config';
import cssText from './drawer-styles.css?inline';
import {mergePdfBoxes} from "@/lib/utils.ts";

const DRAWER_WIDTH = 380;

// ─── Module-level refs for the window API ───

let drawerDispatch: ((action: SchemaAction) => void) | null = null;
let getActiveSchemaFn: (() => Schema | null) = () => null;
let setOpenFn: ((value: boolean | ((prev: boolean) => boolean)) => void) | null = null;
let setMlHighlightsFn: ((fn: (prev: MlHighlight[]) => MlHighlight[]) => void) | null = null;

interface MlHighlight { id: string; classId: string; coords: PdfBox[]; source: 'ml'; text?: string }

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

  window.TractorBeamHighlights.setHighlights(blocks.map((block) => {
    const superBlock = mergePdfBoxes(block.items.map((item) => item.box));
    return {
    id: block.blockId,
    classId: VISUAL_BLOCK_CLASS_ID,
    coords: [superBlock]
  }}));

}

// ─── Pipeline orchestration (called via window API) ───
async function runAnnotationPipeline(schema: Schema, requestId: string) {
  console.log('[drawer] Starting annotation pipeline:', requestId);

  // Reset ML highlights for the new run
  setMlHighlightsFn?.(() => []);

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
  const [mlHighlights, setMlHighlights] = useState<MlHighlight[]>([]);

  const activeSchema = schemas[0];

  // Expose refs for the window API
  useEffect(() => {
    drawerDispatch = dispatch;
    getActiveSchemaFn = () => activeSchema ?? null;
    setMlHighlightsFn = setMlHighlights;
    return () => {
      drawerDispatch = null;
      getActiveSchemaFn = () => null;
      setMlHighlightsFn = null;
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
              pdfUrl: '',
              schemaId: activeSchema?.id ?? '',
              annotations: message.annotations,
              createdAt: Date.now(),
            }).catch((err: unknown) => console.error('[drawer] Failed to store ML annotations:', err));

            // Render ML annotations as highlights
            const newMlHighlights: MlHighlight[] = message.annotations.map((a) => ({
              id: a.id,
              classId: a.classId,
              coords: a.coords,
              source: 'ml' as const,
              text: a.text,
            }));
            setMlHighlights(prev => [...prev, ...newMlHighlights]);
          }
          break;
      }
    };
    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  }, [activeSchema]);

  // Push highlights directly to the in-page highlights module
  useEffect(() => {
    if (!window.TractorBeamHighlights) return;

    const pdfUrl = new URLSearchParams(window.location.search).get('file') ?? '';
    const instances: { id: string; classId: string; coords: PdfBox[]; source?: 'manual' | 'ml'; text?: string, color: string }[] = [];

    if (activeSchema) {
      for (const cls of activeSchema.classes) {
        for (const inst of cls.instances) {
          if (inst.coords && inst.pdfUrl === pdfUrl) {
            instances.push({ id: inst.id, classId: cls.id, coords: inst.coords, source: 'manual', color: cls.color});
          }
        }
      }
    }

    const colorsByClass = activeSchema.classes.reduce((colorsByClass: Record<string, string>, currentClass) => {colorsByClass[currentClass.id] = currentClass.color; return colorsByClass}, {});
    const mlInstances: { id: string; classId: string; coords: PdfBox[]; source?: 'ml'; text?: string, color: string }[] = mlHighlights.map((highlight) => ({...highlight, color: colorsByClass[highlight.classId]}));
    // Merge in ML highlights
    const allInstances = [...instances, ...mlInstances];
    console.log(`[drawer] highlight sync: ${instances.length} manual, ${mlHighlights.length} ML, pdfUrl="${pdfUrl}"`);

    window.TractorBeamHighlights.setHighlights(allInstances);
    window.TractorBeamHighlights.renderAll();
  }, [schemas, activeSchema, mlHighlights]);

  return (
    <SchemaViewer schemas={schemas} dispatch={dispatch} llmStatus={llmLoaded} />
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
