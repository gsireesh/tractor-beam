import { describe, it, expect } from 'vitest';
import {
  activeFilterCount,
  applyNavigatorFilter,
  classFacets,
  EMPTY_FILTER,
  filterIsActive,
  highlightPage,
  type NavigatorFilter,
  sectionCountsByKey,
} from './navigator-filters';
import { buildOutlineTree } from './pdf/outline-tree';
import type { Highlight, Signpost } from './definitions';

// Fully-shaped Highlight with overridable defaults, so fixtures stay honest to the
// real type (same factory pattern as the reducer/navigator tests).
let seq = 0;
function makeHighlight(overrides: Partial<Highlight> = {}): Highlight {
  const n = seq++;
  return {
    id: `h-${n}`,
    classId: 'c1',
    schemaId: 's1',
    coords: [{ pageNumber: 1, left: 0, top: 0, width: 0.1, height: 0.1 }],
    source: 'manual',
    text: `highlight ${n}`,
    color: 'rgba(0,0,0,0.3)',
    positiveExample: true,
    ...overrides,
  };
}

/** Build a filter from a partial patch over EMPTY_FILTER. */
function filter(patch: Partial<NavigatorFilter> = {}): NavigatorFilter {
  return { ...EMPTY_FILTER, ...patch };
}

describe('applyNavigatorFilter', () => {
  it('passes everything through the empty filter (empty set = no constraint)', () => {
    const items = [makeHighlight(), makeHighlight({ source: 'ml' })];
    expect(applyNavigatorFilter(items, EMPTY_FILTER)).toHaveLength(2);
  });

  it('filters by source', () => {
    const items = [
      makeHighlight({ source: 'manual', text: 'a' }),
      makeHighlight({ source: 'ml', text: 'b' }),
    ];
    const result = applyNavigatorFilter(items, filter({ sources: new Set(['ml']) }));
    expect(result.map((h) => h.text)).toEqual(['b']);
  });

  it('filters by class id', () => {
    const items = [makeHighlight({ classId: 'x' }), makeHighlight({ classId: 'y' })];
    const result = applyNavigatorFilter(items, filter({ classIds: new Set(['y']) }));
    expect(result.map((h) => h.classId)).toEqual(['y']);
  });

  it('filters by an inclusive page range, dropping coordless highlights', () => {
    const onPage = (n: number, text: string) =>
      makeHighlight({ coords: [{ pageNumber: n, left: 0, top: 0, width: 1, height: 1 }], text });
    const items = [
      onPage(2, 'p2'),
      onPage(5, 'p5'),
      onPage(9, 'p9'),
      makeHighlight({ coords: [], text: 'nowhere' }),
    ];
    // Closed range [3,7] keeps only p5.
    expect(
      applyNavigatorFilter(items, filter({ pageRange: { from: 3, to: 7 } })).map((h) => h.text),
    ).toEqual(['p5']);
    // Open-ended lower bound (>= 5) keeps p5 and p9.
    expect(
      applyNavigatorFilter(items, filter({ pageRange: { from: 5, to: null } })).map((h) => h.text),
    ).toEqual(['p5', 'p9']);
  });

  it('filters by section via the sectionOf resolver', () => {
    // page 1 → section path [10, 11]; page 9 → section path [20].
    const sectionOf = (page: number) => (page === 1 ? [10, 11] : [20]);
    const items = [
      makeHighlight({
        coords: [{ pageNumber: 1, left: 0, top: 0, width: 1, height: 1 }],
        text: 'inSec',
      }),
      makeHighlight({
        coords: [{ pageNumber: 9, left: 0, top: 0, width: 1, height: 1 }],
        text: 'outSec',
      }),
    ];
    const result = applyNavigatorFilter(items, filter({ sectionKeys: new Set([11]) }), sectionOf);
    expect(result.map((h) => h.text)).toEqual(['inSec']);
  });

  it('matches text case-insensitively as a substring', () => {
    const items = [
      makeHighlight({ text: 'Invoice Total' }),
      makeHighlight({ text: 'Shipping' }),
      makeHighlight({ text: undefined }),
    ];
    const result = applyNavigatorFilter(items, filter({ query: 'invoice' }));
    expect(result.map((h) => h.text)).toEqual(['Invoice Total']);
  });

  it('ANDs across dimensions', () => {
    const items = [
      makeHighlight({ source: 'ml', classId: 'x', text: 'keep' }),
      makeHighlight({ source: 'ml', classId: 'y', text: 'wrong class' }),
      makeHighlight({ source: 'manual', classId: 'x', text: 'wrong source' }),
    ];
    const result = applyNavigatorFilter(
      items,
      filter({ sources: new Set(['ml']), classIds: new Set(['x']) }),
    );
    expect(result.map((h) => h.text)).toEqual(['keep']);
  });

  it('preserves the concrete input type (returns the same objects)', () => {
    const a = makeHighlight({ text: 'a' });
    const result = applyNavigatorFilter([a], EMPTY_FILTER);
    expect(result[0]).toBe(a);
  });
});

describe('highlightPage', () => {
  it('returns the first box page, or null with no coords', () => {
    expect(
      highlightPage(
        makeHighlight({ coords: [{ pageNumber: 7, left: 0, top: 0, width: 1, height: 1 }] }),
      ),
    ).toBe(7);
    expect(highlightPage(makeHighlight({ coords: [] }))).toBeNull();
  });
});

function makeSignpost(overrides: Partial<Signpost> = {}): Signpost {
  return { ...makeHighlight(), className: 'Class', ...overrides };
}

describe('classFacets', () => {
  it('groups by classId with counts, carrying name+color, sorted by name', () => {
    const facets = classFacets([
      makeSignpost({ classId: 'b', className: 'Beta', color: 'blue' }),
      makeSignpost({ classId: 'a', className: 'Alpha', color: 'red' }),
      makeSignpost({ classId: 'b', className: 'Beta', color: 'blue' }),
    ]);
    expect(facets).toEqual([
      { classId: 'a', className: 'Alpha', color: 'red', count: 1 },
      { classId: 'b', className: 'Beta', color: 'blue', count: 2 },
    ]);
  });
});

describe('sectionCountsByKey', () => {
  // Chapter 1 (key 0) spans p1–4 with Section 1.1 (key 1) on p2–4; Chapter 2 (key 2) p5–6.
  const roots = buildOutlineTree(
    [
      { title: 'Chapter 1', pageNumber: 1, level: 0 },
      { title: 'Section 1.1', pageNumber: 2, level: 1 },
      { title: 'Chapter 2', pageNumber: 5, level: 0 },
    ],
    6,
  );
  const onPage = (n: number) =>
    makeSignpost({ coords: [{ pageNumber: n, left: 0, top: 0, width: 1, height: 1 }] });

  it("counts a signpost toward every section in its page's path (parents include descendants)", () => {
    // p1 → Chapter 1 only (before its subsection); p2 → Chapter 1 + Section 1.1
    // (Section 1.1 spans p2–4); p5 → Chapter 2.
    const counts = sectionCountsByKey(roots, [onPage(1), onPage(2), onPage(5)]);
    expect(counts.get(0)).toBe(2); // Chapter 1: pages 1 and 2
    expect(counts.get(1)).toBe(1); // Section 1.1: page 2
    expect(counts.get(2)).toBe(1); // Chapter 2: page 5
  });
});

describe('filterIsActive / activeFilterCount', () => {
  it('treats the empty filter as inactive', () => {
    expect(filterIsActive(EMPTY_FILTER)).toBe(false);
    expect(activeFilterCount(EMPTY_FILTER)).toBe(0);
  });

  it('ignores a whitespace-only query', () => {
    expect(filterIsActive(filter({ query: '   ' }))).toBe(false);
  });

  it('counts each engaged dimension once', () => {
    const f = filter({ sources: new Set(['ml']), pageRange: { from: 1, to: 3 }, query: 'x' });
    expect(activeFilterCount(f)).toBe(3); // sources + pageRange + query
    expect(filterIsActive(f)).toBe(true);
  });

  it('treats a page range as active when either bound is set', () => {
    expect(filterIsActive(filter({ pageRange: { from: 3, to: null } }))).toBe(true);
    expect(filterIsActive(filter({ pageRange: { from: null, to: 8 } }))).toBe(true);
    expect(filterIsActive(filter({ pageRange: { from: null, to: null } }))).toBe(false);
  });
});
