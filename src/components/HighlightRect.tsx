import { memo } from 'react';
import { VISUAL_BLOCK_CLASS_ID } from './highlights/types';
import { VisualBlockRect } from './highlights/VisualBlockRect';
import { TextHighlightRect } from './highlights/TextHighlightRect';
import type { HighlightRectProps } from './highlights/types';

export { VISUAL_BLOCK_CLASS_ID };
export type { HighlightRectProps };

export const HighlightRect = memo(function HighlightRect(props: HighlightRectProps) {
  if (props.classId === VISUAL_BLOCK_CLASS_ID) {
    return <VisualBlockRect {...props} />;
  }
  return <TextHighlightRect {...props} />;
});
