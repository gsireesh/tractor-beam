import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { Signpost } from '@/lib/definitions.ts';
import { ConfirmedHighlightSignpost } from '@/components/navigation/ConfirmedHighlightSignpost.tsx';
import { ProvisionalHighlightSignpost } from '@/components/navigation/ProvisionalHighlightSignpost.tsx';
import { sortByPageCompare } from '@/lib/utils.ts';
import { Toggle } from '@/components/ui/toggle.tsx';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group.tsx';

interface InstanceNavigatorProps {
  mlSignposts: Signpost[];
  confirmedSignposts: Signpost[];
}

const defaultSourceState: string[] = [];

export function InstanceNavigator({ confirmedSignposts, mlSignposts }: InstanceNavigatorProps) {
  const [sourceEnabled, setSourceEnabled] = useState<string[]>(defaultSourceState);
  const noneSelected = sourceEnabled.length === 0;
  const [query, setQuery] = useState<string>('');

  const toggleSource = (source: string, pressed: boolean) =>
    setSourceEnabled((prev) => (pressed ? [...prev, source] : prev.filter((s) => s !== source)));

  // Pipeline: filter by source → filter by text → sort by page.
  const bySource = [
    ...(noneSelected || sourceEnabled.includes('confirmed') ? confirmedSignposts : []),
    ...(noneSelected || sourceEnabled.includes('suggested') ? mlSignposts : []),
  ];
  const q = query.trim().toLowerCase();
  const visible = (
    q ? bySource.filter((sp) => (sp.text ?? '').toLowerCase().includes(q)) : bySource
  ).sort(sortByPageCompare);

  return (
    <>
      <div className="sticky top-0 z-10 flex flex-col gap-2 bg-card border-b border-border pb-2 mb-2">
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Filter by text…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
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
            pressed={sourceEnabled.includes('confirmed')}
            onPressedChange={(p) => toggleSource('confirmed', p)}
          >
            Confirmed · {confirmedSignposts.length}
          </Toggle>
          <Toggle
            variant="outline"
            size="sm"
            className="mx-1 my-2 rounded-full"
            pressed={sourceEnabled.includes('suggested')}
            onPressedChange={(p) => toggleSource('suggested', p)}
          >
            Suggested · {mlSignposts.length}
          </Toggle>
        </div>
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
