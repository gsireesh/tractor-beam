/**
 * Visual-block segmentation: group PDF text items into spatial blocks via a recursive
 * XY-cut, font-size stratification, and line grouping. Pure functions moved out of the
 * pdf.js entrypoint so they're unit-testable in isolation (the entrypoint only feeds
 * them normalized items pulled from the vendored viewer).
 */
import type { VisualBlock, VisualBlockItem } from '@/lib/definitions';

const VERTICAL_PROXIMITY_THRESHOLD = 1.5;
const MAX_XY_CUT_DEPTH = 8;
const HEADER_FOOTER_MARGIN = 0.04;
const HEADER_FOOTER_MAX_CHARS = 30;

/**
 * Groups text items into a VisualBlock: concatenated text plus the char offset where
 * each item starts (so callers can map a text span back to its item boxes).
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

// ─── XY-Cut helpers ─────────────────────────────────────────────────────────

function computeMedianHeight(items: VisualBlockItem[]): number {
  if (items.length === 0) return 0;
  const heights = items.map((it) => it.box.height).sort((a, b) => a - b);
  const mid = Math.floor(heights.length / 2);
  return heights.length % 2 === 0 ? (heights[mid - 1] + heights[mid]) / 2 : heights[mid];
}

interface Gap {
  position: number;
  size: number;
}

/**
 * Projects items onto one axis using interval merging, then finds the largest
 * whitespace gap between merged intervals.
 */
function findLargestGap(intervals: { start: number; end: number }[]): Gap {
  if (intervals.length < 2) return { position: 0, size: 0 };
  const sorted = [...intervals].sort((a, b) => a.start - b.start);

  let maxEnd = sorted[0].end;
  let bestGap = 0;
  let bestPos = 0;

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].start - maxEnd;
    if (gap > bestGap) {
      bestGap = gap;
      bestPos = maxEnd + gap / 2;
    }
    maxEnd = Math.max(maxEnd, sorted[i].end);
  }
  return { position: bestPos, size: bestGap };
}

/**
 * Recursive XY-cut: splits items by the largest whitespace gap on alternating
 * axes (Y first, then X) until no qualifying gap remains.
 */
function xyCut(
  items: VisualBlockItem[],
  minYGap: number,
  minXGap: number,
  depth: number,
): VisualBlockItem[][] {
  if (items.length <= 1 || depth > MAX_XY_CUT_DEPTH) return [items];

  // Try Y-cut (horizontal split)
  const yGap = findLargestGap(
    items.map((item) => ({ start: item.box.top, end: item.box.top + item.box.height })),
  );
  console.log(
    `[xy-cut] depth=${depth} items=${items.length} yGap=${yGap.size.toFixed(4)} (need ${minYGap.toFixed(4)}) xGap=pending`,
  );
  if (yGap.size >= minYGap) {
    const above = items.filter((item) => item.box.top + item.box.height / 2 < yGap.position);
    const below = items.filter((item) => item.box.top + item.box.height / 2 >= yGap.position);
    return [
      ...xyCut(above, minYGap, minXGap, depth + 1),
      ...xyCut(below, minYGap, minXGap, depth + 1),
    ];
  }

  // Try X-cut (vertical split)
  const xGap = findLargestGap(
    items.map((item) => ({ start: item.box.left, end: item.box.left + item.box.width })),
  );
  console.log(
    `[xy-cut] depth=${depth} items=${items.length} xGap=${xGap.size.toFixed(4)} (need ${minXGap.toFixed(4)})`,
  );
  if (xGap.size >= minXGap) {
    const left = items.filter((item) => item.box.left + item.box.width / 2 < xGap.position);
    const right = items.filter((item) => item.box.left + item.box.width / 2 >= xGap.position);
    return [
      ...xyCut(left, minYGap, minXGap, depth + 1),
      ...xyCut(right, minYGap, minXGap, depth + 1),
    ];
  }

  return [items];
}

// ─── Font-size stratification ───────────────────────────────────────────────

type SizeClass = 'large' | 'normal' | 'small';

function classifySize(height: number, modalHeight: number): SizeClass {
  if (height > 1.8 * modalHeight) return 'large';
  if (height < 0.5 * modalHeight) return 'small';
  return 'normal';
}

function stratifyByFontSize(items: VisualBlockItem[], medianHeight: number): VisualBlockItem[][] {
  if (items.length === 0) return [];

  // Modal height: most common height (rounded to 3 decimals)
  const freq = new Map<number, number>();
  for (const it of items) {
    const key = Math.round(it.box.height * 1000) / 1000;
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  let modalHeight = items[0].box.height;
  let maxCount = 0;
  for (const [h, count] of freq) {
    if (count > maxCount) {
      maxCount = count;
      modalHeight = h;
    }
  }

  const sorted = [...items].sort((a, b) => a.box.top - b.box.top || a.box.left - b.box.left);
  const groups: VisualBlockItem[][] = [[sorted[0]]];
  let prevClass = classifySize(sorted[0].box.height, modalHeight);

  for (let i = 1; i < sorted.length; i++) {
    const curr = sorted[i];
    const currClass = classifySize(curr.box.height, modalHeight);
    const prev = sorted[i - 1];
    const sameLine = Math.abs(curr.box.top - prev.box.top) < 1.0 * medianHeight;

    if (currClass !== prevClass && !sameLine) {
      groups.push([curr]);
    } else {
      groups[groups.length - 1].push(curr);
    }
    if (!sameLine) prevClass = currClass;
  }

  return groups;
}

// ─── Line/paragraph grouping (enhanced from original) ───────────────────────

function groupIntoLines(items: VisualBlockItem[]): VisualBlockItem[][] {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => a.box.top - b.box.top || a.box.left - b.box.left);
  const groups: VisualBlockItem[][] = [[sorted[0]]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const avgHeight = (prev.box.height + curr.box.height) / 2;
    const verticallyClose =
      Math.abs(curr.box.top - prev.box.top) < VERTICAL_PROXIMITY_THRESHOLD * avgHeight;

    if (verticallyClose) {
      groups[groups.length - 1].push(curr);
    } else {
      groups.push([curr]);
    }
  }
  return groups;
}

// ─── Orchestration ──────────────────────────────────────────────────────────

/**
 * Segment a page's normalized text items into visual blocks: strip small
 * header/footer runs, XY-cut into regions, stratify by font size, then group into
 * lines/paragraphs. Pure — accepts items already mapped to normalized boxes.
 */
export function groupItemsIntoBlocks(items: VisualBlockItem[], pageNumber: number): VisualBlock[] {
  if (items.length === 0) return [];

  // Phase 0: Strip header/footer items
  const headerFooterItems: VisualBlockItem[] = [];
  const bodyItems: VisualBlockItem[] = [];
  for (const item of items) {
    const isHeader = item.box.top < HEADER_FOOTER_MARGIN;
    const isFooter = item.box.top + item.box.height > 1 - HEADER_FOOTER_MARGIN;
    if (isHeader || isFooter) {
      headerFooterItems.push(item);
    } else {
      bodyItems.push(item);
    }
  }

  // Only separate header/footer if they're small (page numbers, running headers)
  const hfTotalChars = headerFooterItems.reduce((sum, it) => sum + it.str.length, 0);
  const effectiveBody =
    hfTotalChars < HEADER_FOOTER_MAX_CHARS ? bodyItems : [...bodyItems, ...headerFooterItems];
  const separateHF = hfTotalChars < HEADER_FOOTER_MAX_CHARS ? headerFooterItems : [];

  // Phase 1: XY-Cut
  const medianH = computeMedianHeight(effectiveBody);
  console.log(
    `[xy-cut] page ${pageNumber}: ${effectiveBody.length} items, medianH=${medianH.toFixed(4)}, minYGap=${(1.0 * medianH).toFixed(4)}, minXGap=${(1.2 * medianH).toFixed(4)}`,
  );
  const regions = xyCut(effectiveBody, 1.0 * medianH, 1.2 * medianH, 0);

  // Phase 2 & 3: Font stratification → line grouping
  const allGroups: VisualBlockItem[][] = [];

  for (const region of regions) {
    const subgroups = stratifyByFontSize(region, medianH);
    for (const subgroup of subgroups) {
      const paragraphs = groupIntoLines(subgroup);
      allGroups.push(...paragraphs);
    }
  }

  // Add header/footer as separate blocks
  if (separateHF.length > 0) {
    allGroups.push(separateHF);
  }

  return allGroups.map((group, idx) => buildVisualBlock(group, pageNumber, idx));
}
