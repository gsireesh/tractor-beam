import { memo } from 'react';
import { VISUAL_BLOCK_CLASS_ID } from './types.ts';
import { VisualBlockRect } from './VisualBlockRect.tsx';
import { ConfirmedTextHighlight } from './ConfirmedTextHighlight.tsx';
import { ProvisionalHighlight } from './ProvisionalHighlight.tsx';
import type { HighlightOverlayProps } from './types.ts';

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
