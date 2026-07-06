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
  pageFacets,
} from '@/lib/navigator-filters.ts';
import { Toggle } from '@/components/ui/toggle.tsx';
import { Button } from '@/components/ui/button.tsx';
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

export function InstanceNavigator({
  confirmedSignposts,
  mlSignposts,
  filter,
  setFilter,
}: InstanceNavigatorProps) {
  // The richer, potentially-long metadata filters (class, page) live behind a
  // disclosure so the common case (source + text) stays compact. Source and text
  // stay always-visible; the active-filter indicator is always visible too, so a
  // filter hidden inside a collapsed panel is never a mystery.
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
  const togglePage = (page: number, pressed: boolean) =>
    setFilter((prev) => {
      const pages = new Set(prev.pages);
      if (pressed) pages.add(page);
      else pages.delete(page);
      return { ...prev, pages };
    });
  // Clicking a card's page badge adds that page to the filter (and reveals the panel
  // so the now-active page chip is visible).
  const filterByPage = (page: number) => {
    setFilter((prev) => ({ ...prev, pages: new Set(prev.pages).add(page) }));
    setFiltersOpen(true);
  };
  const setQuery = (query: string) => setFilter((prev) => ({ ...prev, query }));

  // Apply the SAME predicate the viewer uses, then sort by page. Section is not a
  // dimension here yet (no outline threaded in), so sectionOf defaults to no-op.
  const all = [...confirmedSignposts, ...mlSignposts];
  const visible = applyNavigatorFilter(all, filter).sort(sortByPageCompare);
  const hiddenCount = all.length - visible.length;
  const active = filterIsActive(filter);
  const classes = classFacets(all);
  const pages = pageFacets(all);
  // Active dimensions tucked inside the (possibly collapsed) panel — surfaced as a
  // badge on the disclosure button so they're discoverable when collapsed.
  const panelActiveCount = (filter.classIds.size > 0 ? 1 : 0) + (filter.pages.size > 0 ? 1 : 0);

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
        {filtersOpen && (classes.length > 0 || pages.length > 0) && (
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
            {pages.length > 0 && (
              <FacetSection label="Page">
                {pages.map((f) => (
                  <Toggle
                    key={f.page}
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    aria-label={`Page ${f.page}`}
                    pressed={filter.pages.has(f.page)}
                    onPressedChange={(p) => togglePage(f.page, p)}
                  >
                    {f.page} ({f.count})
                  </Toggle>
                ))}
              </FacetSection>
            )}
          </div>
        )}
      </div>
      {visible.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-muted-foreground">
          No matching instances.
        </p>
      ) : (
        visible.map((sp) =>
          sp.source === 'manual' ? (
            <ConfirmedHighlightSignpost key={sp.id} {...sp} onPageClick={filterByPage} />
          ) : (
            <ProvisionalHighlightSignpost key={sp.id} {...sp} onPageClick={filterByPage} />
          ),
        )
      )}
    </>
  );
}
