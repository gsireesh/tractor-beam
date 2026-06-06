import { Hsluv } from "hsluv";

// All highlight colors share this alpha so they read as gentle highlights (not
// solid fills) and stay legible over PDF text under `mix-blend-multiply`.
// Matches the `rgba(r, g, b, 0.3)` format already stored in `SchemaClass.color`.
const HIGHLIGHT_ALPHA = 0.3;

// Number of evenly-spaced hues in the curated swatch palette offered for manual
// recoloring.
const PALETTE_SIZE = 12;

// A newly created class must sit at least this many degrees away (in HSLuv hue)
// from every color already used in its schema, so no two classes look alike.
const MIN_HUE_SEPARATION = 25;

// Shared converter instance — HSLuv conversions are synchronous, so reusing one
// instance is safe as long as every input field is set before each conversion.
const conv = new Hsluv();

const HSLUV_S = 100;
const HSLUV_L = 70;

/**
 * Convert an HSLuv hue (0–360) into an `rgba(r, g, b, ${HIGHLIGHT_ALPHA})` string
 * at a *fixed* lightness and saturation. Holding L and S constant while only the
 * hue varies is what makes the whole palette perceptually uniform: every color is
 * equally light (legible under multiply) and equally soft (harmonious). **/
export function highlightColorForHue(hue: number): string {
  conv.hsluv_h = hue;
  conv.hsluv_s = HSLUV_S;
  conv.hsluv_l = HSLUV_L;
  conv.hsluvToRgb();

  return (`rgba(${Math.round(conv.rgb_r * 255)}, ${Math.round(conv.rgb_g * 255)}, ${Math.round(conv.rgb_b * 255)}, ${HIGHLIGHT_ALPHA})`);
}

/** Recover the HSLuv hue of an existing `rgba(...)` color, or null if unparseable. */
export function hueOfColor(color: string): number | null {
  const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
  if (!match) return null;
  const [, r, g, b] = match;
  conv.rgb_r = +r / 255;
  conv.rgb_g = +g / 255;
  conv.rgb_b = +b / 255;
  conv.rgbToHsluv();
  return conv.hsluv_h;
}

/** Smallest angular distance (degrees) between a hue and any hue in `others`. */
function minHueDistance(hue: number, others: number[]): number {
  return others.reduce((min, other) => {
    const diff = Math.abs(hue - other) % 360;
    return Math.min(min, Math.min(diff, 360 - diff));
  }, 360);
}

/**
 * The curated set of highlight colors offered in the "Change Color" swatch grid —
 * evenly-spaced hues at the fixed L/S, so they sit together harmoniously.
 */
export const HIGHLIGHT_PALETTE: string[] = Array.from(
  { length: PALETTE_SIZE },
  (_, i) => highlightColorForHue((360 / PALETTE_SIZE) * i),
);

/**
 * A highlight-safe color at a random hue, for newly created classes. Avoids hues
 * already used in the schema (within `MIN_HUE_SEPARATION`); if the schema is too
 * crowded to clear that gap, returns the most-distinct hue sampled.
 */
export function randomHighlightColor(existingColors: string[] = []): string {
  const usedHues = existingColors
    .map(hueOfColor)
    .filter((h): h is number => h !== null);

  let bestHue = 360 * Math.random();
  let bestDistance = -1;
  for (let attempt = 0; attempt < 32; attempt++) {
    const hue = 360 * Math.random();
    const distance = minHueDistance(hue, usedHues);
    if (distance >= MIN_HUE_SEPARATION) return highlightColorForHue(hue);
    if (distance > bestDistance) {
      bestHue = hue;
      bestDistance = distance;
    }
  }
  return highlightColorForHue(bestHue);
}
