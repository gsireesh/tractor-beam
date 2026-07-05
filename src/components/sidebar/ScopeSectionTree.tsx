import { useMemo, useState } from 'react';
import { Highlighter } from 'lucide-react';
import type { OutlineEntry } from '@/lib/definitions.ts';
import {
  buildOutlineTree,
  leafKeys,
  nodeState,
  selectedPages,
  selectedTitles,
  type OutlineNode,
  type SectionCheckState,
} from '@/lib/pdf/outline-tree.ts';
import { IconButton } from '@/components/ui/IconButton.tsx';
import { Checkbox } from '@/components/ui/checkbox.tsx';
import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu.tsx';

interface ScopeSectionTreeProps {
  /** Flat outline, or null while it is still being read from the PDF. */
  outline: OutlineEntry[] | null;
  pageCount: number;
  /** Disable the run button (e.g. while a run is in progress). */
  disabled?: boolean;
  /** Fired by the single Highlighter button with the union of selected pages. */
  onAnnotate: (pages: number[], label: string) => void;
}

/**
 * "Annotate by section": a tri-state checkbox tree over the PDF's table of contents.
 * Checking a section checks its subsections; unchecking one subsection drops its parent
 * to the indeterminate state (state is derived from the leaves — see nodeState). A single
 * Highlighter button runs one annotation pass over the union of the selected sections.
 */
export function ScopeSectionTree({
  outline,
  pageCount,
  disabled,
  onAnnotate,
}: ScopeSectionTreeProps) {
  const roots = useMemo(
    () => (outline ? buildOutlineTree(outline, pageCount) : []),
    [outline, pageCount],
  );
  const allLeaves = useMemo(() => roots.flatMap(leafKeys), [roots]);
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const pages = useMemo(() => selectedPages(roots, checked), [roots, checked]);

  const allState: SectionCheckState =
    allLeaves.length === 0 || !allLeaves.some((k) => checked.has(k))
      ? 'off'
      : allLeaves.every((k) => checked.has(k))
        ? 'on'
        : 'mixed';

  function toggle(node: OutlineNode) {
    const leaves = leafKeys(node);
    const turnOff = nodeState(node, checked) === 'on';
    setChecked((prev) => {
      const next = new Set(prev);
      leaves.forEach((k) => (turnOff ? next.delete(k) : next.add(k)));
      return next;
    });
  }

  function toggleAll() {
    setChecked(allState === 'on' ? new Set() : new Set(allLeaves));
  }

  function annotate() {
    if (pages.length === 0) return;
    const titles = selectedTitles(roots, checked);
    const label =
      allState === 'on'
        ? 'All sections'
        : titles.length === 1
          ? titles[0]
          : `${titles.length} sections`;
    onAnnotate(pages, label);
  }

  const renderNodes = (nodes: OutlineNode[]) =>
    nodes.map((node) => {
      const s = nodeState(node, checked);
      const id = `scope-section-${node.key}`;
      return (
        <div key={node.key}>
          <div className="flex items-center gap-2 rounded-sm px-2 py-1 hover:bg-accent">
            <Checkbox
              id={id}
              checked={s === 'mixed' ? 'indeterminate' : s === 'on'}
              onCheckedChange={() => toggle(node)}
              onKeyDown={(e) => e.stopPropagation()}
            />
            <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer truncate text-sm">
              {node.title}
            </label>
          </div>
          {/* The border-l is the hierarchy guide line; ml/pl set the indent. */}
          {node.children.length > 0 && (
            <div className="ml-4 border-l border-border pl-1">{renderNodes(node.children)}</div>
          )}
        </div>
      );
    });

  return (
    <>
      <DropdownMenuSeparator />
      <div className="flex items-center justify-between gap-2 px-2 py-1">
        <span className="text-xs font-medium text-muted-foreground">Annotate by section</span>
        <IconButton
          title="Annotate selected sections"
          variant="default"
          icon={Highlighter}
          color={null}
          size="icon-sm"
          disabled={disabled || pages.length === 0}
          onClick={annotate}
        />
      </div>

      {outline === null ? (
        <div className="px-2 py-1.5 text-sm text-muted-foreground">Reading…</div>
      ) : outline.length === 0 ? (
        <div className="px-2 py-1.5 text-sm italic text-muted-foreground">
          No table of contents in this PDF
        </div>
      ) : (
        <div className="max-h-56 overflow-y-auto">
          <div className="flex items-center gap-2 rounded-sm px-2 py-1 hover:bg-accent">
            <Checkbox
              id="scope-section-all"
              checked={allState === 'mixed' ? 'indeterminate' : allState === 'on'}
              onCheckedChange={toggleAll}
              onKeyDown={(e) => e.stopPropagation()}
            />
            <label
              htmlFor="scope-section-all"
              className="flex-1 cursor-pointer text-sm font-medium"
            >
              All sections
            </label>
          </div>
          {renderNodes(roots)}
        </div>
      )}
    </>
  );
}
