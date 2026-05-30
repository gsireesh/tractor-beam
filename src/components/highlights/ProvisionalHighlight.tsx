import { useRef, useLayoutEffect, useState, memo, MouseEvent } from 'react';
import type { HighlightOverlayProps } from './types';
import type { Highlight } from '@/lib/definitions';

export const ProvisionalHighlight = memo(function ProvisionalHighlight({
  classId,
  schemaId,
  highlightId,
  color,
  text,
  allCoords,
  positiveExample,
  flashing,
}: HighlightOverlayProps) {
  const firstBoxRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  // @ts-expect-error: mounted is used to ensure component presence before reading firstBoxRef's
  // parent height. Parent height is used for consistent appearance of squiggly boxes.
  // eslint-disable-next-line
  const [mounted, setMounted] = useState(false);
  useLayoutEffect(() => { setMounted(true); }, []);

  if (allCoords == null || allCoords.length === 0) return <></>;

  // Tunable wave parameters (as fraction of rendered highlight height)
  const waveLengthFrac = 1.8;     // wavelength as fraction of height
  const waveDepthFrac = 0.07;     // wave depth as fraction of height

  function buildWavyMask(w: number, d: number): string {
    const r = d / 2 + (w * w) / (32 * d);
    const outerOffset = r + d * 0.1;
    const innerOffset = outerOffset - d;
    const halfWave = w / 2;
    const quarterWave = w / 4;  // offset between top and bottom scallop rows
    return `
    radial-gradient(${r}px at 50% ${outerOffset}px,#000 99%,#0000 101%) calc(50% - ${halfWave}px) 0/${w}px 51% repeat-x,
    radial-gradient(${r}px at 50% -${innerOffset}px,#0000 99%,#000 101%) 50% ${d}px/${w}px calc(51% - ${d}px) repeat-x,
    radial-gradient(${r}px at 50% calc(100% - ${outerOffset}px),#000 99%,#0000 101%) calc(50% - ${halfWave}px + ${quarterWave}px) 100%/${w}px 51% repeat-x,
    radial-gradient(${r}px at 50% calc(100% + ${innerOffset}px),#0000 99%,#000 101%) calc(50% + ${quarterWave}px) calc(100% - ${d}px)/${w}px calc(51% - ${d}px) repeat-x
    `.trim();
  }

  // Read parent height once from the first box's parent — all boxes share the same parent
  // (the page's overlay container), so per-iteration reads were redundant and made the
  // ref look like it belonged to each box rather than to the page.
  const parentHeight = firstBoxRef.current?.parentElement?.offsetHeight ?? 0;

  // Higher-alpha variant of the color for the hover state — the color prop is typically
  // low-alpha (~0.4) for the resting "draft" wash. On hover we swap to alpha 0.8 so the
  // multiply blend produces a clearly stronger color without fully obscuring underlying text.
  const hoverColor = color.replace(/[\d.]+\)$/, '0.6)');

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const highlight: Highlight = {
      id: highlightId,
      classId,
      schemaId,
      coords: allCoords,
      source: 'ml',
      text,
      color,
      positiveExample,
    };
    window.TractorBeamPopover?.showPromote(highlight, rect);
  };

  return (
    <>
      {allCoords.map((box, index) => {
        const baseHeight = parentHeight * box.height;
        const waveLength = waveLengthFrac * baseHeight;
        const waveDepth = waveDepthFrac * baseHeight;
        const wavyMask = baseHeight > 0 ? buildWavyMask(waveLength, waveDepth) : '';
        const wavyStyle = baseHeight > 0 ? {
          WebkitMask: wavyMask,
          mask: wavyMask,
        } : {};

        return (
          <div
            key={`${highlightId}-${index}`}
            ref={index === 0 ? firstBoxRef : undefined}
            onClick={handleClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className={`absolute cursor-pointer${flashing ? ' tractor-beam-flash' : ''}`}
            style={{
              left: `${box.left * 100}%`,
              top: `${box.top * 100}%`,
              width: `${box.width * 100}%`,
              height: `calc(${box.height * 100}% + ${Math.ceil(1.5 * waveDepth)}px)`,
              pointerEvents: 'auto',
              // Flash ring color (consumed by the .tractor-beam-flash animation).
              ['--tb-flash-color' as string]: hoverColor,
            }}
          >
            <div
              className="w-full h-full rounded-sm mix-blend-multiply transition-[background-color] duration-150 ease-out"
              style={{
                backgroundColor: hovered ? hoverColor : color,
                ...wavyStyle,
              }}
            />
          </div>
        );
      })}
    </>
  );
});
