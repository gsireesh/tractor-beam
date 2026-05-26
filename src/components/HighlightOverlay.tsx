import { memo } from 'react';
import { VISUAL_BLOCK_CLASS_ID } from './highlights/types';
import { VisualBlockRect } from './highlights/VisualBlockRect';
import { ConfirmedTextHighlight } from './highlights/ConfirmedTextHighlight.tsx';
import { ProvisionalHighlight } from './highlights/ProvisionalHighlight.tsx';
import type { HighlightOverlayProps } from './highlights/types';

export { VISUAL_BLOCK_CLASS_ID };

export const HighlightOverlay = memo(function HighlightOverlay(props: HighlightOverlayProps) {
  if (props.classId === VISUAL_BLOCK_CLASS_ID) {
    return <VisualBlockRect {...props} />;
  }
  if (props.source === 'ml') {
    return <ProvisionalHighlight {...props} />;
  }
  return <ConfirmedTextHighlight {...props} />;
});
