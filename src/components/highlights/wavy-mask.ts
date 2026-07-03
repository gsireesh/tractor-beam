/**
 * The wavy "squiggle" mask used for provisional (suggested) annotation highlights.
 * A CSS `mask` built from four radial-gradient scallop rows; applied to a colored,
 * mix-blend-multiply div so the fill reads as a hand-drawn underline-ish wash.
 *
 * Shared between the on-page ProvisionalHighlight and the minimap hover preview so the
 * two look identical. The wave is sized as a fraction of the box's *rendered* height,
 * so it scales correctly at any zoom / preview size.
 */

// Tunable wave parameters, as a fraction of the rendered highlight height.
export const WAVE_LENGTH_FRAC = 1.8; // wavelength
export const WAVE_DEPTH_FRAC = 0.07; // depth

export function buildWavyMask(waveLength: number, waveDepth: number): string {
  const w = waveLength;
  const d = waveDepth;
  const r = d / 2 + (w * w) / (32 * d);
  const outerOffset = r + d * 0.1;
  const innerOffset = outerOffset - d;
  const halfWave = w / 2;
  const quarterWave = w / 4; // offset between top and bottom scallop rows
  return `
    radial-gradient(${r}px at 50% ${outerOffset}px,#000 99%,#0000 101%) calc(50% - ${halfWave}px) 0/${w}px 51% repeat-x,
    radial-gradient(${r}px at 50% -${innerOffset}px,#0000 99%,#000 101%) 50% ${d}px/${w}px calc(51% - ${d}px) repeat-x,
    radial-gradient(${r}px at 50% calc(100% - ${outerOffset}px),#000 99%,#0000 101%) calc(50% - ${halfWave}px + ${quarterWave}px) 100%/${w}px 51% repeat-x,
    radial-gradient(${r}px at 50% calc(100% + ${innerOffset}px),#0000 99%,#000 101%) calc(50% + ${quarterWave}px) calc(100% - ${d}px)/${w}px calc(51% - ${d}px) repeat-x
    `.trim();
}

export interface WavyBox {
  /** Spread onto the masked div's style; empty when the box is too small to wave. */
  style: { mask: string; WebkitMask: string } | Record<string, never>;
  /** Extra px to add to the box height so the bottom scallops aren't clipped. */
  extraHeightPx: number;
}

/** Build the wavy mask style for a box of the given rendered height (px). */
export function wavyBoxFromHeight(baseHeightPx: number): WavyBox {
  if (baseHeightPx <= 0) return { style: {}, extraHeightPx: 0 };
  const waveLength = WAVE_LENGTH_FRAC * baseHeightPx;
  const waveDepth = WAVE_DEPTH_FRAC * baseHeightPx;
  const mask = buildWavyMask(waveLength, waveDepth);
  return { style: { mask, WebkitMask: mask }, extraHeightPx: Math.ceil(1.5 * waveDepth) };
}
