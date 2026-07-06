/**
 * The filter model for the InstanceNavigator, shared by the side-panel list AND
 * the in-page viewer so the two never disagree about what's "in scope".
 *
 * `applyNavigatorFilter` is typed against {@link Highlight}, so the identical
 * predicate filters both the viewer's `Highlight[]` and the navigator's
 * `Signpost[]` (which extends Highlight) — one source of truth, no logic drift.
 * It mirrors the `FilterState` + `applyFilters` shape in
 * `@/entrypoints/schema-manager/filters.ts`, adapted to highlights.
 *
 * Every dimension follows the same "empty set = no constraint" convention, so an
 * all-empty filter ({@link EMPTY_FILTER}) passes everything through.
 */

import type { Highlight, Signpost } from '@/lib/definitions';
import { type OutlineNode, sectionPathForPage } from '@/lib/pdf/outline-tree';

export interface NavigatorFilter {
  /** Highlight sources to keep ('manual' = confirmed, 'ml' = suggested). Empty = all. */
  sources: ReadonlySet<Highlight['source']>;
  /** Schema class ids to keep. Empty = all. */
  classIds: ReadonlySet<string>;
  /** 1-based page numbers to keep. Empty = all. */
  pages: ReadonlySet<number>;
  /** Outline node keys to keep (a highlight matches if its page's section path
   *  includes any selected key). Empty = all. Wired up in the ToC-section slice. */
  sectionKeys: ReadonlySet<number>;
  /** Case-insensitive substring match over the highlight text. Empty = all. */
  query: string;
}

/** A filter with no constraints — passes every highlight. Safe to share: writers
 *  always build a fresh Set rather than mutating an existing one. */
export const EMPTY_FILTER: NavigatorFilter = {
  sources: new Set(),
  classIds: new Set(),
  pages: new Set(),
  sectionKeys: new Set(),
  query: '',
};

/** Whether any dimension constrains the result — drives the "filters active" UI. */
export function filterIsActive(f: NavigatorFilter): boolean {
  return activeFilterCount(f) > 0;
}

/** How many distinct dimensions are engaged (not how many values are selected) —
 *  the N in the "N filters active" indicator. */
export function activeFilterCount(f: NavigatorFilter): number {
  let n = 0;
  if (f.sources.size > 0) n++;
  if (f.classIds.size > 0) n++;
  if (f.pages.size > 0) n++;
  if (f.sectionKeys.size > 0) n++;
  if (f.query.trim().length > 0) n++;
  return n;
}

/** The 1-based page a highlight sits on (its first box), or null when it has none. */
export function highlightPage(h: Highlight): number | null {
  return h.coords[0]?.pageNumber ?? null;
}

// ─── Facets: the selectable options the filter panel offers ───
// Derived from the signposts themselves (not the schema) so an option only exists
// when something carries it — a chip can never resolve to an empty result. Counts
// are over ALL signposts (like the source toggles), so they stay stable while
// filtering.

export interface ClassFacet {
  classId: string;
  className: string;
  color: string;
  count: number;
}

/** One entry per class present among the signposts, sorted by name. */
export function classFacets(signposts: Signpost[]): ClassFacet[] {
  const byId = new Map<string, ClassFacet>();
  for (const sp of signposts) {
    const existing = byId.get(sp.classId);
    if (existing) existing.count++;
    else
      byId.set(sp.classId, {
        classId: sp.classId,
        className: sp.className,
        color: sp.color,
        count: 1,
      });
  }
  return [...byId.values()].sort((a, b) => a.className.localeCompare(b.className));
}

export interface PageFacet {
  page: number;
  count: number;
}

/** One entry per page that has at least one signpost, sorted ascending. */
export function pageFacets(signposts: Signpost[]): PageFacet[] {
  const byPage = new Map<number, number>();
  for (const sp of signposts) {
    const page = highlightPage(sp);
    if (page === null) continue;
    byPage.set(page, (byPage.get(page) ?? 0) + 1);
  }
  return [...byPage.entries()]
    .map(([page, count]) => ({ page, count }))
    .sort((a, b) => a.page - b.page);
}

/**
 * How many signposts fall under each outline node, keyed by node key. A signpost
 * counts toward every section in its path, so a parent's count includes all its
 * descendants' signposts — mirroring how selecting a parent matches them all.
 */
export function sectionCountsByKey(
  roots: OutlineNode[],
  signposts: Signpost[],
): Map<number, number> {
  const counts = new Map<number, number>();
  for (const sp of signposts) {
    const page = highlightPage(sp);
    if (page === null) continue;
    for (const node of sectionPathForPage(roots, page)) {
      counts.set(node.key, (counts.get(node.key) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * Keep only the highlights that satisfy every engaged dimension. Generic over
 * `T extends Highlight` so it returns the same concrete type it's given (e.g.
 * `Signpost[]` stays `Signpost[]`).
 *
 * `sectionOf` maps a page to its outline node-key path; it defaults to a no-op so
 * callers that don't yet have an outline (or aren't filtering by section) can omit
 * it. It is only consulted when `sectionKeys` is non-empty.
 */
export function applyNavigatorFilter<T extends Highlight>(
  items: T[],
  f: NavigatorFilter,
  sectionOf: (page: number) => number[] = () => [],
): T[] {
  const q = f.query.trim().toLowerCase();
  return items.filter((h) => {
    if (f.sources.size > 0 && !f.sources.has(h.source)) return false;
    if (f.classIds.size > 0 && !f.classIds.has(h.classId)) return false;

    const page = highlightPage(h);
    if (f.pages.size > 0 && (page === null || !f.pages.has(page))) return false;
    if (f.sectionKeys.size > 0) {
      if (page === null) return false;
      if (!sectionOf(page).some((key) => f.sectionKeys.has(key))) return false;
    }

    if (q.length > 0 && !(h.text ?? '').toLowerCase().includes(q)) return false;
    return true;
  });
}
