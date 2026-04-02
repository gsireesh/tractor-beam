import { useState, memo } from 'react';
import { PiTrashBold, PiPlusBold, PiMinusBold } from 'react-icons/pi';
import { ActionButton } from './ActionButton';
import type { HighlightRectProps } from './types';

export const TextHighlightRect = memo(function TextHighlightRect({
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
  const isManual = source === 'manual' || !source;
  const isMl = source === 'ml';

  function handleDelete() {
    setActing(true);
    if (window.TractorBeamDrawer) {
      window.TractorBeamDrawer.dispatch({
        actionType: 'deleteInstance',
        classId,
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
          classId,
          instance: {
            id: crypto.randomUUID(),
            instanceType: 'text',
            text,
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

  const pad = hovered ? (isMl ? 44 : 24) : 0;
  const borderColor = isManual ? color.replace(/[\d.]+\)$/, '0.6)') : 'transparent';

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
        className="w-full h-full rounded-sm mix-blend-multiply pb-5px hover:border-5px"
        style={{
          background: color,
          'border-bottom': `5px solid ${borderColor}`,
        }}
      />
      {hovered && !acting && isManual && (
        <ActionButton
          onClick={handleDelete}
          title="Delete highlight"
          icon={<PiTrashBold size={11} />}
          variant="danger"
          right="2px"
        />
      )}
      {hovered && !acting && isMl && (
        <div className="flex flex-row">
          <ActionButton
            onClick={handlePromote}
            title="Add to schema"
            icon={<PiPlusBold size={11} />}
            variant="success"
            right="2px"
          />
          <ActionButton
            onClick={handlePromote}
            title="Add to schema (negative example)"
            icon={<PiMinusBold size={11} />}
            variant="success"
            right="24px"
          />
        </div>
      )}
    </div>
  );
});
