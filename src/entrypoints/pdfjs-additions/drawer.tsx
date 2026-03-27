/**
 * In-page drawer — renders the SchemaViewer inside a collapsible
 * right-side panel within the PDF viewer page (Hypothesis-style).
 * Exposes window.TractorBeamDrawer API.
 */

import { createRoot, Root } from 'react-dom/client';
import { SchemaViewer } from '@/components/SchemaViewer';
import { getStates, storeMlAnnotationRun } from '@/lib/schema-storage';
import { APP_CONFIG } from '@/app-config';
import { Schema, PdfBox } from '@/lib/definitions';
import { schemasReducer, SchemaAction } from '@/lib/schema-reducer';
import { generateId } from '@/lib/utils';
import { usePersistedReducer } from '@/hooks/persisted-reducer';
import type { ExtensionMessage } from '@/lib/messaging/message_definitions';
import cssText from './drawer-styles.css?inline';

const DRAWER_WIDTH = 380;

// ─── Module-level refs for the window API ───

let drawerDispatch: ((action: SchemaAction) => void) | null = null;
let getActiveSchemaFn: (() => Schema | null) = () => null;
let setOpenFn: ((value: boolean | ((prev: boolean) => boolean)) => void) | null = null;

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
  // #mainContainer uses position:absolute + inset:0, so we push its right edge
  // inward by setting inset-inline-end (right) to the drawer width.
  useEffect(() => {
    const mainContainer = document.getElementById('mainContainer');
    if (mainContainer) {
      mainContainer.style.transition = 'right 0.25s ease-in-out';
      mainContainer.style.right = isOpen ? `${DRAWER_WIDTH}px` : '0px';
    }
    // Trigger PDF.js to recalculate viewport after transition
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

  const activeSchema = schemas[0];

  // Expose dispatch and getActiveSchema for the window API
  useEffect(() => {
    drawerDispatch = dispatch;
    getActiveSchemaFn = () => activeSchema ?? null;
    return () => {
      drawerDispatch = null;
      getActiveSchemaFn = () => null;
    };
  }, [dispatch, activeSchema]);

  // Listen for messages from background/offscreen
  useEffect(() => {
    const listener = (message: ExtensionMessage) => {
      switch (message.type) {
        case 'addInstance':
          dispatch({
            actionType: 'addInstance',
            schemaId: message.schemaId,
            classId: message.classId,
            instance: {
              id: generateId(),
              instanceType: 'text',
              text: message.text,
              range: null,
              coords: message.coords ?? null,
              pdfUrl: message.pdfUrl ?? '',
            },
          });
          break;
        case 'deleteInstance':
          dispatch({
            actionType: 'deleteInstance',
            classId: message.classId,
            instanceId: message.highlightId,
          });
          break;
        case 'mlProgress':
          setLlmLoaded({ stage: message.stage, progress: String(message.progress), message: message.message ?? '' });
          break;
        case 'annotationResults':
          if (message.annotations && message.requestId) {
            storeMlAnnotationRun(APP_CONFIG.indexedDBConfig, {
              id: message.requestId,
              pdfUrl: '',
              schemaId: activeSchema?.id ?? '',
              annotations: message.annotations,
              createdAt: Date.now(),
            }).catch((err: unknown) => console.error('[drawer] Failed to store ML annotations:', err));
          }
          break;
      }
    };
    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  }, [dispatch, activeSchema]);

  // Push highlights directly to the in-page highlights module
  useEffect(() => {
    if (!window.TractorBeamHighlights) return;

    const pdfUrl = new URLSearchParams(window.location.search).get('file') ?? '';
    const instances: { id: string; classId: string; coords: PdfBox[]; source?: 'manual' | 'ml' }[] = [];

    if (activeSchema) {
      for (const cls of activeSchema.classes) {
        for (const inst of cls.instances) {
          if (inst.coords && inst.pdfUrl === pdfUrl) {
            instances.push({ id: inst.id, classId: cls.id, coords: inst.coords, source: 'manual' });
          }
        }
      }
    }

    window.TractorBeamHighlights.setHighlights(instances);
    window.TractorBeamHighlights.renderAll();
  }, [schemas, activeSchema]);

  // Sync active schema to background (still needed for ML pipeline)
  useEffect(() => {
    chrome.runtime.sendMessage({
      type: 'setActiveSchema',
      schema: activeSchema,
    }).catch(() => { /* background may not be ready */ });
  });

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
