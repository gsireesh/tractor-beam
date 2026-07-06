// @vitest-environment jsdom
// ^ This pragma opts THIS file into the jsdom DOM environment. Without it the
//   file would run in the default 'node' env and `render` would have no document.
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { InstanceNavigator, SEARCH_PLACEHOLDER_TEXT } from './InstanceNavigator';
import { EMPTY_FILTER, type NavigatorFilter } from '@/lib/navigator-filters.ts';
import { buildOutlineTree, type OutlineNode } from '@/lib/pdf/outline-tree.ts';
import type { Signpost } from '@/lib/definitions.ts';

// Mock the child signposts. They drag in DrawerContext + a portal + window
// globals — none of which is the navigator's logic. We replace them with trivial
// stand-ins that just surface each signpost's text, isolating the filter pipeline.
// vi.mock is HOISTED above the imports, so the factory can't reference outer
// variables; it returns the same named exports the real modules do.
// Stand-ins surface each signpost's text and expose the onPageClick wiring via a
// button, so we can exercise "click the page badge → filter to that page" without
// mounting the real card (DrawerContext, portals, editors).
type StubProps = {
  text?: string;
  coords?: { pageNumber: number }[];
  onPageClick?: (page: number) => void;
  sectionPath?: { key: number; title: string }[];
  onSectionClick?: (key: number) => void;
};
// Each stand-in surfaces its text plus the onPageClick / onSectionClick wiring as
// buttons, so we can exercise "click the page/section chip → filter" without
// mounting the real card. The JSX is inlined per factory (not a shared helper)
// because vi.mock is hoisted above every module-level binding.
vi.mock('@/components/navigation/ConfirmedHighlightSignpost.tsx', () => ({
  ConfirmedHighlightSignpost: (props: StubProps) => (
    <div data-testid="signpost" data-source="confirmed">
      {props.text}
      <button
        data-testid="page-badge"
        onClick={() => props.onPageClick?.(props.coords?.[0]?.pageNumber ?? 0)}
      >
        page
      </button>
      {props.sectionPath?.map((s) => (
        <button
          key={s.key}
          data-testid="section-badge"
          onClick={() => props.onSectionClick?.(s.key)}
        >
          {s.title}
        </button>
      ))}
    </div>
  ),
}));
vi.mock('@/components/navigation/ProvisionalHighlightSignpost.tsx', () => ({
  ProvisionalHighlightSignpost: (props: StubProps) => (
    <div data-testid="signpost" data-source="provisional">
      {props.text}
      <button
        data-testid="page-badge"
        onClick={() => props.onPageClick?.(props.coords?.[0]?.pageNumber ?? 0)}
      >
        page
      </button>
      {props.sectionPath?.map((s) => (
        <button
          key={s.key}
          data-testid="section-badge"
          onClick={() => props.onSectionClick?.(s.key)}
        >
          {s.title}
        </button>
      ))}
    </div>
  ),
}));

// The navigator is a controlled component: filter state is lifted to its parent
// (DrawerContent in the app). This harness plays that parent, holding the filter
// in real useState so the toggles/search/reset drive genuine state transitions.
function renderNavigator(
  props: {
    confirmedSignposts?: Signpost[];
    mlSignposts?: Signpost[];
    outlineRoots?: OutlineNode[];
  } = {},
) {
  function Harness() {
    const [filter, setFilter] = useState<NavigatorFilter>(EMPTY_FILTER);
    return (
      <InstanceNavigator
        confirmedSignposts={props.confirmedSignposts ?? []}
        mlSignposts={props.mlSignposts ?? []}
        filter={filter}
        setFilter={setFilter}
        outlineRoots={props.outlineRoots ?? []}
      />
    );
  }
  return render(<Harness />);
}

// A small two-chapter outline: Chapter 1 spans pages 1–4 (with subsection 1.1 on
// pages 2–4), Chapter 2 spans pages 5–6. Used by the section-filter tests.
const outlineFixture: OutlineNode[] = buildOutlineTree(
  [
    { title: 'Chapter 1', pageNumber: 1, level: 0 },
    { title: 'Section 1.1', pageNumber: 2, level: 1 },
    { title: 'Chapter 2', pageNumber: 5, level: 0 },
  ],
  6,
);
const onPage = (n: number, text: string): Partial<Signpost> => ({
  text,
  coords: [{ pageNumber: n, left: 0, top: 0, width: 1, height: 1 }],
});

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
    expect(screen.getByRole('button', { name: /Confirmed \(0\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Suggested \(0\)/ })).toBeInTheDocument();
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

  describe('expandable panel: class filter', () => {
    it('filters by class chip (revealed under "More filters")', async () => {
      const user = userEvent.setup();
      const confirmed = [
        makeSignpost({ text: 'party a', classId: 'party', className: 'Party' }),
        makeSignpost({ text: 'date a', classId: 'date', className: 'Date' }),
      ];

      renderNavigator({ confirmedSignposts: confirmed });
      // Class chips live inside the collapsed panel.
      expect(screen.queryByRole('button', { name: /Party \(1\)/ })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /more filters/i }));
      await user.click(screen.getByRole('button', { name: /Party \(1\)/ }));

      expect(screen.getAllByTestId('signpost')).toHaveLength(1);
      expect(screen.getByText('party a')).toBeInTheDocument();
      expect(screen.queryByText('date a')).not.toBeInTheDocument();
    });
  });

  describe('page filter', () => {
    it('filters by the From/To range inputs in the panel', async () => {
      const user = userEvent.setup();
      renderNavigator({
        confirmedSignposts: [
          makeSignpost(onPage(2, 'two')),
          makeSignpost(onPage(5, 'five')),
          makeSignpost(onPage(9, 'nine')),
        ],
      });

      await user.click(screen.getByRole('button', { name: /more filters/i }));
      await user.type(screen.getByLabelText('Page from'), '3');
      await user.type(screen.getByLabelText('Page to'), '7');

      expect(screen.getAllByTestId('signpost')).toHaveLength(1);
      expect(screen.getByText('five')).toBeInTheDocument();
    });

    it('the card page badge toggles a single-page range: click filters, click again clears', async () => {
      const user = userEvent.setup();
      renderNavigator({
        confirmedSignposts: [
          makeSignpost(onPage(2, 'on two')),
          makeSignpost(onPage(7, 'on seven')),
        ],
      });

      // Click the page badge on the first card (page 2) → filters to page 2.
      await user.click(screen.getAllByTestId('page-badge')[0]);
      expect(screen.getAllByTestId('signpost')).toHaveLength(1);
      expect(screen.getByText('on two')).toBeInTheDocument();

      // Clicking the same badge again clears the page filter (both cards return).
      await user.click(screen.getAllByTestId('page-badge')[0]);
      expect(screen.getAllByTestId('signpost')).toHaveLength(2);
    });
  });

  describe('section filter (ToC)', () => {
    it('filters by a section checkbox in the panel', async () => {
      const user = userEvent.setup();
      renderNavigator({
        confirmedSignposts: [makeSignpost(onPage(2, 'intro')), makeSignpost(onPage(5, 'ch2 body'))],
        outlineRoots: outlineFixture,
      });

      await user.click(screen.getByRole('button', { name: /more filters/i }));
      await user.click(screen.getByRole('checkbox', { name: /Chapter 2/ }));

      expect(screen.getAllByTestId('signpost')).toHaveLength(1);
      expect(screen.getByText('ch2 body')).toBeInTheDocument();
    });

    it('collapses subsections by default, revealing them via the caret', async () => {
      const user = userEvent.setup();
      renderNavigator({
        confirmedSignposts: [makeSignpost(onPage(2, 'x'))],
        outlineRoots: outlineFixture,
      });

      await user.click(screen.getByRole('button', { name: /more filters/i }));
      // Section 1.1 (child of Chapter 1) is hidden until Chapter 1 is expanded.
      expect(screen.queryByRole('checkbox', { name: /Section 1\.1/ })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /expand Chapter 1/i }));
      expect(screen.getByRole('checkbox', { name: /Section 1\.1/ })).toBeInTheDocument();
    });

    it('selecting a parent section matches pages in its subsections', async () => {
      const user = userEvent.setup();
      renderNavigator({
        confirmedSignposts: [makeSignpost(onPage(2, 'in 1.1')), makeSignpost(onPage(5, 'in ch2'))],
        outlineRoots: outlineFixture,
      });

      await user.click(screen.getByRole('button', { name: /more filters/i }));
      // Page 2 sits under Section 1.1, which sits under Chapter 1; selecting the
      // parent Chapter 1 still matches it (the predicate checks the whole path).
      await user.click(screen.getByRole('checkbox', { name: /Chapter 1/ }));

      expect(screen.getAllByTestId('signpost')).toHaveLength(1);
      expect(screen.getByText('in 1.1')).toBeInTheDocument();
    });

    it('clicking a card section chip filters to that section', async () => {
      const user = userEvent.setup();
      renderNavigator({
        confirmedSignposts: [makeSignpost(onPage(2, 'intro')), makeSignpost(onPage(5, 'ch2 body'))],
        outlineRoots: outlineFixture,
      });

      // The page-5 card renders a single section chip (Chapter 2); click it.
      await user.click(screen.getByRole('button', { name: 'Chapter 2' }));

      expect(screen.getAllByTestId('signpost')).toHaveLength(1);
      expect(screen.getByText('ch2 body')).toBeInTheDocument();
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
