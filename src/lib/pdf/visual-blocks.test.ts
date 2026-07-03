import { describe, it, expect, beforeEach, vi } from 'vitest';
import { groupItemsIntoBlocks } from '@/lib/pdf/visual-blocks.ts';
import type { VisualBlockItem } from '@/lib/definitions.ts';

// Build a normalized text item. Coords are 0–1 fractions of the page, matching what
// `normalizedItemsFromTextContent` produces from a real page.
function item(
  str: string,
  left: number,
  top: number,
  width: number,
  height: number,
): VisualBlockItem {
  return { str, box: { pageNumber: 1, left, top, width, height } };
}

describe('groupItemsIntoBlocks', () => {
  // The XY-cut logs its recursion to console.log; silence it so test output stays clean.
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('returns no blocks for an empty page', () => {
    expect(groupItemsIntoBlocks([], 1)).toEqual([]);
  });

  it('groups one row of words into a single block with the expected id, text, and offsets', () => {
    const blocks = groupItemsIntoBlocks(
      [
        item('The', 0.1, 0.1, 0.05, 0.02),
        item('quick', 0.16, 0.1, 0.06, 0.02),
        item('brown', 0.23, 0.1, 0.06, 0.02),
      ],
      1,
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].blockId).toBe('p1_b0');
    expect(blocks[0].pageNumber).toBe(1);
    expect(blocks[0].text).toBe('The quick brown');
    // Offset where each item starts in `text` — cumulative length + 1 for the space.
    expect(blocks[0].itemOffsets).toEqual([0, 4, 10]);
  });

  it('splits vertically-separated paragraphs into separate blocks (Y-cut)', () => {
    const blocks = groupItemsIntoBlocks(
      [item('First', 0.1, 0.2, 0.2, 0.02), item('Second', 0.1, 0.5, 0.2, 0.02)],
      1,
    );
    expect(blocks.map((b) => b.text)).toEqual(['First', 'Second']);
  });

  it('splits two columns into separate blocks (X-cut)', () => {
    const blocks = groupItemsIntoBlocks(
      [item('Left', 0.1, 0.3, 0.3, 0.02), item('Right', 0.55, 0.3, 0.3, 0.02)],
      1,
    );
    expect(blocks).toHaveLength(2);
    expect(blocks.map((b) => b.text).sort()).toEqual(['Left', 'Right']);
  });

  it('strips a short header (top < 4% margin) into its own block, separate from the body', () => {
    const blocks = groupItemsIntoBlocks(
      [item('Header', 0.1, 0.02, 0.2, 0.015), item('Body', 0.1, 0.5, 0.2, 0.02)],
      1,
    );
    expect(blocks).toHaveLength(2);
    const texts = blocks.map((b) => b.text);
    expect(texts).toContain('Header');
    expect(texts).toContain('Body');
  });

  // Known quirks worth pinning as intent, not yet asserted here (they need contrived
  // geometry to observe cleanly, and the real-PDF fixtures exercise them naturally):
  it.todo('short header AND footer are currently lumped into one combined block');
  it.todo('a header/footer run ≥ 30 chars is NOT stripped (stays in the body)');
});
