import { useState, memo } from 'react';
import { HighlightActionButton } from './HighlightActionButton.tsx';
import type { HighlightRectProps } from './types';
import {Trash2} from "lucide-react";

export const ConfirmedTextHighlight = memo(function ConfirmedTextHighlightRect({
  highlightId,
  classId,
  schemaId,
  left,
  top,
  width,
  height,
  color,
}: HighlightRectProps) {
  const [hovered, setHovered] = useState(false);
  const [acting, setActing] = useState(false);

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
      borderBottom: `5px solid ${borderColor}`,
  };

  const nonHoverStyle = {
      borderBottom: `5px solid ${borderColor}`,
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="absolute transition-opacity duration-200 ease-out"
      style={{
        left: `${left * 100}%`,
        top: `${top * 100}%`,
        width: `${width * 100}%`,
        height: `${height * 100}%`,
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
      {hovered && !acting && (
        <HighlightActionButton
          onClick={handleDelete}
          title="Delete highlight"
          icon={<Trash2 size={"11px"} strokeWidth={1} />}
          variant="danger"
          right="2px"
        />
      )}
    </div>
  );
});
