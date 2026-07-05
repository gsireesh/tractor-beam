/**
 * Visual-block segmentation: group PDF text items into spatial blocks via a recursive
 * XY-cut, font-size stratification, and line grouping. Pure functions moved out of the
 * pdf.js entrypoint so they're unit-testable in isolation (the entrypoint only feeds
 * them normalized items pulled from the vendored viewer).
 */
import type { VisualBlock, VisualBlockItem, OutlineEntry } from '@/lib/definitions';

const MAX_XY_CUT_DEPTH = 8;
// A gutter segment may be crossed by at most this fraction of the busiest column's item
// count — lets a stray full-width footnote/figure cross without hiding the columns.
const GUTTER_COVERAGE_FRACTION = 0.2;
// A paragraph break is a vertical gap at least this multiple of the region's own median
// line gap (so grouping adapts to each document's leading rather than a fixed height).
const PARAGRAPH_GAP_FACTOR = 1.5;
// A plausible line pitch is at most this multiple of the glyph height (roughly triple
// spacing). Beyond it, an estimated "pitch" is really a structural gap from sparse data,
// so we cap it before raising the Y-cut threshold — otherwise two far-apart items read as
// one loosely-spaced block instead of two paragraphs.
const MAX_LINE_PITCH_FACTOR = 3.0;
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

/**
 * A region's dominant line pitch: the 30th-percentile positive vertical gap between
 * consecutive items (same-line runs overlap → dropped). A LOW percentile (not the median)
 * keeps a heading's larger gap from inflating the estimate in small regions. Falls back to
 * `fallback` when there are no inter-line gaps. Used to make both the XY-cut Y-threshold
 * and paragraph grouping adapt to each document's leading (e.g. single- vs double-spaced).
 */
function regionLinePitch(items: VisualBlockItem[], fallback: number): number {
  const sorted = [...items].sort((a, b) => a.box.top - b.box.top || a.box.left - b.box.left);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].box.top - (sorted[i - 1].box.top + sorted[i - 1].box.height);
    if (gap > 0) gaps.push(gap);
  }
  if (gaps.length === 0) return fallback;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length * 0.3)];
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
 * Find the column gutter: the widest vertical band crossed by only a small fraction of
 * the busiest column's items (a valley in the horizontal coverage profile). Unlike a
 * strict empty-gap search, this tolerates sparse spanners — a full-width footnote, a
 * figure — that would otherwise fill the gutter and hide the columns. Returns the band's
 * center + width (size 0 if none). Only accepts a valley with content on BOTH sides, so
 * the empty page margins don't count.
 */
function findGutter(items: VisualBlockItem[]): Gap {
  if (items.length < 2) return { position: 0, size: 0 };

  const edges = Array.from(
    new Set(items.flatMap((it) => [it.box.left, it.box.left + it.box.width])),
  ).sort((a, b) => a - b);
  const coverageAt = (x: number) =>
    items.reduce((n, it) => n + (it.box.left <= x && x <= it.box.left + it.box.width ? 1 : 0), 0);

  // One segment between each pair of adjacent edges; coverage is constant within it.
  const segs: { start: number; end: number; cov: number }[] = [];
  let maxCoverage = 0;
  for (let i = 0; i < edges.length - 1; i++) {
    const cov = coverageAt((edges[i] + edges[i + 1]) / 2);
    maxCoverage = Math.max(maxCoverage, cov);
    segs.push({ start: edges[i], end: edges[i + 1], cov });
  }
  const tol = Math.floor(maxCoverage * GUTTER_COVERAGE_FRACTION);

  // Widest contiguous run of low-coverage segments bounded by content on both sides.
  let best: Gap = { position: 0, size: 0 };
  for (let i = 0; i < segs.length; ) {
    if (segs[i].cov > tol) {
      i++;
      continue;
    }
    let j = i;
    while (j < segs.length && segs[j].cov <= tol) j++;
    const hasContentBothSides = i > 0 && j < segs.length;
    if (hasContentBothSides) {
      const size = segs[j - 1].end - segs[i].start;
      if (size > best.size) best = { position: (segs[i].start + segs[j - 1].end) / 2, size };
    }
    i = j;
  }
  return best;
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

  // Try Y-cut (horizontal split). `minYGap` is the caller's page-global adaptive threshold
  // (floored at 1×median height, raised for uniformly loose/double-spaced pages) — using a
  // GLOBAL rather than per-region pitch so a sparse sub-region (e.g. a journal masthead)
  // isn't given a high threshold and merged.
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

  // Try X-cut (vertical split): the column gutter, tolerant of sparse spanners.
  const xGap = findGutter(items);
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

function groupIntoLines(items: VisualBlockItem[], medianHeight: number): VisualBlockItem[][] {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => a.box.top - b.box.top || a.box.left - b.box.left);

  // A paragraph break is a gap notably larger than the region's own line pitch — adapting
  // to each document's leading (chi_star's body runs at 0.22h, nas's at 0.67h) instead of a
  // fixed fraction of height, which would either shatter loose text or merge tight headings.
  const breakThreshold = PARAGRAPH_GAP_FACTOR * regionLinePitch(items, medianHeight);

  const groups: VisualBlockItem[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].box.top - (sorted[i - 1].box.top + sorted[i - 1].box.height);
    if (gap < breakThreshold) {
      groups[groups.length - 1].push(sorted[i]);
    } else {
      groups.push([sorted[i]]);
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

  // Phase 1: XY-Cut. The Y-cut threshold is adaptive: floored at 1×median height, but
  // raised to 1.5× the page-global line pitch when the page is uniformly loose (a
  // double-spaced transcript), so normal leading doesn't get cut as if it were a paragraph
  // break. Single-spaced pages keep the median-height floor. Global (not per-region) pitch
  // so sparse sub-regions like mastheads aren't over-merged.
  const medianH = computeMedianHeight(effectiveBody);
  const pitch = Math.min(regionLinePitch(effectiveBody, medianH), MAX_LINE_PITCH_FACTOR * medianH);
  const minYGap = Math.max(medianH, PARAGRAPH_GAP_FACTOR * pitch);
  console.log(
    `[xy-cut] page ${pageNumber}: ${effectiveBody.length} items, medianH=${medianH.toFixed(4)}, minYGap=${minYGap.toFixed(4)}, minXGap=${(1.2 * medianH).toFixed(4)}`,
  );
  const regions = xyCut(effectiveBody, minYGap, 1.2 * medianH, 0);

  // Phase 2 & 3: Font stratification → line grouping
  const allGroups: VisualBlockItem[][] = [];

  for (const region of regions) {
    const subgroups = stratifyByFontSize(region, medianH);
    for (const subgroup of subgroups) {
      const paragraphs = groupIntoLines(subgroup, medianH);
      allGroups.push(...paragraphs);
    }
  }

  // Add header/footer as separate blocks
  if (separateHF.length > 0) {
    allGroups.push(separateHF);
  }

  return allGroups.map((group, idx) => buildVisualBlock(group, pageNumber, idx));
}

/**
 * Read the PDF's embedded table of contents (outline / bookmarks) and flatten it
 * depth-first into 1-based page numbers. Returns [] when the PDF has no outline.
 *
 * Resolving an entry's `dest` to a page mirrors the vendored viewer's own logic
 * (public/pdfjs/web/viewer.mjs goToDestination): a string dest is first looked up
 * via getDestination, then the destination's page ref is resolved with
 * getPageIndex. Entries whose dest can't be resolved are skipped rather than
 * guessed at, so an unresolved bookmark never scopes a run to the wrong pages.
 */
export async function extractOutline(PDFViewerApplication: any): Promise<OutlineEntry[]> {
  const pdfDoc = PDFViewerApplication.pdfDocument;
  if (!pdfDoc) throw new Error('No PDF document loaded');

  const outline = await pdfDoc.getOutline();
  if (!outline || outline.length === 0) return [];

  const entries: OutlineEntry[] = [];

  async function resolvePageNumber(dest: any): Promise<number | null> {
    const explicitDest = typeof dest === 'string' ? await pdfDoc.getDestination(dest) : dest;
    if (!Array.isArray(explicitDest) || explicitDest.length === 0) return null;
    const ref = explicitDest[0];
    try {
      // A page ref object needs async resolution; an integer is already a 0-based index.
      const pageIndex =
        typeof ref === 'object' && ref !== null ? await pdfDoc.getPageIndex(ref) : ref;
      return typeof pageIndex === 'number' ? pageIndex + 1 : null;
    } catch {
      return null;
    }
  }

  async function walk(nodes: any[], level: number): Promise<void> {
    for (const node of nodes) {
      const pageNumber = node.dest != null ? await resolvePageNumber(node.dest) : null;
      if (pageNumber != null && node.title) {
        entries.push({ title: node.title, pageNumber, level });
      }
      if (node.items && node.items.length > 0) {
        await walk(node.items, level + 1);
      }
    }
  }

  await walk(outline, 0);
  console.log(`[text-extraction] Extracted ${entries.length} outline entries`);
  return entries;
}
