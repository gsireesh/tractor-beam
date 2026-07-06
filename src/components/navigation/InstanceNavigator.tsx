import { type Dispatch, type SetStateAction, useState } from 'react';
import { ChevronDown, ChevronRight, Search, X } from 'lucide-react';
import { Highlight, Signpost } from '@/lib/definitions.ts';
import { ConfirmedHighlightSignpost } from '@/components/navigation/ConfirmedHighlightSignpost.tsx';
import { ProvisionalHighlightSignpost } from '@/components/navigation/ProvisionalHighlightSignpost.tsx';
import { sortByPageCompare } from '@/lib/utils.ts';
import {
  activeFilterCount,
  applyNavigatorFilter,
  classFacets,
  EMPTY_FILTER,
  filterIsActive,
  type NavigatorFilter,
  pageRangeIsActive,
  sectionCountsByKey,
} from '@/lib/navigator-filters.ts';
import { type OutlineNode, sectionPathForPage } from '@/lib/pdf/outline-tree.ts';
import { Toggle } from '@/components/ui/toggle.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Checkbox } from '@/components/ui/checkbox.tsx';
import { Input } from '@/components/ui/input.tsx';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group.tsx';

interface InstanceNavigatorProps {
  mlSignposts: Signpost[];
  confirmedSignposts: Signpost[];
  /** Filter state, lifted so it drives both this list and the in-page viewer. */
  filter: NavigatorFilter;
  setFilter: Dispatch<SetStateAction<NavigatorFilter>>;
  /** PDF outline tree; drives the Section filter and the per-card section chips. */
  outlineRoots: OutlineNode[];
}

export const SEARCH_PLACEHOLDER_TEXT = 'Filter by highlighted text…';

/** A labeled group of filter chips inside the expandable panel. */
function FacetSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="px-1 text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/**
 * One node of the Section filter tree. Unlike ScopeSectionTree's leaf-derived
 * tri-state, each checkbox toggles exactly its own node key into
 * filter.sectionKeys — selecting a parent still matches every descendant because
 * the predicate matches on the page's full section path. Children are collapsed
 * by default and revealed with the caret, so a deep ToC stays scannable.
 */
function SectionNode({
  node,
  selected,
  counts,
  onToggle,
}: {
  node: OutlineNode;
  selected: ReadonlySet<number>;
  counts: Map<number, number>;
  onToggle: (key: number, checked: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = node.children.length > 0;
  const id = `filter-section-${node.key}`;
  return (
    <div>
      <div className="flex items-center gap-1 rounded-sm px-1 py-0.5 hover:bg-accent">
        {hasChildren ? (
          <button
            type="button"
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${node.title}`}
            className="flex size-4 shrink-0 items-center justify-center text-muted-foreground"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          </button>
        ) : (
          // Spacer so leaf checkboxes line up under their siblings' checkboxes.
          <span className="size-4 shrink-0" />
        )}
        <Checkbox
          id={id}
          checked={selected.has(node.key)}
          onCheckedChange={(c) => onToggle(node.key, c === true)}
        />
        <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer truncate text-sm">
          {node.title} ({counts.get(node.key) ?? 0})
        </label>
      </div>
      {hasChildren && expanded && (
        <div className="ml-4 border-l border-border pl-1">
          {node.children.map((child) => (
            <SectionNode
              key={child.key}
              node={child}
              selected={selected}
              counts={counts}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function InstanceNavigator({
  confirmedSignposts,
  mlSignposts,
  filter,
  setFilter,
  outlineRoots,
}: InstanceNavigatorProps) {
  // The richer, potentially-long metadata filters (class, page, section) live
  // behind a disclosure so the common case (source + text) stays compact. Source
  // and text stay always-visible; the active-filter indicator is always visible
  // too, so a filter hidden inside a collapsed panel is never a mystery.
  const [filtersOpen, setFiltersOpen] = useState(false);

  const toggleSource = (source: Highlight['source'], pressed: boolean) =>
    setFilter((prev) => {
      const sources = new Set(prev.sources);
      if (pressed) sources.add(source);
      else sources.delete(source);
      return { ...prev, sources };
    });
  const toggleClass = (classId: string, pressed: boolean) =>
    setFilter((prev) => {
      const classIds = new Set(prev.classIds);
      if (pressed) classIds.add(classId);
      else classIds.delete(classId);
      return { ...prev, classIds };
    });
  const toggleSection = (key: number, checked: boolean) =>
    setFilter((prev) => {
      const sectionKeys = new Set(prev.sectionKeys);
      if (checked) sectionKeys.add(key);
      else sectionKeys.delete(key);
      return { ...prev, sectionKeys };
    });
  // Page filtering is a range (a chip-per-page doesn't scale on long documents).
  const setPageBound = (which: 'from' | 'to', value: number | null) =>
    setFilter((prev) => ({ ...prev, pageRange: { ...prev.pageRange, [which]: value } }));
  // A card's page badge collapses the range to that single page; clicking the same
  // page again (range already [p, p]) clears it.
  const filterByPage = (page: number) =>
    setFilter((prev) => {
      const isJustThisPage = prev.pageRange.from === page && prev.pageRange.to === page;
      return {
        ...prev,
        pageRange: isJustThisPage ? { from: null, to: null } : { from: page, to: page },
      };
    });
  // Clicking a card's section chip toggles that section and reveals the panel so
  // the section tree (with its now-active checkbox) is in view.
  const filterBySection = (key: number) => {
    setFilter((prev) => {
      const sectionKeys = new Set(prev.sectionKeys);
      if (sectionKeys.has(key)) sectionKeys.delete(key);
      else sectionKeys.add(key);
      return { ...prev, sectionKeys };
    });
    setFiltersOpen(true);
  };
  const setQuery = (query: string) => setFilter((prev) => ({ ...prev, query }));

  // page → section-key path, for the same predicate the viewer uses.
  const sectionOf = (page: number) => sectionPathForPage(outlineRoots, page).map((n) => n.key);

  const all = [...confirmedSignposts, ...mlSignposts];
  const visible = applyNavigatorFilter(all, filter, sectionOf).sort(sortByPageCompare);
  const hiddenCount = all.length - visible.length;
  const active = filterIsActive(filter);
  const classes = classFacets(all);
  const sectionCounts = sectionCountsByKey(outlineRoots, all);
  // Page bounds present in the data, shown as the range inputs' placeholders.
  const pagesPresent = all
    .map((sp) => sp.coords[0]?.pageNumber)
    .filter((p): p is number => p !== undefined);
  const hasPages = pagesPresent.length > 0;
  const hasPanel = classes.length > 0 || hasPages || outlineRoots.length > 0;
  // Active dimensions that live inside the (possibly collapsed) panel — surfaced as
  // a badge on the disclosure button so they're discoverable when collapsed.
  const panelActiveCount =
    (filter.classIds.size > 0 ? 1 : 0) +
    (pageRangeIsActive(filter.pageRange) ? 1 : 0) +
    (filter.sectionKeys.size > 0 ? 1 : 0);

  return (
    <>
      <div className="sticky top-0 z-10 mb-2 flex flex-col gap-2 border-b border-border bg-card pb-2">
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            placeholder={SEARCH_PLACEHOLDER_TEXT}
            value={filter.query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {filter.query && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label="Clear search"
                onClick={() => setQuery('')}
              >
                <X />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
        <div className="flex flex-wrap items-center gap-2">
          <Toggle
            variant="outline"
            size="sm"
            className="mx-1 my-1 rounded-full"
            pressed={filter.sources.has('manual')}
            onPressedChange={(p) => toggleSource('manual', p)}
          >
            Confirmed ({confirmedSignposts.length})
          </Toggle>
          <Toggle
            variant="outline"
            size="sm"
            className="mx-1 my-1 rounded-full"
            pressed={filter.sources.has('ml')}
            onPressedChange={(p) => toggleSource('ml', p)}
          >
            Suggested ({mlSignposts.length})
          </Toggle>
          {hasPanel && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 gap-1 px-2 text-xs"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((o) => !o)}
            >
              {filtersOpen ? <ChevronDown /> : <ChevronRight />}
              More filters
              {panelActiveCount > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-[10px] leading-4 text-primary-foreground">
                  {panelActiveCount}
                </span>
              )}
            </Button>
          )}
        </div>
        {active && (
          <div className="flex items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
            <span>
              {activeFilterCount(filter)} filter{activeFilterCount(filter) === 1 ? '' : 's'} active
              {hiddenCount > 0 && <> · {hiddenCount} hidden</>}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={() => setFilter(EMPTY_FILTER)}
            >
              Reset
            </Button>
          </div>
        )}
        {filtersOpen && hasPanel && (
          <div className="flex flex-col gap-3 px-1 pt-1">
            {classes.length > 0 && (
              <FacetSection label="Class">
                {classes.map((f) => (
                  <Toggle
                    key={f.classId}
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    pressed={filter.classIds.has(f.classId)}
                    onPressedChange={(p) => toggleClass(f.classId, p)}
                  >
                    <span
                      className="mr-1 inline-block size-2 rounded-full"
                      style={{ backgroundColor: f.color }}
                    />
                    {f.className} ({f.count})
                  </Toggle>
                ))}
              </FacetSection>
            )}
            {hasPages && (
              <div className="flex flex-col gap-1">
                <span className="px-1 text-xs font-medium text-muted-foreground">Page range</span>
                <div className="flex items-center gap-2 px-1">
                  <Input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    aria-label="Page from"
                    placeholder={String(Math.min(...pagesPresent))}
                    className="h-7 w-20"
                    value={filter.pageRange.from ?? ''}
                    onChange={(e) =>
                      setPageBound('from', e.target.value === '' ? null : Number(e.target.value))
                    }
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    aria-label="Page to"
                    placeholder={String(Math.max(...pagesPresent))}
                    className="h-7 w-20"
                    value={filter.pageRange.to ?? ''}
                    onChange={(e) =>
                      setPageBound('to', e.target.value === '' ? null : Number(e.target.value))
                    }
                  />
                </div>
              </div>
            )}
            {outlineRoots.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="px-1 text-xs font-medium text-muted-foreground">Section</span>
                <div className="max-h-48 overflow-y-auto">
                  {outlineRoots.map((node) => (
                    <SectionNode
                      key={node.key}
                      node={node}
                      selected={filter.sectionKeys}
                      counts={sectionCounts}
                      onToggle={toggleSection}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {visible.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-muted-foreground">
          No matching instances.
        </p>
      ) : (
        visible.map((sp) => {
          const page = sp.coords[0]?.pageNumber;
          const sectionPath =
            page === undefined
              ? []
              : sectionPathForPage(outlineRoots, page).map((n) => ({ key: n.key, title: n.title }));
          const chipProps = {
            onPageClick: filterByPage,
            sectionPath,
            onSectionClick: filterBySection,
          };
          return sp.source === 'manual' ? (
            <ConfirmedHighlightSignpost key={sp.id} {...sp} {...chipProps} />
          ) : (
            <ProvisionalHighlightSignpost key={sp.id} {...sp} {...chipProps} />
          );
        })
      )}
    </>
  );
}
