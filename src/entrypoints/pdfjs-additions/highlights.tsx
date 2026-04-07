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

export interface Highlight {
  id: string;
  classId: string;
  schemaId: string;
  coords: PdfBox[];
  source?: 'manual' | 'ml';
  text?: string;
  color: string;
}

export type HighlightType = 'confirmed' | 'provisional' | 'layout';

declare global {
  interface Window {
    TractorBeamHighlights: {
      setHighlights: (highlightType: HighlightType, highlights: Highlight[]) => void;
      renderPage: (pageNumber: number) => void;
      renderAll: () => void;
      clearContainers: () => void;
    };
  }
}

// ─── Module-level state ───

const highlights: Record<HighlightType, Highlight[]> = {
  confirmed: [],
  provisional: [],
  layout: [],
};
let pageContainers = new Map<number, HTMLElement>();
let root: Root | null = null;

// ─── React root component ───

function allHighlights(): Highlight[] {
  return Object.values(highlights).flat();
}

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
  const mergedHighlights = allHighlights();
  console.log(`[highlights] render(): ${mergedHighlights.length} highlights, ${pageContainers.size} containers`);
  root.render(
    <HighlightsRoot
      highlights={mergedHighlights}
      pageContainers={new Map(pageContainers)}
    />
  );
}

// ─── Public API ───

function ensureContainer(pageNumber: number): HTMLElement | null {
  // Check if cached container is still in the DOM (PDF.js may remove it on re-render)
  const cached = pageContainers.get(pageNumber);
  if (cached?.isConnected) return cached;

  const pageEl = document.querySelector(
    `.page[data-page-number="${pageNumber}"]`,
  );
  if (!pageEl) return null;

  let container = pageEl.querySelector(
    '.tractor-beam-highlights',
  );
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

function setHighlights(highlightType: HighlightType, newHighlights: Highlight[]) {
  highlights[highlightType] = newHighlights;
  render();
}

function renderPage(pageNumber: number) {
  ensureContainer(pageNumber);
  render();
}

function renderAll() {
  const pages = document.querySelectorAll('.page[data-page-number]');
  console.log(`[highlights] renderAll: ${pages.length} pages found, ${allHighlights().length} highlights`);
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
