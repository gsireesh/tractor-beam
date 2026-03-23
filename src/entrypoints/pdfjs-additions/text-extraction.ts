/**
 * PDF text extraction logic extracted from pdfjs-init.js.
 * Exposes window.TractorBeamTextExtraction API.
 */

import type { VisualBlock, VisualBlockItem, PdfBox } from '@/lib/definitions';

const VERTICAL_PROXIMITY_THRESHOLD = 1.5;

declare global {
  interface Window {
    TractorBeamTextExtraction: {
      extractFullText: (PDFViewerApplication: any) => Promise<{ pageNumber: number; text: string }[]>;
      extractVisualBlocks: (PDFViewerApplication: any) => Promise<VisualBlock[]>;
    };
  }
}

async function extractFullText(PDFViewerApplication: any): Promise<{ pageNumber: number; text: string }[]> {
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

interface PdfTextItem {
  str: string;
  transform: number[];  // [scaleX, skewX, skewY, scaleY, translateX, translateY]
  width: number;
  height: number;
}

function itemToNormalizedBox(item: PdfTextItem, viewportHeight: number, viewportWidth: number): PdfBox {
  const [, , , scaleY, tx, ty] = item.transform;
  const itemHeight = Math.abs(scaleY);
  const normalizedHeight = itemHeight / viewportHeight;
  // PDF coordinate system has Y=0 at bottom; ty is the text baseline.
  // Flip to top-down and subtract height to get the top edge of the text.
  return {
    pageNumber: 0, // filled in by caller
    left: tx / viewportWidth,
    top: (viewportHeight - ty) / viewportHeight - normalizedHeight,
    width: item.width / viewportWidth,
    height: normalizedHeight,
  };
}

/**
 * Groups text items into visual blocks based on vertical proximity,
 * then builds VisualBlock objects with concatenated text and item offsets.
 *
 * @param items - Text items from a single page, each with normalized box coords
 * @param pageNumber - The 1-based page number
 * @returns Array of VisualBlocks for this page
 */
function buildVisualBlock(
  blockItems: VisualBlockItem[],
  pageNumber: number,
  blockIndex: number,
): VisualBlock {
  let offset = 0;
  const itemOffsets: number[] = [];
  const parts: string[] = [];
  for (const item of blockItems) {
    itemOffsets.push(offset);
    parts.push(item.str);
    offset += item.str.length + 1; // +1 for the space separator
  }
  return {
    blockId: `p${pageNumber}_b${blockIndex}`,
    pageNumber,
    text: parts.join(' '),
    items: blockItems,
    itemOffsets,
  };
}

function groupItemsIntoBlocks(
  items: VisualBlockItem[],
  pageNumber: number,
): VisualBlock[] {
  if (items.length === 0) return [];

  // Sort by top, then left
  const sorted = [...items].sort((a, b) => a.box.top - b.box.top || a.box.left - b.box.left);

  const groups: VisualBlockItem[][] = [[sorted[0]]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const avgHeight = (prev.box.height + curr.box.height) / 2;

    if (Math.abs(curr.box.top - prev.box.top) < VERTICAL_PROXIMITY_THRESHOLD * avgHeight) {
      groups[groups.length - 1].push(curr);
    } else {
      groups.push([curr]);
    }
  }

  return groups.map((group, idx) => buildVisualBlock(group, pageNumber, idx));
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

    const items: { str: string; box: PdfBox }[] = textContent.items
      .filter((item: any) => item.str !== undefined && item.str.trim() !== '')
      .map((item: PdfTextItem) => ({
        str: item.str,
        box: { ...itemToNormalizedBox(item, viewport.height, viewport.width), pageNumber: i },
      }));

    const pageBlocks = groupItemsIntoBlocks(items, i);
    allBlocks.push(...pageBlocks);
  }

  console.log(`[text-extraction] Extracted ${allBlocks.length} visual blocks from ${numPages} pages`);
  return allBlocks;
}

export function initTextExtraction() {
  window.TractorBeamTextExtraction = {
    extractFullText,
    extractVisualBlocks,
  };
  console.log('[pdfjs-additions] Text extraction initialized');
}
