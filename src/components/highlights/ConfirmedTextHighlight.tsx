import { useState, memo, MouseEvent } from 'react';
import type { HighlightOverlayProps } from './types';

export const ConfirmedTextHighlight = memo(function ConfirmedTextHighlightRect({
  highlightId,
  classId,
  schemaId,
  allCoords,
  color,
  positiveExample,
  flashing,
}: HighlightOverlayProps) {
  const [hovered, setHovered] = useState(false);

  if (allCoords == null) return <></>;

  const borderColor = color.replace(/[\d.]+\)$/, '0.6)');

  const hoverStyle = {
    backgroundColor: color,
    borderBottom: `5px ${positiveExample ? 'solid' : 'dashed'} ${borderColor}`,
  };

  const nonHoverStyle = {
    borderBottom: `5px ${positiveExample ? 'solid' : 'dashed'} ${borderColor}`,
  };

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    window.TractorBeamPopover?.showEdit(schemaId, classId, highlightId, rect);
  };

  return (
    <>
      {allCoords.map((box, index) => (
        <div
          key={`${highlightId}-${index}`}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={handleClick}
          className={`absolute cursor-pointer${flashing ? ' tractor-beam-flash' : ''}`}
          style={{
            left: `${box.left * 100}%`,
            top: `${box.top * 100}%`,
            width: `${box.width * 100}%`,
            height: `${box.height * 100}%`,
            pointerEvents: 'auto',
            // Flash ring color (consumed by the .tractor-beam-flash animation).
            ['--tb-flash-color' as string]: borderColor,
          }}
        >
          <div
            className="w-full h-full rounded-sm mix-blend-multiply pb-5px"
            style={hovered ? hoverStyle : nonHoverStyle}
          />
        </div>
      ))}
    </>
  );
});
