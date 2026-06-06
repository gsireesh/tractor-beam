import { memo } from 'react';
import type { HighlightOverlayProps } from './types';

export const VisualBlockRect = memo(function VisualBlockRect({
  highlightId,
  allCoords,
}: HighlightOverlayProps) {
  if (allCoords == null || allCoords.length === 0) return <></>;
  return (
    <>
      {allCoords.map((box, index) => {
        return (
          <div
            key={`${highlightId}-${index}`}
            className="absolute pointer-events-none"
            style={{
              left: `${box.left * 100}%`,
              top: `${box.top * 100}%`,
              width: `${box.width * 100}%`,
              height: `${box.height * 100}%`,
            }}
          >
            <div className="w-full h-full border border-dashed border-blue-400/40 rounded-[3px] bg-transparent" />
          </div>
        );
      })}
    </>
  );
});
