import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SchemaClass } from '@/lib/definitions';
import { InstancePopoverContent, useStableAccentColor } from './InstancePopoverContent';

const POPOVER_MIN_WIDTH_PX = 320;
const POPOVER_MAX_WIDTH_PX = 400;

export interface InstancePopoverProps {
  text: string;
  positiveExample?: boolean;
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

/**
 * Floating chrome for the instance form: rect-anchored positioning, the caret
 * arrow, and the card shell. The form itself lives in InstancePopoverContent so
 * it can be reused outside this floating context (e.g. inline in the navigator).
 */
export function InstancePopover({
  text,
  positiveExample,
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
  const [adjustedPosition, setAdjustedPosition] = useState<{
    top: number;
    left: number;
    showAbove: boolean;
  } | null>(null);
  const activeSchema = window.TractorBeamDrawer?.getActiveSchema() ?? null;
  const accentColor = useStableAccentColor(selectedClass);

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
      const target = e.target as Node;
      // Clicks inside the popover itself never dismiss it.
      if (popoverRef.current?.contains(target)) return;
      // The actions menu portals its content OUTSIDE popoverRef (into
      // #tractor-beam-popover-root), so a click on a menu item would otherwise
      // count as "outside" and unmount the popover on mousedown — before the
      // item's click fires, swallowing the delete.
      if (target instanceof Element && target.closest('[data-slot="dropdown-menu-content"]')) {
        return;
      }
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onDocMouseDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onDocMouseDown);
    };
  }, [onClose]);

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
            ? 'bottom-[-8px] border-t-8 border-t-card dark:border-t-muted'
            : 'top-[-8px] border-b-8'
        }`}
        style={!adjustedPosition?.showAbove ? { borderBottomColor: accentColor } : undefined}
      />

      <div className="bg-card dark:bg-muted rounded-lg">
        <div
          className="bg-[var(--tb-fill)] rounded-lg shadow-xl overflow-hidden border"
          style={{
            ['--tb-fill' as string]: accentColor,
            borderColor: accentColor,
            minWidth: POPOVER_MIN_WIDTH_PX,
            maxWidth: POPOVER_MAX_WIDTH_PX,
          }}
        >
          <InstancePopoverContent
            text={text}
            positiveExample={positiveExample}
            notesValue={notesValue}
            onNotesChange={onNotesChange}
            selectedClass={selectedClass}
            onSelectedClassChange={onSelectedClassChange}
            inputValue={inputValue}
            onInputValueChange={onInputValueChange}
            actionButtons={actionButtons}
            actionSlotWidthPx={actionSlotWidthPx}
            allowCreateClass={allowCreateClass}
            classes={activeSchema?.classes ?? []}
            accentColor={accentColor}
            comboboxContainer={document.getElementById('tractor-beam-popover-root')}
            comboboxPositionerClassName="z-[100001]"
          />
        </div>
      </div>
    </div>
  );
}
