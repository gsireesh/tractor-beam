/**
 * Pure logic for the "annotate by section" checkbox tree: turning pdf.js's flat,
 * depth-first outline into a nested tree, deriving each node's tri-state from which
 * leaves are checked, and collapsing a selection down to the pages it covers.
 *
 * Kept free of React so it can be unit-tested directly; ScopeSectionTree.tsx is the
 * only consumer and holds the checkbox state.
 */

import type { OutlineEntry } from '@/lib/definitions';

export interface OutlineNode {
  key: number; // index into the flat outline
  title: string;
  start: number; // 1-based first page of the section
  end: number; // 1-based last page (inclusive), spanning descendants
  children: OutlineNode[];
}

export type SectionCheckState = 'on' | 'off' | 'mixed';

/** Last page a section spans: up to the next entry at the same or a shallower level. */
function sectionEnd(entries: OutlineEntry[], i: number, pageCount: number): number {
  for (let j = i + 1; j < entries.length; j++) {
    if (entries[j].level <= entries[i].level) {
      return Math.max(entries[i].pageNumber, entries[j].pageNumber - 1);
    }
  }
  return pageCount;
}

/** Rebuild the nested tree from pdf.js's flat, depth-first outline using `level`. */
export function buildOutlineTree(entries: OutlineEntry[], pageCount: number): OutlineNode[] {
  const roots: OutlineNode[] = [];
  const stack: { node: OutlineNode; level: number }[] = [];
  entries.forEach((e, i) => {
    const node: OutlineNode = {
      key: i,
      title: e.title,
      start: e.pageNumber,
      end: sectionEnd(entries, i, pageCount),
      children: [],
    };
    while (stack.length && stack[stack.length - 1].level >= e.level) stack.pop();
    if (stack.length) stack[stack.length - 1].node.children.push(node);
    else roots.push(node);
    stack.push({ node, level: e.level });
  });
  return roots;
}

/** Keys of the leaf sections at or under `node` (a leaf is its own only leaf). */
export function leafKeys(node: OutlineNode): number[] {
  return node.children.length === 0 ? [node.key] : node.children.flatMap(leafKeys);
}

/** A node is on/off/mixed purely by how many of its leaf descendants are checked. */
export function nodeState(node: OutlineNode, checked: ReadonlySet<number>): SectionCheckState {
  const leaves = leafKeys(node);
  const on = leaves.filter((k) => checked.has(k)).length;
  return on === 0 ? 'off' : on === leaves.length ? 'on' : 'mixed';
}

/**
 * Pages the current selection covers: the union of each maximal fully-checked section's
 * full range (which includes its intro pages before the first subsection). Partially
 * checked ("mixed") sections are descended into, so only their checked sub-sections count.
 */
export function selectedPages(roots: OutlineNode[], checked: ReadonlySet<number>): number[] {
  const pages = new Set<number>();
  const walk = (nodes: OutlineNode[]) => {
    for (const node of nodes) {
      const s = nodeState(node, checked);
      if (s === 'on') for (let p = node.start; p <= node.end; p++) pages.add(p);
      else if (s === 'mixed') walk(node.children);
    }
  };
  walk(roots);
  return [...pages].sort((a, b) => a - b);
}

/** Titles of the maximal fully-checked sections, used to label the run. */
export function selectedTitles(roots: OutlineNode[], checked: ReadonlySet<number>): string[] {
  const titles: string[] = [];
  const walk = (nodes: OutlineNode[]) => {
    for (const node of nodes) {
      const s = nodeState(node, checked);
      if (s === 'on') titles.push(node.title);
      else if (s === 'mixed') walk(node.children);
    }
  };
  walk(roots);
  return titles;
}
