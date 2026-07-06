import { describe, it, expect } from 'vitest';
import type { OutlineEntry } from '@/lib/definitions.ts';
import {
  buildOutlineTree,
  leafKeys,
  nodeState,
  sectionPathForPage,
  selectedPages,
  selectedTitles,
  type OutlineNode,
} from '@/lib/pdf/outline-tree.ts';

// A representative report outline: two flat sections around a chapter with two
// subsections. Depth-first order with `level` is exactly what pdf.js returns.
//   [0] 1. Introduction      p1
//   [1] 2. Methods           p3
//   [2]   2.1 Data           p4
//   [3]   2.2 Model          p6
//   [4] 3. Results           p9
//   [5] 4. Conclusion        p12
const REPORT: OutlineEntry[] = [
  { title: '1. Introduction', pageNumber: 1, level: 0 },
  { title: '2. Methods', pageNumber: 3, level: 0 },
  { title: '2.1 Data', pageNumber: 4, level: 1 },
  { title: '2.2 Model', pageNumber: 6, level: 1 },
  { title: '3. Results', pageNumber: 9, level: 0 },
  { title: '4. Conclusion', pageNumber: 12, level: 0 },
];
const REPORT_PAGES = 15;

/** Depth-first flatten of a node forest keyed by title, for structural assertions. */
function shape(nodes: OutlineNode[]): unknown {
  return nodes.map((n) => ({
    title: n.title,
    start: n.start,
    end: n.end,
    children: n.children.length ? shape(n.children) : undefined,
  }));
}

const findByTitle = (nodes: OutlineNode[], title: string): OutlineNode => {
  for (const n of nodes) {
    if (n.title === title) return n;
    const hit = n.children.length ? findByTitleSafe(n.children, title) : undefined;
    if (hit) return hit;
  }
  throw new Error(`no node titled ${title}`);
};
const findByTitleSafe = (nodes: OutlineNode[], title: string): OutlineNode | undefined => {
  for (const n of nodes) {
    if (n.title === title) return n;
    const hit = findByTitleSafe(n.children, title);
    if (hit) return hit;
  }
  return undefined;
};

describe('buildOutlineTree', () => {
  it('nests subsections under their parent and derives page ranges from the next non-descendant', () => {
    const tree = buildOutlineTree(REPORT, REPORT_PAGES);
    expect(shape(tree)).toEqual([
      { title: '1. Introduction', start: 1, end: 2, children: undefined },
      {
        title: '2. Methods',
        start: 3,
        end: 8, // spans through its subsections, up to Results (p9) − 1
        children: [
          { title: '2.1 Data', start: 4, end: 5, children: undefined },
          { title: '2.2 Model', start: 6, end: 8, children: undefined },
        ],
      },
      { title: '3. Results', start: 9, end: 11, children: undefined },
      { title: '4. Conclusion', start: 12, end: 15, children: undefined }, // last → pageCount
    ]);
  });

  it('treats a level skip (0 → 2) as ordinary nesting', () => {
    const skipped: OutlineEntry[] = [
      { title: 'A', pageNumber: 1, level: 0 },
      { title: 'A.i', pageNumber: 2, level: 2 }, // jumps past level 1
      { title: 'B', pageNumber: 5, level: 0 },
    ];
    const tree = buildOutlineTree(skipped, 6);
    expect(tree).toHaveLength(2);
    expect(tree[0].children.map((c) => c.title)).toEqual(['A.i']);
    expect(tree[0].end).toBe(4); // up to B (p5) − 1
  });

  it('keeps a single top-level section spanning the whole document', () => {
    const tree = buildOutlineTree([{ title: 'Only', pageNumber: 1, level: 0 }], 10);
    expect(tree[0].end).toBe(10);
  });
});

describe('leafKeys', () => {
  it('returns the section itself when it is a leaf', () => {
    const tree = buildOutlineTree(REPORT, REPORT_PAGES);
    expect(leafKeys(findByTitle(tree, '1. Introduction'))).toEqual([0]);
  });

  it('returns all leaf descendants for an internal section', () => {
    const tree = buildOutlineTree(REPORT, REPORT_PAGES);
    expect(leafKeys(findByTitle(tree, '2. Methods'))).toEqual([2, 3]); // Data, Model
  });
});

describe('nodeState', () => {
  const tree = buildOutlineTree(REPORT, REPORT_PAGES);
  const methods = findByTitle(tree, '2. Methods');

  it('is off when no descendant leaf is checked', () => {
    expect(nodeState(methods, new Set())).toBe('off');
  });

  it('is on when every descendant leaf is checked', () => {
    expect(nodeState(methods, new Set([2, 3]))).toBe('on');
  });

  it('is mixed when only some descendant leaves are checked', () => {
    expect(nodeState(methods, new Set([2]))).toBe('mixed');
  });
});

describe('selectedPages', () => {
  const tree = buildOutlineTree(REPORT, REPORT_PAGES);

  it('collapses a fully-checked section to its whole range, including intro pages', () => {
    // Both Methods subsections checked → Methods is "on" → its full [3,8] range,
    // which includes p3 (chapter intro, before 2.1 Data at p4).
    expect(selectedPages(tree, new Set([2, 3]))).toEqual([3, 4, 5, 6, 7, 8]);
  });

  it('descends into a partially-checked section and takes only the checked child', () => {
    expect(selectedPages(tree, new Set([2]))).toEqual([4, 5]); // just 2.1 Data
  });

  it('unions non-contiguous selections in page order', () => {
    // Introduction [1,2] + Results [9,10,11]
    expect(selectedPages(tree, new Set([0, 4]))).toEqual([1, 2, 9, 10, 11]);
  });

  it('covers the whole document when every leaf is checked', () => {
    const all = new Set([0, 2, 3, 4, 5]);
    expect(selectedPages(tree, all)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
  });

  it('returns nothing for an empty selection', () => {
    expect(selectedPages(tree, new Set())).toEqual([]);
  });
});

describe('single-child chains', () => {
  // Checking the deepest leaf must light up (and collapse) every ancestor.
  const chain: OutlineEntry[] = [
    { title: 'A', pageNumber: 1, level: 0 },
    { title: 'A.1', pageNumber: 2, level: 1 },
    { title: 'A.1.1', pageNumber: 3, level: 2 },
  ];
  const tree = buildOutlineTree(chain, 5);

  it('marks all ancestors on when the only leaf is checked', () => {
    expect(nodeState(tree[0], new Set([2]))).toBe('on'); // A
    expect(nodeState(tree[0].children[0], new Set([2]))).toBe('on'); // A.1
  });

  it('collapses to the top section range so intermediate intro pages are covered', () => {
    expect(selectedPages(tree, new Set([2]))).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('selectedTitles', () => {
  const tree = buildOutlineTree(REPORT, REPORT_PAGES);

  it('names the maximal fully-checked section, not its children', () => {
    expect(selectedTitles(tree, new Set([2, 3]))).toEqual(['2. Methods']);
  });

  it('names a checked child when its parent is only partial', () => {
    expect(selectedTitles(tree, new Set([2]))).toEqual(['2.1 Data']);
  });

  it('lists each maximal section when the whole document is checked', () => {
    expect(selectedTitles(tree, new Set([0, 2, 3, 4, 5]))).toEqual([
      '1. Introduction',
      '2. Methods',
      '3. Results',
      '4. Conclusion',
    ]);
  });
});

describe('sectionPathForPage', () => {
  const tree = buildOutlineTree(REPORT, REPORT_PAGES);
  const titles = (page: number) => sectionPathForPage(tree, page).map((n) => n.title);

  it('returns the ancestor chain, deepest included', () => {
    // p4 is in 2.1 Data, under 2. Methods.
    expect(titles(4)).toEqual(['2. Methods', '2.1 Data']);
  });

  it('stops at the parent for a section intro page (before its first subsection)', () => {
    // p3 is Methods itself; its first subsection (2.1 Data) starts at p4.
    expect(titles(3)).toEqual(['2. Methods']);
  });

  it('returns a single top-level section when there are no subsections', () => {
    expect(titles(1)).toEqual(['1. Introduction']);
    expect(titles(13)).toEqual(['4. Conclusion']);
  });

  it('returns an empty path for pages outside every section range', () => {
    // The outline starts at p1 and Conclusion ends at the last page (15).
    expect(sectionPathForPage(tree, 16)).toEqual([]);
    expect(sectionPathForPage([], 1)).toEqual([]);
  });
});
