/**
 * Highlight rendering logic extracted from pdfjs-init.js.
 * Exposes window.TractorBeamHighlights API.
 */

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
}

declare global {
  interface Window {
    TractorBeamHighlights: {
      setHighlights: (highlights: Highlight[]) => void;
      renderPage: (pageNumber: number) => void;
      renderAll: () => void;
    };
  }
}

let highlights: Highlight[] = [];

const COLORS = [
  'rgba(255, 182, 193, 0.3)', // pink
  'rgba(255, 218, 185, 0.3)', // peach
  'rgba(255, 255, 186, 0.3)', // yellow
  'rgba(186, 255, 201, 0.3)', // mint
  'rgba(186, 225, 255, 0.3)', // sky blue
  'rgba(216, 191, 255, 0.3)', // lavender
  'rgba(255, 200, 221, 0.3)', // rose
  'rgba(200, 255, 240, 0.3)', // aqua
  'rgba(255, 228, 196, 0.3)', // bisque
  'rgba(230, 230, 250, 0.3)', // periwinkle
];

function hashId(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getHighlightColor(classId: string): string {
  return COLORS[hashId(classId) % COLORS.length];
}

function renderPage(pageNumber: number) {
  const pageEl = document.querySelector(`.page[data-page-number="${pageNumber}"]`) as HTMLElement | null;
  if (!pageEl) return;

  let container = pageEl.querySelector('.tractor-beam-highlights') as HTMLElement | null;
  if (!container) {
    container = document.createElement('div');
    container.className = 'tractor-beam-highlights';
    container.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;';
    pageEl.style.position = 'relative';
    pageEl.appendChild(container);
  }

  container.innerHTML = '';

  for (const hl of highlights) {
    if (!hl.coords) continue;
    const color = getHighlightColor(hl.classId);
    for (const box of hl.coords) {
      if (box.pageNumber !== pageNumber) continue;
      const div = document.createElement('div');
      div.style.cssText = `position:absolute;left:${box.left * 100}%;top:${box.top * 100}%;width:${box.width * 100}%;height:${box.height * 100}%;background:${color};border-radius:2px;mix-blend-mode:multiply;`;
      container.appendChild(div);
    }
  }
}

function renderAll() {
  const pages = document.querySelectorAll('.page[data-page-number]');
  for (const pageEl of pages) {
    const pageNumber = parseInt(pageEl.getAttribute('data-page-number')!, 10);
    renderPage(pageNumber);
  }
}

function setHighlights(newHighlights: Highlight[]) {
  highlights = newHighlights;
}

export function initHighlights() {
  window.TractorBeamHighlights = {
    setHighlights,
    renderPage,
    renderAll,
  };
  console.log('[pdfjs-additions] Highlights initialized');
}
