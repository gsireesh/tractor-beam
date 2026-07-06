// @vitest-environment jsdom
// ^ This pragma opts THIS file into the jsdom DOM environment. Without it the
//   file would run in the default 'node' env and `render` would have no document.
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { InstanceNavigator, SEARCH_PLACEHOLDER_TEXT } from './InstanceNavigator';
import { EMPTY_FILTER, type NavigatorFilter } from '@/lib/navigator-filters.ts';
import type { Signpost } from '@/lib/definitions.ts';

// Mock the child signposts. They drag in DrawerContext + a portal + window
// globals — none of which is the navigator's logic. We replace them with trivial
// stand-ins that just surface each signpost's text, isolating the filter pipeline.
// vi.mock is HOISTED above the imports, so the factory can't reference outer
// variables; it returns the same named exports the real modules do.
vi.mock('@/components/navigation/ConfirmedHighlightSignpost.tsx', () => ({
  ConfirmedHighlightSignpost: (props: { text?: string }) => (
    <div data-testid="signpost" data-source="confirmed">
      {props.text}
    </div>
  ),
}));
vi.mock('@/components/navigation/ProvisionalHighlightSignpost.tsx', () => ({
  ProvisionalHighlightSignpost: (props: { text?: string }) => (
    <div data-testid="signpost" data-source="provisional">
      {props.text}
    </div>
  ),
}));

// The navigator is a controlled component: filter state is lifted to its parent
// (DrawerContent in the app). This harness plays that parent, holding the filter
// in real useState so the toggles/search/reset drive genuine state transitions.
function renderNavigator(
  props: { confirmedSignposts?: Signpost[]; mlSignposts?: Signpost[] } = {},
) {
  function Harness() {
    const [filter, setFilter] = useState<NavigatorFilter>(EMPTY_FILTER);
    return (
      <InstanceNavigator
        confirmedSignposts={props.confirmedSignposts ?? []}
        mlSignposts={props.mlSignposts ?? []}
        filter={filter}
        setFilter={setFilter}
      />
    );
  }
  return render(<Harness />);
}

// Build fully-shaped Signposts with overridable defaults — same factory pattern
// as the reducer tests, so fixtures stay honest to the real type.
let seq = 0;
function makeSignpost(overrides: Partial<Signpost> = {}): Signpost {
  const n = seq++;
  return {
    id: `sp-${n}`,
    classId: 'c1',
    schemaId: 's1',
    coords: [{ pageNumber: 1, left: 0, top: 0, width: 0.1, height: 0.1 }],
    source: 'manual',
    text: `signpost ${n}`,
    color: 'rgba(0, 0, 0, 0.3)',
    positiveExample: true,
    className: 'Some Class',
    ...overrides,
  };
}

describe('InstanceNavigator', () => {
  // Worked example: with empty signpost lists, no child signposts render, so the
  // component needs no DrawerContext/portal — a clean smoke test of render + query.
  // Note we query the way a USER perceives the UI: by visible text and by the
  // accessible role/name of controls, never by class names or internal state.
  it('shows the empty state and zero counts when there are no signposts', () => {
    renderNavigator();

    expect(screen.getByText('No matching instances.')).toBeInTheDocument();
    // Toggles are buttons; their accessible name is their text content.
    expect(screen.getByRole('button', { name: /Confirmed · 0/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Suggested · 0/ })).toBeInTheDocument();
  });

  it('shows the clear search icon only when search is populated', async () => {
    const user = userEvent.setup();
    renderNavigator();

    expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();

    const input = screen.getByPlaceholderText(SEARCH_PLACEHOLDER_TEXT);
    await user.type(input, 'software');

    expect(input).toHaveValue('software');

    const clearButton = screen.queryByRole('button', { name: /clear search/i });
    if (clearButton === null) expect.unreachable('Clear button did not appear!');

    await user.click(clearButton);
    expect(input).toHaveValue('');
    expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();
  });

  describe('source filtering', () => {
    // Worked example: proves the mocked children render and the default state
    // (both sources enabled) shows every signpost. We assert by the text each
    // stand-in surfaces — what the user would see — not by internal state.
    it('renders one card per signpost when both sources are enabled', () => {
      const confirmed = [makeSignpost({ text: 'alpha' }), makeSignpost({ text: 'beta' })];
      const ml = [makeSignpost({ text: 'gamma', source: 'ml' })];

      renderNavigator({ confirmedSignposts: confirmed, mlSignposts: ml });

      expect(screen.getAllByTestId('signpost')).toHaveLength(3);
      expect(screen.getByText('alpha')).toBeInTheDocument();
      expect(screen.getByText('gamma')).toBeInTheDocument();
    });

    it('renders only the selected source', async () => {
      const confirmed = [makeSignpost({ text: 'alpha' }), makeSignpost({ text: 'beta' })];
      const ml = [makeSignpost({ text: 'gamma', source: 'ml' })];

      const user = userEvent.setup();

      renderNavigator({ confirmedSignposts: confirmed, mlSignposts: ml });

      expect(screen.getAllByTestId('signpost')).toHaveLength(3);

      await user.click(screen.getByRole('button', { name: /confirmed/i }));

      expect(screen.getAllByTestId('signpost')).toHaveLength(2);
      expect(screen.getByText('alpha')).toBeInTheDocument();
      expect(screen.queryByText('gamma')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /suggested/i }));
      expect(screen.queryAllByTestId('signpost')).toHaveLength(3);

      await user.click(screen.getByRole('button', { name: /confirmed/i }));
      expect(screen.getAllByTestId('signpost')).toHaveLength(1);
      expect(screen.getByText('gamma')).toBeInTheDocument();
      expect(screen.queryByText('alpha')).not.toBeInTheDocument();
    });
  });

  describe('text filtering', () => {
    it('shows only signposts whose text matches the query (case-insensitive)', async () => {
      const user = userEvent.setup();
      const confirmed = [
        makeSignpost({ text: 'invoice total' }),
        makeSignpost({ text: 'invoice date' }),
        makeSignpost({ text: 'shipping address' }),
      ];

      renderNavigator({ confirmedSignposts: confirmed });
      expect(screen.getAllByTestId('signpost')).toHaveLength(3);

      // Query is upper-case; the filter lowercases both sides, so it still matches.
      await user.type(screen.getByPlaceholderText(SEARCH_PLACEHOLDER_TEXT), 'INVOICE');

      expect(screen.getAllByTestId('signpost')).toHaveLength(2);
      expect(screen.getByText('invoice total')).toBeInTheDocument();
      expect(screen.getByText('invoice date')).toBeInTheDocument();
      expect(screen.queryByText('shipping address')).not.toBeInTheDocument();
    });

    it('shows the empty state when no signpost text matches the query', async () => {
      const user = userEvent.setup();

      renderNavigator({ confirmedSignposts: [makeSignpost({ text: 'invoice total' })] });

      await user.type(screen.getByPlaceholderText(SEARCH_PLACEHOLDER_TEXT), 'zzz');

      // queryAllByTestId (not getAllBy) so zero matches returns [] instead of throwing.
      expect(screen.queryAllByTestId('signpost')).toHaveLength(0);
      expect(screen.getByText('No matching instances.')).toBeInTheDocument();
    });
  });

  describe('active-filter indicator and reset', () => {
    it('hides the indicator when no filter is active', () => {
      renderNavigator({ confirmedSignposts: [makeSignpost()] });
      expect(screen.queryByRole('button', { name: /reset/i })).not.toBeInTheDocument();
    });

    it('surfaces the active count + hidden count, and Reset restores everything', async () => {
      const user = userEvent.setup();
      const confirmed = [makeSignpost({ text: 'alpha' }), makeSignpost({ text: 'beta' })];
      const ml = [makeSignpost({ text: 'gamma', source: 'ml' })];

      renderNavigator({ confirmedSignposts: confirmed, mlSignposts: ml });

      // Engage one dimension: show only Suggested. 2 confirmed become hidden.
      await user.click(screen.getByRole('button', { name: /suggested/i }));
      expect(screen.getAllByTestId('signpost')).toHaveLength(1);
      expect(screen.getByText(/1 filter active/)).toBeInTheDocument();
      expect(screen.getByText(/2 hidden/)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /^reset$/i }));

      expect(screen.getAllByTestId('signpost')).toHaveLength(3);
      expect(screen.queryByRole('button', { name: /^reset$/i })).not.toBeInTheDocument();
    });
  });
});
