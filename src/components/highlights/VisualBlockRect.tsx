import { memo } from 'react';
import type { HighlightRectProps } from './types';

export const VisualBlockRect = memo(function VisualBlockRect({
  left,
  top,
  width,
  height,
}: HighlightRectProps) {
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${left * 100}%`,
        top: `${top * 100}%`,
        width: `${width * 100}%`,
        height: `${height * 100}%`,
      }}
    >
      <div className="w-full h-full border border-dashed border-blue-400/40 rounded-[3px] bg-transparent" />
    </div>
  );
});
