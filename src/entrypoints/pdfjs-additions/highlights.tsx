/**
 * Highlight rendering — React-based with portals into per-page containers.
 * Exposes window.TractorBeamHighlights API (same contract as before, plus clearContainers).
 */

import { createRoot, Root } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { PageHighlights } from '@/components/PageHighlights';
import cssText from './popover-styles.css?inline';

interface PdfBox {
  pageNumber: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Highlight {
  id: string;
  classId: string;
  coords: PdfBox[];
  source?: 'manual' | 'ml';
  text?: string;
}

declare global {
  interface Window {
    TractorBeamHighlights: {
      setHighlights: (highlights: Highlight[]) => void;
      renderPage: (pageNumber: number) => void;
      renderAll: () => void;
      clearContainers: () => void;
    };
  }
}

// ─── Module-level state ───

let highlights: Highlight[] = [];
let pageContainers = new Map<number, HTMLElement>();
let root: Root | null = null;

// ─── React root component ───

function HighlightsRoot({
  highlights,
  pageContainers,
}: {
  highlights: Highlight[];
  pageContainers: Map<number, HTMLElement>;
}) {
  return (
    <>
      {Array.from(pageContainers.entries()).map(([pageNumber, container]) =>
        createPortal(
          <PageHighlights
            key={pageNumber}
            pageNumber={pageNumber}
            highlights={highlights}
          />,
          container,
        ),
      )}
    </>
  );
}

function render() {
  if (!root) return;
  console.log(`[highlights] render(): ${highlights.length} highlights, ${pageContainers.size} containers`);
  if (highlights.length > 0) {
    console.log('[highlights] First highlight:', JSON.stringify(highlights[0]));
  }
  root.render(
    <HighlightsRoot
      highlights={highlights}
      pageContainers={new Map(pageContainers)}
    />
  );
  // Check DOM after render
  setTimeout(() => {
    const hostEl = document.getElementById('tractor-beam-highlights-root');
    const rects = hostEl?.querySelectorAll('[style*="position: absolute"]');
    console.log(`[highlights] After render: ${rects?.length ?? 0} positioned elements in highlight root`);
  }, 100);
}

// ─── Public API ───

function ensureContainer(pageNumber: number): HTMLElement | null {
  if (pageContainers.has(pageNumber)) return pageContainers.get(pageNumber)!;

  const pageEl = document.querySelector(
    `.page[data-page-number="${pageNumber}"]`,
  ) as HTMLElement | null;
  if (!pageEl) return null;

  let container = pageEl.querySelector(
    '.tractor-beam-highlights',
  ) as HTMLElement | null;
  if (!container) {
    container = document.createElement('div');
    container.className = 'tractor-beam-highlights';
    container.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;';
    pageEl.style.position = 'relative';
    pageEl.appendChild(container);
  }

  pageContainers.set(pageNumber, container);
  return container;
}

function setHighlights(newHighlights: Highlight[]) {
  highlights = newHighlights;
}

function renderPage(pageNumber: number) {
  ensureContainer(pageNumber);
  render();
}

function renderAll() {
  const pages = document.querySelectorAll('.page[data-page-number]');
  console.log(`[highlights] renderAll: ${pages.length} pages found, ${highlights.length} highlights`);
  for (const pageEl of pages) {
    const pageNumber = parseInt(pageEl.getAttribute('data-page-number')!, 10);
    ensureContainer(pageNumber);
  }
  console.log(`[highlights] ${pageContainers.size} page containers ready`);
  render();
}

function clearContainers() {
  pageContainers = new Map();
  render();
}

// ─── Initialization ───

export function initHighlights() {
  // Inject Tailwind utilities (same approach as popover.tsx)
  const style = document.createElement('style');
  style.textContent = cssText;
  document.head.appendChild(style);

  const hostEl = document.createElement('div');
  hostEl.id = 'tractor-beam-highlights-root';
  document.body.appendChild(hostEl);
  root = createRoot(hostEl);

  window.TractorBeamHighlights = {
    setHighlights,
    renderPage,
    renderAll,
    clearContainers,
  };

  console.log('[pdfjs-additions] Highlights initialized (React)');
}
