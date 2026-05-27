import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SchemaClass } from '@/lib/definitions';
import { CreatableCombobox } from '@/components/ui/creatable-combobox';
import { Textarea } from '@/components/ui/textarea';
import { createNewClass } from '@/lib/utils';

const accentColorFallback = 'rgba(0,0,0,0)';

const POPOVER_MIN_WIDTH_PX = 320;
const POPOVER_MAX_WIDTH_PX = 400;

export interface InstancePopoverProps {
  text: string;
  position: { top: number; left: number; bottom: number };
  notesValue: string | null;
  onNotesChange: (v: string) => void;
  selectedClass: SchemaClass | null;
  onSelectedClassChange: (cls: SchemaClass | null) => void;
  inputValue: string;
  onInputValueChange: (v: string) => void;
  actionButtons: ReactNode;
  actionSlotWidthPx: number;
  onClose: () => void;
  allowCreateClass?: boolean;
}

export function InstancePopover({
  text,
  position,
  notesValue,
  onNotesChange,
  selectedClass,
  onSelectedClassChange,
  inputValue,
  onInputValueChange,
  actionButtons,
  actionSlotWidthPx,
  onClose,
  allowCreateClass = true,
}: InstancePopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState<{ top: number; left: number; showAbove: boolean } | null>(null);
  const activeSchema = window.TractorBeamDrawer?.getActiveSchema() ?? null;

  // Track the last *valid* selected class so the accent color stays stable
  // while the user is typing into the combobox (selectedClass goes null).
  const lastValidClassRef = useRef<SchemaClass | null>(selectedClass);
  if (selectedClass) lastValidClassRef.current = selectedClass;

  useLayoutEffect(() => {
    if (!popoverRef.current) return;

    const popoverWidth = 280;
    const popoverHeight = 180;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = position.bottom + 10;
    let left = position.left;
    let showAbove = false;

    if (left + popoverWidth > viewportWidth - 20) {
      left = viewportWidth - popoverWidth - 20;
    }
    if (left < 20) {
      left = 20;
    }

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

  const accentColor = lastValidClassRef.current?.color ?? accentColorFallback;

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
      <div
        className={`absolute left-5 w-0 h-0 border-l-8 border-r-8 border-l-transparent border-r-transparent ${
          adjustedPosition?.showAbove
            ? 'bottom-[-8px] border-t-8 border-t-white dark:border-t-gray-800'
            : 'top-[-8px] border-b-8'
        }`}
        style={!adjustedPosition?.showAbove ? { borderBottomColor: accentColor } : undefined}
      />

      <div className="bg-white">
        <div
          className="dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700"
          style={{
            backgroundColor: accentColor,
            minWidth: POPOVER_MIN_WIDTH_PX,
            maxWidth: POPOVER_MAX_WIDTH_PX,
          }}
        >
          <div className="p-3">
            <div
              className="bg-gray-100 dark:bg-gray-700 rounded px-2.5 py-2 mb-3 text-sm text-gray-700 dark:text-gray-200 max-h-20 overflow-y-auto break-words border-l-3 italic"
              style={{ borderLeftColor: accentColor }}
            >
              {text}
            </div>
            <Textarea
              className="bg-white rounded px-2.5 py-2 mb-3 text-sm"
              placeholder="Notes..."
              value={notesValue ?? ''}
              onChange={(e) => onNotesChange(e.target.value)}
            />
            <div className="flex gap-2">
              <CreatableCombobox
                items={activeSchema?.classes.map((c) => c.name) ?? []}
                value={selectedClass?.name ?? ''}
                inputValue={inputValue}
                onInputValueChange={onInputValueChange}
                allowCreate={allowCreateClass}
                onSelect={(name) => {
                  onSelectedClassChange(
                    activeSchema?.classes.find((c) => c.name === name) ?? null
                  );
                }}
                onCreate={(name) => {
                  onSelectedClassChange(createNewClass(name, '', []));
                }}
                renderCreateLabel={(label) => `Create new class "${label}"`}
                inputClassName="flex-1 bg-white"
                contentContainer={document.getElementById('tractor-beam-popover-root')}
                contentPositionerClassName="z-[100001]"
              />
              <div
                className="flex shrink-0"
                style={{ width: actionSlotWidthPx, gap: 4 }}
              >
                {actionButtons}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
