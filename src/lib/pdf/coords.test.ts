import { describe, it, expect } from 'vitest';
import {
  itemToNormalizedBox,
  normalizedItemsFromTextContent,
  type PdfTextItem,
} from '@/lib/pdf/coords.ts';

// US-Letter at scale 1.0 (pdf points). Real page viewports come back at this size
// from `getViewport({ scale: 1.0 })`, so fixtures here mirror production numbers.
const VW = 612;
const VH = 792;

// A pdf.js text item: transform is [scaleX, skewX, skewY, scaleY, tx, ty]; for
// upright text scaleY is the font size and (tx, ty) is the baseline origin.
function textItem(overrides: Partial<PdfTextItem> = {}): PdfTextItem {
  return { str: 'Hello', transform: [12, 0, 0, 12, 72, 720], width: 100, height: 12, ...overrides };
}

describe('itemToNormalizedBox', () => {
  // These four properties are unambiguous — the horizontal mapping and the font-size
  // height are straightforward divisions by the viewport dimensions.
  describe('clearly-correct properties', () => {
    it('maps left to tx / viewportWidth', () => {
      const box = itemToNormalizedBox(textItem({ transform: [12, 0, 0, 12, 72, 720] }), VH, VW);
      expect(box.left).toBeCloseTo(72 / 612, 6);
    });

    it('maps width to item.width / viewportWidth', () => {
      const box = itemToNormalizedBox(textItem({ width: 100 }), VH, VW);
      expect(box.width).toBeCloseTo(100 / 612, 6);
    });

    it('derives height from |scaleY| / viewportHeight', () => {
      const box = itemToNormalizedBox(textItem({ transform: [12, 0, 0, 12, 72, 720] }), VH, VW);
      expect(box.height).toBeCloseTo(12 / 792, 6);
    });

    it('takes the absolute value of a negative scaleY (flipped text matrices)', () => {
      const box = itemToNormalizedBox(textItem({ transform: [12, 0, 0, -12, 72, 720] }), VH, VW);
      expect(box.height).toBeCloseTo(12 / 792, 6);
      expect(box.height).toBeGreaterThan(0);
    });

    it('leaves pageNumber at 0 for the caller to stamp', () => {
      expect(itemToNormalizedBox(textItem(), VH, VW).pageNumber).toBe(0);
    });
  });

  // `top` flips the PDF's bottom-left origin to top-down and subtracts the glyph height
  // from the baseline. These assertions PIN CURRENT BEHAVIOR — this is the function
  // implicated in the known coordinate-mapping bug, so they are here to catch drift, not
  // to bless the math. See the it.todo below.
  describe('top / height (current behavior — coordinate-mapping bug suspect)', () => {
    it('computes top = (vh - ty)/vh - normalizedHeight as implemented today', () => {
      const box = itemToNormalizedBox(textItem({ transform: [12, 0, 0, 12, 72, 720] }), VH, VW);
      // (792 - 720)/792 - 12/792 = 72/792 - 12/792 = 60/792
      expect(box.top).toBeCloseTo(60 / 792, 6);
    });

    it.todo(
      'verify itemToNormalizedBox top/height against the known coordinate-mapping bug ' +
        '(baseline vs. cap height); update the assertion above when fixed',
    );
  });
});

describe('normalizedItemsFromTextContent', () => {
  it('drops empty and whitespace-only strings', () => {
    const items = normalizedItemsFromTextContent(
      [textItem({ str: 'Hello' }), textItem({ str: '', width: 0 }), textItem({ str: '   ' })],
      VW,
      VH,
      1,
    );
    expect(items.map((i) => i.str)).toEqual(['Hello']);
  });

  it('drops skewed / rotated glyphs (non-zero transform[1] or [2])', () => {
    const items = normalizedItemsFromTextContent(
      [
        textItem({ str: 'Upright', transform: [12, 0, 0, 12, 72, 720] }),
        textItem({ str: 'Skewed', transform: [12, 1, 0, 12, 72, 700] }),
        textItem({ str: 'Rotated', transform: [12, 0, 1, 12, 72, 680] }),
      ],
      VW,
      VH,
      1,
    );
    expect(items.map((i) => i.str)).toEqual(['Upright']);
  });

  it('normalizes each kept item and stamps the given page number', () => {
    const items = normalizedItemsFromTextContent(
      [textItem({ str: 'A', transform: [12, 0, 0, 12, 72, 720] })],
      VW,
      VH,
      7,
    );
    expect(items).toHaveLength(1);
    expect(items[0].box.pageNumber).toBe(7);
    expect(items[0].box.left).toBeCloseTo(72 / 612, 6);
  });
});
