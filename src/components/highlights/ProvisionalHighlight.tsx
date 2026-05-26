import { useState, useRef, useEffect, memo } from 'react';
import { HighlightActionButton } from './HighlightActionButton.tsx';
import type {HighlightOverlayProps} from './types';
import {CirclePlus, CircleMinus} from "lucide-react";

export const ProvisionalHighlight = memo(function ProvisionalHighlight({
  classId,
  highlightId,
  color,
  text,
  allCoords,
}: HighlightOverlayProps) {
  const [hovered, setHovered] = useState(false);
  const [acting, setActing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // @ts-expect-error: mounted is used to ensure component presence before calculating element
  // height. Element height is used for consistent appearance of squiggly boxes.
  // eslint-disable-next-line
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (allCoords == null || allCoords.length === 0) return <></>;

  function handlePromote(positiveExample: boolean) {
    setActing(true);
    if (window.TractorBeamDrawer) {
      const schema = window.TractorBeamDrawer.getActiveSchema();
      if (schema && text && allCoords) {
        const pdfUrl = new URLSearchParams(window.location.search).get('file') ?? '';
        window.TractorBeamDrawer.dispatch({
          actionType: 'addInstance',
          schemaId: schema.id,
          classId,
          instance: {
            id: crypto.randomUUID(),
            instanceType: 'text',
            text,
            positiveExample: positiveExample,
            range: null,
            coords: allCoords,
            pdfUrl,
          },
        });
      }
    } else {
      console.warn('[HighlightRect] TractorBeamDrawer not available for promote');
    }
  }
  const pad = hovered ? 44 : 0;

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

  return (
    <>
      {allCoords.map((box, index) => {

        // Use the container's parent height * normalized height to get the base highlight
        // height before wave extension, avoiding a feedback loop with offsetHeight.
        const parentHeight = containerRef.current?.parentElement?.offsetHeight ?? 0;
        const baseHeight = parentHeight * box.height;
        const waveLength = waveLengthFrac * baseHeight;
        const waveDepth = waveDepthFrac * baseHeight;
        const wavyMask = baseHeight > 0 ? buildWavyMask(waveLength, waveDepth) : '';
        const wavyStyle = baseHeight > 0 ? {
          WebkitMask: wavyMask,
          mask: wavyMask,
        } : {};


        return <div
            key={`${highlightId}-${index}`}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          ref={containerRef}
          className="absolute transition-opacity duration-200 ease-out"
          style={{
            left: `${box.left * 100}%`,
            top: `${box.top * 100}%`,
            width: `${box.width * 100}%`,
            height: `calc(${box.height * 100}% + ${Math.ceil(1.5 * waveDepth)}px)`,
            paddingRight: `${pad}px`,
            marginRight: `-${pad}px`,
            opacity: acting ? 0 : 1,
            pointerEvents: 'auto',
          }}
        >
          <div
            className="w-full h-full rounded-sm mix-blend-multiply"
            style={{
              background: color,
              ...wavyStyle
            }}
          />
        </div>
      })}
      {hovered && !acting && (
            <div className="flex flex-row">
              <HighlightActionButton
                onClick={() => handlePromote(true)}
                title="Add to schema"
                icon={<CirclePlus size={"11px"} strokeWidth={1} />}
                variant="success"
                right="2px"
              />
              <HighlightActionButton
                onClick={()=> handlePromote(false)}
                title="Add to schema (negative example)"
                icon={<CircleMinus size={"11px"} strokeWidth={1} />}
                variant="success"
                right="24px"
              />
            </div>
          )}
    </>
  );
});
