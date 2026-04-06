import React, { memo, ReactNode } from 'react';

interface ActionButtonProps {
  onClick: (e: React.MouseEvent) => void;
  title: string;
  icon: ReactNode;
  variant: 'danger' | 'success';
  right: string;
}

export const HighlightActionButton = memo(function ActionButton({
  onClick,
  title,
  icon,
  variant,
  right,
}: ActionButtonProps) {
  const base = 'absolute top-1/2 -translate-y-1/2 w-[18px] h-[18px] rounded-full border-none text-white cursor-pointer flex items-center justify-center p-0 pointer-events-auto';
  return (
    <button
      className={base + (variant === 'danger' ? ' bg-red-600/85' : ' bg-green-700/85')}
      style={{ right }}
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
    >
      {icon}
    </button>
  )
});
