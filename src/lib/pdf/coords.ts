import type { PdfBox, VisualBlockItem } from '@/lib/definitions';

/**
 * A pdf.js text item as returned by `page.getTextContent()`.
 * `transform` is a 2D affine matrix: [scaleX, skewX, skewY, scaleY, translateX, translateY].
 */
export interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

/**
 * Convert a pdf.js text item into a normalized (0–1) PdfBox for the given page
 * viewport. Pure and framework-free so it can be unit-tested directly (it is the
 * coordinate primitive shared by extraction and rendering).
 *
 * `pageNumber` is left 0 for the caller to stamp.
 */
export function itemToNormalizedBox(
  item: PdfTextItem,
  viewportHeight: number,
  viewportWidth: number,
): PdfBox {
  const [, , , scaleY, tx, ty] = item.transform;
  const itemHeight = Math.abs(scaleY);
  const normalizedHeight = itemHeight / viewportHeight;
  // PDF coordinate system has Y=0 at bottom; ty is the text baseline.
  // Flip to top-down and subtract height to get the top edge of the text.
  return {
    pageNumber: 0,
    left: tx / viewportWidth,
    top: (viewportHeight - ty) / viewportHeight - normalizedHeight,
    width: item.width / viewportWidth,
    height: normalizedHeight,
  };
}

/**
 * Turn a page's raw pdf.js text items into normalized `VisualBlockItem`s ready for
 * segmentation: drop empty strings and skewed/rotated glyphs (only axis-aligned text,
 * `transform[1] === 0 && transform[2] === 0`), map each box via `itemToNormalizedBox`,
 * and stamp the page number.
 *
 * Pure (given already-extracted items) so both the in-viewer extractor
 * (`extractVisualBlocks`) and the offline fixture-generation script produce identical
 * input for `groupItemsIntoBlocks`.
 */
export function normalizedItemsFromTextContent(
  items: PdfTextItem[],
  viewportWidth: number,
  viewportHeight: number,
  pageNumber: number,
): VisualBlockItem[] {
  return items
    .filter((item) => item.str !== undefined && item.str.trim() !== '')
    .filter((item) => item.transform[1] === 0 && item.transform[2] === 0)
    .map((item) => ({
      str: item.str,
      box: { ...itemToNormalizedBox(item, viewportHeight, viewportWidth), pageNumber },
    }));
}
