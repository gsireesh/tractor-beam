import { useState, useLayoutEffect, useRef } from 'react';

interface SelectionPopoverProps {
  text: string;
  position: { top: number; left: number; bottom: number };
  onClose: () => void;
  onAddInstance: (text: string) => void;
}

export function SelectionPopover({
  text,
  position,
  onClose,
  onAddInstance,
}: SelectionPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState<{ top: number; left: number; showAbove: boolean } | null>(null);

  useLayoutEffect(() => {
    if (!popoverRef.current) return;

    const popoverWidth = 280;
    const popoverHeight = 180;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = position.bottom + 10;
    let left = position.left;
    let showAbove = false;

    // Keep within horizontal bounds
    if (left + popoverWidth > viewportWidth - 20) {
      left = viewportWidth - popoverWidth - 20;
    }
    if (left < 20) {
      left = 20;
    }

    // Show above if would overflow bottom
    if (top + popoverHeight > viewportHeight) {
      top = position.top - popoverHeight - 10;
      showAbove = true;
    }

    setAdjustedPosition({ top, left, showAbove });
  }, [position]);

  return (
    <div
      ref={popoverRef}
      className={`absolute z-[100000] font-sans text-sm ${adjustedPosition?.showAbove ? 'popover-above' : ''}`}
      style={{
        top: adjustedPosition?.top ?? 0,
        left: adjustedPosition?.left ?? 0,
        visibility: adjustedPosition ? 'visible' : 'hidden',
      }}
    >
      {/* Arrow */}
      <div
        className={`absolute left-5 w-0 h-0 border-l-8 border-r-8 border-l-transparent border-r-transparent ${
          adjustedPosition?.showAbove
            ? 'bottom-[-8px] border-t-8 border-t-white dark:border-t-gray-800'
            : 'top-[-8px] border-b-8 border-b-indigo-600'
        }`}
      />

      {/* Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl min-w-[250px] max-w-[350px] overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex justify-between items-center px-3 py-2.5 bg-indigo-600 text-white">
          <span className="font-semibold text-sm">Add to Schema</span>
          <button
            className="bg-transparent border-none text-white text-lg cursor-pointer p-0 leading-none opacity-80 hover:opacity-100"
            onClick={onClose}
            title="Close"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="p-3">
          <div className="bg-gray-100 dark:bg-gray-700 rounded px-2.5 py-2 mb-3 text-sm text-gray-700 dark:text-gray-200 max-h-20 overflow-y-auto break-words border-l-3 border-l-indigo-600">
            {text}
          </div>
          <div className="flex gap-2">
            <button
              className="flex-1 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors bg-indigo-600 text-white hover:bg-indigo-700"
              onClick={() => onAddInstance(text)}
            >
              Add as Instance
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}