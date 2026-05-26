import { useState, memo } from 'react';
import { HighlightActionButton } from './HighlightActionButton.tsx';
import type { HighlightOverlayProps } from './types';
import {Trash2} from "lucide-react";

export const ConfirmedTextHighlight = memo(function ConfirmedTextHighlightRect({
  highlightId,
  classId,
  schemaId,
  allCoords,
  color,
  positiveExample
}: HighlightOverlayProps) {
  const [hovered, setHovered] = useState(false);
  const [acting, setActing] = useState(false);

  if (allCoords == null) return <></>;

  function handleDelete() {
    setActing(true);
    if (window.TractorBeamDrawer) {
      window.TractorBeamDrawer.dispatch({
        actionType: 'deleteInstance',
        schemaId,
        classId,
        instanceId: highlightId,
      });
    } else {
      console.warn('[ConfirmedTextHighlightRect] TractorBeamDrawer not available for delete');
    }
  }

  const pad = hovered ? 24 : 0;
  const borderColor = color.replace(/[\d.]+\)$/, '0.6)');

  const hoverStyle = {
      backgroundColor: color,
      borderBottom: `5px ${positiveExample? "solid": "dashed"} ${borderColor}`,
  };

  const nonHoverStyle = {
      borderBottom: `5px ${positiveExample? "solid": "dashed"} ${borderColor}`,
  }

  return (
      <>
          {allCoords.map(((box, index) => {
              return <div
                  key={`${highlightId}-${index}`}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="absolute transition-opacity duration-200 ease-out"
          style={{
            left: `${box.left * 100}%`,
            top: `${box.top * 100}%`,
            width: `${box.width * 100}%`,
            height: `${box.height * 100}%`,
            paddingRight: `${pad}px`,
            marginRight: `-${pad}px`,
            opacity: acting ? 0 : 1,
            pointerEvents: 'auto',
          }}
        >
          <div
            className="w-full h-full rounded-sm mix-blend-multiply pb-5px"
            style={(hovered ? hoverStyle : nonHoverStyle)}
          />
          {hovered && !acting && index === allCoords.length - 1 && (
            <HighlightActionButton
              onClick={handleDelete}
              title="Delete highlight"
              icon={<Trash2 size={"11px"} strokeWidth={1} />}
              variant="danger"
              right="2px"
            />
          )}
        </div>
          }))}
      </>
  );
});
