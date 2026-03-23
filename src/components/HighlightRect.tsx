import React, { useState, memo } from 'react';
import { PiTrashBold } from 'react-icons/pi';

interface HighlightRectProps {
  highlightId: string;
  classId: string;
  left: number;
  top: number;
  width: number;
  height: number;
  color: string;
}

export const VISUAL_BLOCK_CLASS_ID = '__visual-block__';

export const HighlightRect = memo(function HighlightRect({
  highlightId,
  classId,
  left,
  top,
  width,
  height,
  color,
}: HighlightRectProps) {
  const [hovered, setHovered] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isVisualBlock = classId === VISUAL_BLOCK_CLASS_ID;

  function handleDelete() {
    setDeleting(true);
    chrome.runtime.sendMessage({
      type: 'deleteInstance',
      highlightId: highlightId,
      classId: classId,
    }).catch(() => { console.log("Failed to delete highlight!"); });
  }

  // Padding expands the hover hitbox so the button (positioned at the right
  // edge) stays inside the mouseenter/mouseleave boundary. Negative margin
  // cancels out the visual shift so the highlight doesn't move.
  const pad = hovered && !isVisualBlock ? 24 : 0;

  return (
    <div
      onMouseEnter={() => !isVisualBlock && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        left: `${left * 100}%`,
        top: `${top * 100}%`,
        width: `${width * 100}%`,
        height: `${height * 100}%`,
        paddingRight: `${pad}px`,
        marginRight: `-${pad}px`,
        pointerEvents: isVisualBlock ? 'none' : 'auto',
        opacity: deleting ? 0 : 1,
        transition: 'opacity 200ms ease-out',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          ...(isVisualBlock
            ? {
                border: '1px dashed rgba(100, 100, 255, 0.4)',
                borderRadius: '3px',
                background: 'transparent',
              }
            : {
                background: color,
                borderRadius: '2px',
                mixBlendMode: 'multiply',
              }),
        }}
      />
      {hovered && !deleting && !isVisualBlock && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
          style={{
            position: 'absolute',
            right: '2px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '18px',
            height: '18px',
            border: 'none',
            borderRadius: '50%',
            background: 'rgba(220, 38, 38, 0.85)',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            pointerEvents: 'auto',
          }}
          title="Delete highlight"
        >
          <PiTrashBold size={11} />
        </button>
      )}
    </div>
  );
});
