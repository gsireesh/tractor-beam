import React, { useState, memo } from 'react';
import { PiTrashBold, PiPlusBold } from 'react-icons/pi';

interface PdfBox {
  pageNumber: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface HighlightRectProps {
  highlightId: string;
  classId: string;
  left: number;
  top: number;
  width: number;
  height: number;
  color: string;
  source?: 'manual' | 'ml';
  text?: string;
  allCoords?: PdfBox[];
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
  source,
  text,
  allCoords,
}: HighlightRectProps) {
  const [hovered, setHovered] = useState(false);
  const [acting, setActing] = useState(false);
  const isVisualBlock = classId === VISUAL_BLOCK_CLASS_ID;
  const isMl = source === 'ml';
  const isManual = source === 'manual' || (!source && !isVisualBlock);

  function handleDelete() {
    setActing(true);
    if (window.TractorBeamDrawer) {
      window.TractorBeamDrawer.dispatch({
        actionType: 'deleteInstance',
        classId: classId,
        instanceId: highlightId,
      });
    } else {
      console.warn('[HighlightRect] TractorBeamDrawer not available for delete');
    }
  }

  function handlePromote() {
    setActing(true);
    if (window.TractorBeamDrawer) {
      const schema = window.TractorBeamDrawer.getActiveSchema();
      if (schema && text && allCoords) {
        const pdfUrl = new URLSearchParams(window.location.search).get('file') || '';
        window.TractorBeamDrawer.dispatch({
          actionType: 'addInstance',
          schemaId: schema.id,
          classId: classId,
          instance: {
            id: crypto.randomUUID(),
            instanceType: 'text',
            text: text,
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

  const pad = hovered && !isVisualBlock ? 24 : 0;

  // Parse the base RGB from the color string for the border
  const borderColor = isManual ? color.replace(/[\d.]+\)$/, '0.6)') : 'transparent';

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
        opacity: acting ? 0 : 1,
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
                border: `1px solid ${borderColor}`,
              }),
        }}
      />
      {/* Manual annotations: trash button */}
      {hovered && !acting && isManual && (
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
      {/* ML annotations: promote button */}
      {hovered && !acting && isMl && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePromote();
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
            background: 'rgba(34, 139, 34, 0.85)',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            pointerEvents: 'auto',
          }}
          title="Add to schema"
        >
          <PiPlusBold size={11} />
        </button>
      )}
    </div>
  );
});
