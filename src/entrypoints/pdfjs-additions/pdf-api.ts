/**
 * The single seam between the vendored pdf.js viewer and our React code: everything
 * that reaches into `PDFViewerApplication` / the pdf.js document lives here and is
 * exposed as `window.TractorBeamPdf`. Pure logic (coordinate mapping, visual-block
 * segmentation) lives in `@/lib/pdf/*` and is testable without a browser; this module
 * is only the impure adapter that pulls data out of the viewer and delegates.
 */

import type { VisualBlock } from '@/lib/definitions';
import { itemToNormalizedBox, type PdfTextItem } from '@/lib/pdf/coords';
import { groupItemsIntoBlocks } from '@/lib/pdf/visual-blocks';

export interface PageMetric {
  pageNumber: number;
  width: number; // pdf points (scale 1.0)
  height: number;
}

export interface RenderRegionOptions {
  pageNumber: number;
  top: number; // normalized 0–1, top edge of the slice
  height: number; // normalized 0–1
  left?: number; // normalized 0–1, default 0 (full width)
  width?: number; // normalized 0–1, default 1
  scale?: number; // render scale (canvas px per pdf point); default RENDER_SCALE
  // CSS px the *full page width* should occupy on screen. When set, the render scale
  // is derived from the page's true width (× devicePixelRatio) so the output is sharp
  // at that display size regardless of the page's intrinsic dimensions. Overrides `scale`.
  targetWidthPx?: number;
}

export interface RenderRegionResult {
  dataUrl: string;
  width: number; // px
  height: number; // px
}

declare global {
  interface Window {
    TractorBeamPdf: {
      extractFullText: (
        PDFViewerApplication: any,
      ) => Promise<{ pageNumber: number; text: string }[]>;
      extractVisualBlocks: (PDFViewerApplication: any) => Promise<VisualBlock[]>;
      getPageMetrics: () => Promise<{ numPages: number; pages: PageMetric[] }>;
      renderRegion: (opts: RenderRegionOptions) => Promise<RenderRegionResult>;
    };
  }
}

// `window.PDFViewerApplication` is declared elsewhere (drawer-host.ts) with a narrow
// `{ pdfDocument: unknown }` shape; access the pdf.js document through a local cast so
// this module can call the untyped viewer API without re-declaring (and conflicting on)
// the global.
function getPdfDocument(): any {
  return (window as unknown as { PDFViewerApplication?: any }).PDFViewerApplication?.pdfDocument;
}

async function extractFullText(
  PDFViewerApplication: any,
): Promise<{ pageNumber: number; text: string }[]> {
  const pdfDoc = PDFViewerApplication.pdfDocument;
  if (!pdfDoc) throw new Error('No PDF document loaded');

  const numPages = pdfDoc.numPages;
  const pages: { pageNumber: number; text: string }[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .filter((item: any) => item.str !== undefined)
      .map((item: any) => item.str)
      .join('');
    pages.push({ pageNumber: i, text });
  }

  return pages;
}

async function extractVisualBlocks(PDFViewerApplication: any): Promise<VisualBlock[]> {
  const pdfDoc = PDFViewerApplication.pdfDocument;
  if (!pdfDoc) throw new Error('No PDF document loaded');

  const numPages = pdfDoc.numPages;
  const allBlocks: VisualBlock[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });

    // Impure: pull items from pdf.js and map to normalized boxes. Segmentation is pure
    // (@/lib/pdf/visual-blocks).
    const items = textContent.items
      .filter((item: any) => item.str !== undefined && item.str.trim() !== '')
      .filter((item: any) => item.transform[1] === 0 && item.transform[2] === 0)
      .map((item: PdfTextItem) => ({
        str: item.str,
        box: { ...itemToNormalizedBox(item, viewport.height, viewport.width), pageNumber: i },
      }));

    allBlocks.push(...groupItemsIntoBlocks(items, i));
  }

  console.log(`[pdf-api] Extracted ${allBlocks.length} visual blocks from ${numPages} pages`);
  return allBlocks;
}

async function getPageMetrics(): Promise<{ numPages: number; pages: PageMetric[] }> {
  const pdfDoc = getPdfDocument();
  if (!pdfDoc) throw new Error('No PDF document loaded');

  const numPages: number = pdfDoc.numPages;
  const pages: PageMetric[] = [];
  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: 1.0 });
    pages.push({ pageNumber: i, width: viewport.width, height: viewport.height });
  }
  return { numPages, pages };
}

// ─── Region rendering (hover preview now; citation/link previews later) ──────

// Render at 2× so the now-larger (≈half-width) hover preview stays crisp rather than
// upscaling a smaller canvas. Cached per page, so the cost is paid once.
const RENDER_SCALE = 2;
const MAX_PAGE_CACHE = 6;

// Insertion-ordered LRU of fully-rendered page canvases, keyed by `${page}@${scale}`.
// Rendering a page is the expensive step; cropping a band out of a cached canvas is
// cheap, so repeat hovers over one page stay fast.
const pageCanvasCache = new Map<string, HTMLCanvasElement>();

async function getPageCanvas(
  pdfDoc: any,
  pageNumber: number,
  scale: number,
): Promise<HTMLCanvasElement> {
  const key = `${pageNumber}@${scale}`;
  const cached = pageCanvasCache.get(key);
  if (cached) {
    pageCanvasCache.delete(key); // refresh recency
    pageCanvasCache.set(key, cached);
    return cached;
  }

  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  // This vendored pdf.js (v4+) takes `canvas` directly and manages its 2D context.
  await page.render({ canvas, viewport }).promise;

  pageCanvasCache.set(key, canvas);
  while (pageCanvasCache.size > MAX_PAGE_CACHE) {
    const oldest = pageCanvasCache.keys().next().value;
    if (oldest === undefined) break;
    pageCanvasCache.delete(oldest);
  }
  return canvas;
}

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

async function renderRegion(opts: RenderRegionOptions): Promise<RenderRegionResult> {
  const pdfDoc = getPdfDocument();
  if (!pdfDoc) throw new Error('No PDF document loaded');

  let scale = opts.scale ?? RENDER_SCALE;
  if (opts.targetWidthPx) {
    // Derive scale from the page's true width so a full-width render lands at exactly
    // targetWidthPx × DPR device pixels — crisp at that display size.
    const page = await pdfDoc.getPage(opts.pageNumber);
    const baseWidth = page.getViewport({ scale: 1 }).width;
    const dpr = window.devicePixelRatio || 1;
    scale = (opts.targetWidthPx * dpr) / baseWidth;
  }
  const left = clamp01(opts.left ?? 0);
  const top = clamp01(opts.top);
  const width = clamp01(opts.width ?? 1);
  const height = clamp01(opts.height);

  const full = await getPageCanvas(pdfDoc, opts.pageNumber, scale);

  const sx = left * full.width;
  const sy = top * full.height;
  const sw = Math.min(width, 1 - left) * full.width;
  const sh = Math.min(height, 1 - top) * full.height;

  const slice = document.createElement('canvas');
  slice.width = Math.max(1, Math.round(sw));
  slice.height = Math.max(1, Math.round(sh));
  const ctx = slice.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D context for slice canvas');
  ctx.drawImage(full, sx, sy, sw, sh, 0, 0, slice.width, slice.height);

  return { dataUrl: slice.toDataURL('image/png'), width: slice.width, height: slice.height };
}

export function initPdfApi() {
  window.TractorBeamPdf = {
    extractFullText,
    extractVisualBlocks,
    getPageMetrics,
    renderRegion,
  };
  console.log('[pdfjs-additions] PDF API initialized');
}
