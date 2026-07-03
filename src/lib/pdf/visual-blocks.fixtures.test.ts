import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { groupItemsIntoBlocks } from '@/lib/pdf/visual-blocks.ts';
import type { VisualBlock, VisualBlockItem } from '@/lib/definitions.ts';

/**
 * XY-cut / block-segmentation against REAL extracted PDF pages. Each `*.items.json` here
 * was produced by scripts/extract-fixture-items.mjs from a trimmed source PDF in
 * test/fixtures/pdf/original/, using pdf.js pinned to the vendored version — the exact path
 * the extension uses. Regenerate with `pnpm run fixtures:extract` after changing extraction.
 *
 * Every fixture now segments correctly and gets regression assertions. Three of them
 * (tobuild.p1/p2, nas.p7) started as characterization `it.fails` documenting known-wrong
 * output; fixing the segmenter (profile-valley gutter + adaptive paragraph grouping)
 * flipped them, and they were promoted to the real assertions below. The `it.fails`
 * pattern remains the way to pin any future known-wrong page.
 */
const FIX_DIR = fileURLToPath(new URL('../../../test/fixtures/pdf/', import.meta.url));
const fixtures = existsSync(FIX_DIR)
  ? readdirSync(FIX_DIR)
      .filter((f) => f.endsWith('.items.json'))
      .sort()
  : [];

function blocksFor(base: string): VisualBlock[] {
  const items = JSON.parse(
    readFileSync(join(FIX_DIR, `${base}.items.json`), 'utf8'),
  ) as VisualBlockItem[];
  return groupItemsIntoBlocks(items, 1);
}

function blockContaining(blocks: VisualBlock[], needle: string): VisualBlock {
  const block = blocks.find((b) => b.text.includes(needle));
  if (!block) expect.unreachable(`no block containing: ${needle}`);
  return block;
}

const has = (base: string) => fixtures.includes(`${base}.items.json`);

describe('groupItemsIntoBlocks on real PDF fixtures', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  // Full-structure snapshot for every fixture — any change to grouping shows as a diff.
  if (fixtures.length === 0) {
    it.skip('no fixtures present — run pnpm run fixtures:extract', () => {});
  } else {
    it.each(fixtures)('block structure snapshot: %s', (name) => {
      const items = JSON.parse(readFileSync(join(FIX_DIR, name), 'utf8')) as VisualBlockItem[];
      const summary = groupItemsIntoBlocks(items, 1).map((b) => ({
        blockId: b.blockId,
        text: b.text,
      }));
      expect(summary).toMatchSnapshot();
    });
  }

  describe.skipIf(!has('chi_star.p1'))('regression: chi_star.p1 (ACM SIGCHI two-column)', () => {
    const blocks = () => blocksFor('chi_star.p1');
    it('keeps the title as its own block', () => {
      expect(blocks()[0].text).toMatch(/^Collaborative Annotation as an Interface Metaphor/);
    });
    it('separates the Abstract heading from its body', () => {
      expect(blocks().some((b) => b.text === 'Abstract')).toBe(true);
      expect(blockContaining(blocks(), 'In this position paper').text).toContain(
        'wider corpus analysis.',
      );
    });
    it('splits the two Introduction columns into separate, non-bleeding blocks', () => {
      const left = blockContaining(blocks(), 'Reading assistance tools have long');
      expect(left.text).not.toContain('proliferation of systems like SemanticScholar');
    });
  });

  describe.skipIf(!has('sciencedirect.p1'))(
    'regression: sciencedirect.p1 (Elsevier two-column)',
    () => {
      const blocks = () => blocksFor('sciencedirect.p1');
      it('keeps the abstract as one coherent block', () => {
        expect(
          blockContaining(blocks(), 'The fracture behaviour of (Hf-Ta-Zr-Nb)C').text,
        ).toContain('‘defect free’ beams.');
      });
      it('does not bleed the right column into the left (the failure mode we watch for)', () => {
        // Left-column paragraph must not swallow the right column's opening line.
        const left = blockContaining(blocks(), 'Based on the discovery of high-entropy alloys');
        expect(left.text).not.toContain('or cubic solid solution structures');
      });
    },
  );

  describe.skipIf(!has('tobuild.p1'))('regression: tobuild.p1 (ACL title page + figure)', () => {
    // Was characterization (figure axis labels bled into the abstract); fixed by the
    // profile-valley gutter finder, which peels the figure column off the text.
    it('keeps Figure 1 axis labels out of the abstract block', () => {
      const abstract = blockContaining(
        blocksFor('tobuild.p1'),
        'NLP is in a period of disruptive change',
      );
      expect(abstract.text).not.toContain('17500'); // a bar-chart axis label
    });
  });

  describe.skipIf(!has('tobuild.p2'))('regression: tobuild.p2 (ACL two-column body)', () => {
    // Was characterization (one bottom-footnote crosser collapsed both columns into a
    // single interleaved block); fixed by tolerating sparse gutter crossings.
    it('segments the two columns into multiple blocks (not one interleaved block)', () => {
      expect(blocksFor('tobuild.p2').length).toBeGreaterThan(5);
    });
  });

  describe.skipIf(!has('nas_whitepaper.p7'))(
    'regression: nas_whitepaper.p7 (single-column)',
    () => {
      // Was characterization (one block per line); fixed by adaptive paragraph grouping
      // keyed off the region's own line pitch.
      it('groups the Summary paragraph into one block, not one block per line', () => {
        const summary = blockContaining(
          blocksFor('nas_whitepaper.p7'),
          'The electricity system is undergoing',
        );
        expect(summary.text).toContain('serves the public interest.');
      });
    },
  );

  describe.skipIf(!has('hearing_transcript.p12'))(
    'characterization: hearing_transcript.p12 (transcript)',
    () => {
      // Numbered-transcript lines become per-line blocks. Defensible for this layout, so
      // this pins current behavior as a plain assertion rather than an it.fails.
      it('produces per-line blocks (each numbered line stands alone)', () => {
        const blocks = blocksFor('hearing_transcript.p12');
        expect(blocks.length).toBeGreaterThan(15);
        expect(blocks.some((b) => b.text === 'trees.')).toBe(true);
      });
    },
  );
});
