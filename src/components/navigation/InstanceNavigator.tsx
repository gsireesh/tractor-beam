import { type Dispatch, type SetStateAction } from 'react';
import { Search, X } from 'lucide-react';
import { Highlight, Signpost } from '@/lib/definitions.ts';
import { ConfirmedHighlightSignpost } from '@/components/navigation/ConfirmedHighlightSignpost.tsx';
import { ProvisionalHighlightSignpost } from '@/components/navigation/ProvisionalHighlightSignpost.tsx';
import { sortByPageCompare } from '@/lib/utils.ts';
import {
  activeFilterCount,
  applyNavigatorFilter,
  EMPTY_FILTER,
  filterIsActive,
  type NavigatorFilter,
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

export function InstanceNavigator({
  confirmedSignposts,
  mlSignposts,
  filter,
  setFilter,
}: InstanceNavigatorProps) {
  // Toggle one source ('manual' = Confirmed, 'ml' = Suggested) in the filter,
  // rebuilding the Set rather than mutating the existing one.
  const toggleSource = (source: Highlight['source'], pressed: boolean) =>
    setFilter((prev) => {
      const sources = new Set(prev.sources);
      if (pressed) sources.add(source);
      else sources.delete(source);
      return { ...prev, sources };
    });

  const setQuery = (query: string) => setFilter((prev) => ({ ...prev, query }));

  // Apply the SAME predicate the viewer uses, then sort by page. Section is not a
  // dimension here yet (no outline threaded in), so sectionOf defaults to no-op.
  const all = [...confirmedSignposts, ...mlSignposts];
  const visible = applyNavigatorFilter(all, filter).sort(sortByPageCompare);
  const hiddenCount = all.length - visible.length;
  const active = filterIsActive(filter);

  return (
    <>
      <div className="sticky top-0 z-10 flex flex-col gap-2 bg-card border-b border-border pb-2 mb-2">
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
        <div className="flex flex-wrap gap-2">
          <Toggle
            variant="outline"
            size="sm"
            className="mx-1 my-2 rounded-full"
            pressed={filter.sources.has('manual')}
            onPressedChange={(p) => toggleSource('manual', p)}
          >
            Confirmed · {confirmedSignposts.length}
          </Toggle>
          <Toggle
            variant="outline"
            size="sm"
            className="mx-1 my-2 rounded-full"
            pressed={filter.sources.has('ml')}
            onPressedChange={(p) => toggleSource('ml', p)}
          >
            Suggested · {mlSignposts.length}
          </Toggle>
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
      </div>
      {visible.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-muted-foreground">
          No matching instances.
        </p>
      ) : (
        visible.map((sp) =>
          sp.source === 'manual' ? (
            <ConfirmedHighlightSignpost key={sp.id} {...sp} />
          ) : (
            <ProvisionalHighlightSignpost key={sp.id} {...sp} />
          ),
        )
      )}
    </>
  );
}
