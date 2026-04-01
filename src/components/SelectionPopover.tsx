import { useState, useLayoutEffect, useRef } from 'react';
import {Schema, PdfBox} from "@/lib/definitions.ts";

interface SelectionPopoverProps {
  text: string;
  position: { top: number; left: number; bottom: number };
  coords?: PdfBox[] | null;
  onClose: () => void;
  onAddInstance: (text: string, schemaId: string, classId: string, coords?: PdfBox[] | null) => void;
}

export function SelectionPopover({
  text,
  position,
  coords,
  onClose,
  onAddInstance,
}: SelectionPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState<{ top: number; left: number; showAbove: boolean } | null>(null);
  const [activeSchema, setActiveSchema] = useState<Schema|null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>('');

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

  useEffect(() => {
    if (!window.TractorBeamDrawer) return;
    const schema = window.TractorBeamDrawer.getActiveSchema();
    if (schema) {
      setActiveSchema(schema);
      if (schema.classes?.length > 0) {
        setSelectedClassId(schema.classes[0].id);
      }
    }
  }, []);

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

        {/* Body */}
        <div className="p-3">
          <div className="bg-gray-100 dark:bg-gray-700 rounded px-2.5 py-2 mb-3 text-sm text-gray-700 dark:text-gray-200 max-h-20 overflow-y-auto break-words border-l-3 border-l-indigo-600">
            {text}
          </div>
          <div className="flex gap-2">
            <select
              className="flex-1 px-2 py-2 rounded-md text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
            >
              {activeSchema?.classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              className="px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => onAddInstance(text, activeSchema.id, selectedClassId, coords)}
              disabled={!selectedClassId}
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}