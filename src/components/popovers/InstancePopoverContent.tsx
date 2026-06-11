import { ReactNode, useRef } from 'react';
import { Combobox as ComboboxPrimitive } from '@base-ui/react';
import { Minus, Plus } from 'lucide-react';
import { SchemaClass } from '@/lib/definitions';
import { CreatableCombobox } from '@/components/ui/creatable-combobox';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { createNewClass } from '@/lib/utils';

const accentColorFallback = 'rgba(0,0,0,0)';

/**
 * The accent color follows the selected class, but the combobox briefly sets
 * `selectedClass` to null while the user is typing. Tracking the last *valid*
 * class keeps the color stable across that transient null. Shared by the
 * floating chrome (arrow color) and the inline host (card background).
 */
export function useStableAccentColor(selectedClass: SchemaClass | null): string {
  const lastValidClassRef = useRef<SchemaClass | null>(selectedClass);
  if (selectedClass) lastValidClassRef.current = selectedClass;
  return lastValidClassRef.current?.color ?? accentColorFallback;
}

export interface InstancePopoverContentProps {
  text: string;
  /** Positive/negative indicator, shown under the quote. Omit when there's no instance yet (create/promote). */
  positiveExample?: boolean;
  /** PDF page of the annotation. Passed only by the navigation-view host, so the page badge is nav-only. */
  pageNumber?: number;
  notesValue: string | null;
  onNotesChange: (v: string) => void;
  /** Fired when the notes textarea loses focus — used by the inline host to persist. */
  onNotesBlur?: () => void;
  selectedClass: SchemaClass | null;
  onSelectedClassChange: (cls: SchemaClass | null) => void;
  inputValue: string;
  onInputValueChange: (v: string) => void;
  actionButtons: ReactNode;
  actionSlotWidthPx: number;
  allowCreateClass?: boolean;
  /** Class list the combobox offers — injected so this component never reads ambient state. */
  classes: SchemaClass[];
  accentColor: string;
  /** Portal target for the combobox dropdown (popover root vs document.body). */
  comboboxContainer?: ComboboxPrimitive.Portal.Props['container'];
  comboboxPositionerClassName?: string;
  /** Close the class dropdown on scroll (for the inline editor in a scrolling panel). */
  closeComboboxOnScroll?: boolean;
}

/** Presentational instance form: quote, notes, class picker, action slot. No chrome. */
export function InstancePopoverContent({
  text,
  positiveExample,
  pageNumber,
  notesValue,
  onNotesChange,
  onNotesBlur,
  selectedClass,
  onSelectedClassChange,
  inputValue,
  onInputValueChange,
  actionButtons,
  actionSlotWidthPx,
  allowCreateClass = true,
  classes,
  accentColor,
  comboboxContainer,
  comboboxPositionerClassName,
  closeComboboxOnScroll = false,
}: InstancePopoverContentProps) {
  return (
    <div className="p-3">
      <div
        className="bg-muted rounded px-2.5 py-2 mb-3 text-sm text-foreground max-h-20 overflow-y-auto break-words border-1 italic"
        style={{ borderLeftColor: accentColor, borderColor: accentColor }}
      >
        {text}
      </div>
      {(positiveExample !== undefined || pageNumber !== undefined) && (
        <div className="mb-3 flex items-center gap-2">
          {positiveExample !== undefined &&
            (positiveExample ? (
              <Badge className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                <Plus />
                Positive Example
              </Badge>
            ) : (
              <Badge className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
                <Minus />
                Negative Example
              </Badge>
            ))}
          {pageNumber !== undefined && (
            <Badge className="bg-muted text-muted-foreground" style={{ borderColor: accentColor }}>
              Page {pageNumber}
            </Badge>
          )}
        </div>
      )}
      <Textarea
        className="bg-card rounded px-2.5 py-2 mb-3 text-sm border-1"
        style={{ borderColor: accentColor }}
        placeholder="Notes..."
        value={notesValue ?? ''}
        onChange={(e) => onNotesChange(e.target.value)}
        onBlur={onNotesBlur}
      />
      <div className="flex gap-2">
        <CreatableCombobox
          items={classes.map((c) => c.name)}
          value={selectedClass?.name ?? ''}
          inputValue={inputValue}
          onInputValueChange={onInputValueChange}
          allowCreate={allowCreateClass}
          onSelect={(name) => {
            onSelectedClassChange(classes.find((c) => c.name === name) ?? null);
          }}
          onCreate={(name) => {
            onSelectedClassChange(
              createNewClass(
                name,
                '',
                [],
                classes.map((c) => c.color),
              ),
            );
          }}
          renderCreateLabel={(label) => `Create new class "${label}"`}
          inputClassName="flex-1 bg-card"
          contentContainer={comboboxContainer}
          contentPositionerClassName={comboboxPositionerClassName}
          closeOnScroll={closeComboboxOnScroll}
        />
        <div className="flex shrink-0" style={{ width: actionSlotWidthPx, gap: 4 }}>
          {actionButtons}
        </div>
      </div>
    </div>
  );
}
