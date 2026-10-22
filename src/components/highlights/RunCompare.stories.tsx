import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Story } from '@ladle/react';
import { wavyBoxFromHeight } from './wavy-mask';
import { ConfirmedTextHighlight } from './ConfirmedTextHighlight.tsx';
import type { HighlightOverlayProps } from './types.ts';

export default { title: 'Product / Reading Area / Run Compare' };

/**
 * DESIGN MOCKUP — run-vs-run compare mode (not production code).
 *
 * Explores run-identity encodings for A/B run comparison on the PDF. Because
 * the fills are mix-blend-multiply, whatever each run renders composes in the
 * overlap into an emergent "agreement" texture on top of the existing
 * "overlap gets darker" alpha signal.
 *
 * Iteration history:
 *  1. Wire-thin hard-edged hatch stripes — unreadable; stripes live at the
 *     same visual frequency as glyph strokes.
 *  2. Bottom-ribbon barber pole — still intersects descenders, and reads as
 *     noise rather than signal at 6px tall.
 *  3. Soft bands at alpha 0.15 were readable but not distinguishable enough;
 *     straight 2px edge borders were liked but sat too close to the
 *     user-underline vocabulary.
 *  4. (current) BorderVariant is the frontrunner: plain wash + a SQUIGGLY 2px
 *     edge line, top for A, bottom for B — agreement = framed on both edges,
 *     and the squiggle keeps it in the provisional (not user-mark) family.
 *     CompareMode (soft-band hatch) kept for side-by-side reference.
 */

const FRAME_H = 620;

// ─── Hatch styling ───

// Soft-edged band: solid core `bandPx`, linear fade `fadePx` on each side,
// clear `gapPx` between bands. Period = band + 2*fade + gap.
const HATCH = {
  bandPx: 3.5,
  fadePx: 2.5,
  gapPx: 4,
  stripeAlpha: 0.15,
  washAlpha: 0.1, // faint solid fill under the bands so overlap still darkens
};

type HatchParams = typeof HATCH;
type RunSide = 'a' | 'b';

function hatchGradient(rgb: string, side: RunSide, p: HatchParams = HATCH): string {
  // Gradient axis is perpendicular to the visible stripes: -45deg renders ╱ bands, 45deg renders ╲.
  const angle = side === 'a' ? -45 : 45;
  const c = `rgba(${rgb}, ${p.stripeAlpha})`;
  const { bandPx: b, fadePx: f, gapPx: g } = p;
  return `repeating-linear-gradient(${angle}deg, ${c} 0px, ${c} ${b}px, transparent ${b + f}px, transparent ${b + f + g}px, ${c} ${b + 2 * f + g}px)`;
}

function hatchStyle(rgb: string, side: RunSide, p: HatchParams = HATCH) {
  return {
    backgroundColor: `rgba(${rgb}, ${p.washAlpha})`,
    backgroundImage: hatchGradient(rgb, side, p),
  };
}

// ─── Scenario geometry ───

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface RunHighlightProps {
  rgb: string; // 'r, g, b' triplet for the class color
  side: RunSide;
  box: Box;
}

type RunHighlightComponent = (props: RunHighlightProps) => ReactNode;

/**
 * Positioned shell shared by both variants. `masked` children sit inside the
 * squiggle mask; `overlay` children render unmasked on top (for crisp edge
 * lines the wave scallops shouldn't nibble). Both layers multiply-blend.
 */
function PositionedBox({
  box,
  masked,
  overlay,
}: {
  box: Box;
  masked: ReactNode;
  overlay?: ReactNode;
}) {
  const baseHeight = box.height * FRAME_H;
  const { style: wavyStyle, extraHeightPx } = wavyBoxFromHeight(baseHeight);
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${box.left * 100}%`,
        top: `${box.top * 100}%`,
        width: `${box.width * 100}%`,
        height: `calc(${box.height * 100}% + ${extraHeightPx}px)`,
      }}
    >
      <div className="absolute inset-0 rounded-sm mix-blend-multiply" style={wavyStyle}>
        {masked}
      </div>
      {overlay}
    </div>
  );
}

/** Variant 1: soft diagonal bands across the whole highlight. */
function HatchedHighlight({ rgb, side, box }: RunHighlightProps) {
  return (
    <PositionedBox
      box={box}
      masked={<div className="absolute inset-0" style={hatchStyle(rgb, side)} />}
    />
  );
}

// ─── Squiggly edge line (border variant) ───

// The wash's own scallops are only ~1.2px deep at body-text size — a border
// tracing them would read as straight. The edge line gets its own, more
// pronounced wave so "squiggle" is legible at a glance.
const EDGE = { ampPx: 1.75, wavelengthPx: 9, strokePx: 2, alpha: 0.75 };

/** A squiggly 2px line hugging the top (run A) or bottom (run B) edge. */
function SquigglyEdge({ rgb, side }: { rgb: string; side: RunSide }) {
  const { ampPx: a, wavelengthPx: wl, strokePx, alpha } = EDGE;
  const h = 2 * a + strokePx;
  const mid = h / 2;
  // Generate more wave than any span needs; the svg clips at 100% width.
  let d = `M 0 ${mid} Q ${wl / 4} ${mid - a} ${wl / 2} ${mid}`;
  for (let x = wl; x <= 520; x += wl / 2) d += ` T ${x} ${mid}`;
  return (
    <svg
      className="absolute inset-x-0 mix-blend-multiply"
      style={{ [side === 'a' ? 'top' : 'bottom']: 0 }}
      width="100%"
      height={h}
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke={`rgba(${rgb}, ${alpha})`}
        strokeWidth={strokePx}
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Variant 2: plain wash; run identity as a squiggly 2px edge line — top = A, bottom = B.
 *
 * TODO (adoption, not for the mockup): the bottom edge line currently sits at
 * the box's bottom, where it intersects descenders unpleasantly. When this
 * moves to production, extend the default highlight box a bit lower (or offset
 * the bottom squiggle below the box) so the line clears the glyphs.
 */
function BorderHighlight({ rgb, side, box }: RunHighlightProps) {
  return (
    <PositionedBox
      box={box}
      masked={
        <div className="absolute inset-0" style={{ backgroundColor: `rgba(${rgb}, 0.14)` }} />
      }
      overlay={<SquigglyEdge rgb={rgb} side={side} />}
    />
  );
}

// ─── Scenario data ───

const PURPLE = '142, 69, 177';
const TEAL = '13, 148, 136';

// text-[13px] leading-relaxed → ~21.1px lines; first line starts at the 32px frame padding.
const lineTop = (n: number) => (32 + 21.125 * (n - 1)) / FRAME_H;
const LINE_H = 17 / FRAME_H;

const at = (line: number, left: number, width: number): Box => ({
  left,
  top: lineTop(line),
  width,
  height: LINE_H,
});

interface RunSpan {
  rgb: string;
  box: Box;
}

// From top: A only · B only · full agreement · partial overlap · agreement in
// a second class · (lines 14–16) a single three-line A highlight — three coord
// boxes, exactly as production emits — with a B overlap on its middle line.
// The multi-line case is the stress test for per-line edge marks: every box
// draws its own edge squiggle, so does it still read as ONE highlight?
const RUN_A: RunSpan[] = [
  { rgb: PURPLE, box: at(2, 0.1, 0.28) },
  { rgb: PURPLE, box: at(6, 0.15, 0.35) },
  { rgb: PURPLE, box: at(8, 0.1, 0.4) },
  { rgb: TEAL, box: at(10, 0.2, 0.3) },
  { rgb: PURPLE, box: at(14, 0.35, 0.583) },
  { rgb: PURPLE, box: at(15, 0.067, 0.866) },
  { rgb: PURPLE, box: at(16, 0.067, 0.383) },
];
const RUN_B: RunSpan[] = [
  { rgb: PURPLE, box: at(4, 0.45, 0.3) },
  { rgb: PURPLE, box: at(6, 0.15, 0.35) },
  { rgb: PURPLE, box: at(8, 0.3, 0.4) },
  { rgb: TEAL, box: at(10, 0.2, 0.3) },
  { rgb: PURPLE, box: at(15, 0.25, 0.4) },
];

// A confirmed user underline, rendered by the real production component, to
// show the compare encodings coexist with (and don't collide with) user marks.
const confirmedUnderlineProps: HighlightOverlayProps = {
  highlightId: 'confirmed-during-compare',
  classId: 'testClassId',
  schemaId: 'testSchemaId',
  source: 'manual',
  color: 'rgba(142, 69, 177, 0.3)',
  positiveExample: true,
  allCoords: [{ pageNumber: 1, ...at(12, 0.55, 0.3) }],
};

// ─── Compare-mode chrome: A vs B chips with hold-to-isolate ───

type SwatchVariant = 'hatch' | 'border';

function Swatch({
  side,
  variant,
  rgb = PURPLE,
}: {
  side: RunSide | 'both';
  variant: SwatchVariant;
  rgb?: string;
}) {
  if (variant === 'border') {
    return (
      <span
        className="relative inline-block h-5 w-5 overflow-hidden rounded-sm border border-gray-200"
        style={{ backgroundColor: `rgba(${rgb}, 0.14)` }}
      >
        {side !== 'b' && <SquigglyEdge rgb={rgb} side="a" />}
        {side !== 'a' && <SquigglyEdge rgb={rgb} side="b" />}
      </span>
    );
  }
  const images = [
    ...(side !== 'b' ? [hatchGradient(rgb, 'a')] : []),
    ...(side !== 'a' ? [hatchGradient(rgb, 'b')] : []),
  ];
  return (
    <span
      className="inline-block h-5 w-5 rounded-sm border border-gray-200"
      style={{
        backgroundColor: `rgba(${rgb}, ${HATCH.washAlpha})`,
        backgroundImage: images.join(', '),
      }}
    />
  );
}

interface RunChipProps {
  side: RunSide;
  name: string;
  variant: SwatchVariant;
  dimmed: boolean;
  onHoldChange: (held: boolean) => void;
}

function RunChip({ side, name, variant, dimmed, onHoldChange }: RunChipProps) {
  return (
    <button
      className={`flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm transition-opacity ${dimmed ? 'opacity-40' : ''}`}
      onMouseDown={() => onHoldChange(true)}
      onMouseUp={() => onHoldChange(false)}
      onMouseLeave={() => onHoldChange(false)}
    >
      <span className="font-semibold uppercase text-gray-400">{side}</span>
      <Swatch side={side} variant={variant} />
      {name}
    </button>
  );
}

const PAPER_TEXT = `Transformer-based encoders have become the dominant approach for named entity
recognition in scientific documents, yet their behavior on domain-specific entity
classes remains difficult to characterize. In this work we examine how annotation
schemas evolve as researchers iterate on class definitions, comparing successive
model runs against a fixed set of confirmed instances. We find that small changes
to class descriptions produce measurable shifts in model output, and that
disagreement between runs concentrates in boundary regions where class semantics
overlap. Our analysis suggests that lightweight comparison tooling, embedded
directly in the reading environment, can surface these shifts without requiring a
formal evaluation harness. We conclude with recommendations for schema authoring
practice and a discussion of the limitations of prompt-based annotation systems
in this setting, including anchoring failures and tag-vocabulary drift, and we
release our comparison tooling to encourage replication across other domains.
Finally, we discuss how comparison views interact with document identity and
text anchoring, and we outline a path toward collaborative review of machine
annotations in shared reading groups, where multiple annotators and multiple
model runs must remain visually attributable within a single document view.`;

function CompareScene({
  Highlight,
  variant,
}: {
  Highlight: RunHighlightComponent;
  variant: SwatchVariant;
}) {
  const [isolated, setIsolated] = useState<RunSide | null>(null);
  const showA = isolated !== 'b';
  const showB = isolated !== 'a';

  return (
    <div className="w-[480px]">
      <div className="mb-3 flex items-center gap-2 select-none">
        <RunChip
          side="a"
          name="eagerly-marking"
          variant={variant}
          dimmed={isolated === 'b'}
          onHoldChange={(held) => setIsolated(held ? 'a' : null)}
        />
        <span className="text-xs font-medium text-gray-500">vs</span>
        <RunChip
          side="b"
          name="calmly-tracing"
          variant={variant}
          dimmed={isolated === 'a'}
          onHoldChange={(held) => setIsolated(held ? 'b' : null)}
        />
        <span className="ml-2 flex items-center gap-1.5 text-xs text-gray-500">
          <Swatch side="both" variant={variant} /> agree
        </span>
      </div>
      <div className="relative h-[620px] w-[480px] overflow-hidden border border-gray-300 bg-white p-8 shadow-sm">
        <p className="text-[13px] leading-relaxed text-gray-800 select-none">{PAPER_TEXT}</p>
        {showA && RUN_A.map((s, i) => <Highlight key={`a-${i}`} side="a" {...s} />)}
        {showB && RUN_B.map((s, i) => <Highlight key={`b-${i}`} side="b" {...s} />)}
        <ConfirmedTextHighlight {...confirmedUnderlineProps} />
      </div>
      <p className="mt-2 w-[480px] text-xs leading-relaxed text-gray-500">
        From top: A only · B only · full agreement · partial overlap (agreement marking only in the
        intersection) · agreement in a second class · a confirmed user underline, unchanged · a
        single three-line A highlight with B overlapping its middle line. Hold a chip to isolate
        that run.
      </p>
    </div>
  );
}

// ─── Stories ───

export const CompareMode: Story = () => (
  <CompareScene Highlight={HatchedHighlight} variant="hatch" />
);

export const BorderVariant: Story = () => (
  <CompareScene Highlight={BorderHighlight} variant="border" />
);

/**
 * Visual-weight tuning grid for the soft-band hatch: band core width × band
 * alpha, each cell showing single-run hatch on the left half and plaid (both
 * runs) on the right, over body text. Pick the cell where single-direction is
 * legible at a glance and the text stays comfortable.
 */
export const HatchWeight: Story = () => {
  const bands = [2.5, 3.5, 5];
  const alphas = [0.12, 0.15, 0.2];
  return (
    <div className="grid w-fit grid-cols-3 gap-4">
      {alphas.map((stripeAlpha) =>
        bands.map((bandPx) => {
          const hatch = { ...HATCH, bandPx, stripeAlpha };
          return (
            <div key={`${stripeAlpha}-${bandPx}`}>
              <div className="relative h-12 w-52 overflow-hidden border border-gray-200 bg-white">
                <p className="p-1 text-[11px] leading-snug text-gray-800 select-none">
                  disagreement between runs concentrates in boundary regions where class semantics
                  overlap
                </p>
                <div
                  className="absolute inset-0 mix-blend-multiply"
                  style={hatchStyle(PURPLE, 'a', hatch)}
                />
                <div
                  className="absolute inset-y-0 left-1/2 right-0 mix-blend-multiply"
                  style={hatchStyle(PURPLE, 'b', hatch)}
                />
              </div>
              <p className="mt-1 text-[10px] text-gray-500">
                band {bandPx}px · alpha {stripeAlpha}
              </p>
            </div>
          );
        }),
      )}
    </div>
  );
};
