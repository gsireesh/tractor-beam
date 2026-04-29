import { useState, useLayoutEffect, useRef, useEffect } from 'react';
import {PdfBox, SchemaClass} from "@/lib/definitions.ts";
import {rgbaToHex} from "@/lib/utils.ts";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"

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
  const activeSchema = window.TractorBeamDrawer?.getActiveSchema() ?? null;
  const [selectedClass, setSelectedClass] = useState<SchemaClass | null>(
    () => activeSchema?.classes?.[0] ?? null,
  );
  const [addButtonHovered, setAddButtonHovered] = useState<boolean>(false);


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
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDocMouseDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onDocMouseDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onDocMouseDown);
    };
  }, [onClose]);

  const accentColor = selectedClass?.color;


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
            : 'top-[-8px] border-b-8'
        }`}
        style={!adjustedPosition?.showAbove ? { borderBottomColor: accentColor } : undefined}
      />

      {/* Content */}
      <div className="bg-white">
      <div className="dark:bg-gray-800 rounded-lg shadow-xl min-w-[250px] max-w-[350px] overflow-hidden border border-gray-200 dark:border-gray-700"
      style={{backgroundColor: accentColor}}
      >

        {/* Body */}
        <div className="p-3">
          <div
            className="bg-gray-100 dark:bg-gray-700 rounded px-2.5 py-2 mb-3 text-sm text-gray-700 dark:text-gray-200 max-h-20 overflow-y-auto break-words border-l-3 italic"
            style={{ borderLeftColor: accentColor }}
          >
            {text}
          </div>
          <div className="flex gap-2">
            <Combobox
              items={activeSchema?.classes.map((c) => c.name) ?? []}
              value={selectedClass?.name ?? null}
              onValueChange={(name: string | null) =>
                setSelectedClass(activeSchema?.classes.find((c) => c.name === name) ?? null)
              }
            >
              <ComboboxInput className="flex-1 bg-white" />
              <ComboboxContent
                container={document.getElementById('tractor-beam-popover-root')}
                positionerClassName="z-[100001]"
              >
                <ComboboxList>
                  {(name: string) => (
                    <ComboboxItem key={name} value={name}>
                      {name}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
            <button
                onMouseEnter={() => setAddButtonHovered(true)}
                onMouseLeave={() => setAddButtonHovered(false)}
              className="px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors text-white disabled:opacity-50 disabled:cursor-not-allowed"

              style={{
                backgroundColor: addButtonHovered ? accentColor : rgbaToHex(accentColor!, 1.0)
              }}
              onClick={() => onAddInstance(text, activeSchema!.id, selectedClass!.id, coords)}
              disabled={!selectedClass!.id}
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}