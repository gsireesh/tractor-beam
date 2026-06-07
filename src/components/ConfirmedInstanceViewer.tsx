import type { MouseEvent } from 'react';
import { PdfBox } from '@/lib/definitions.ts';
import { scrollToAnnotation } from '@/lib/pdf-navigation.ts';
import { InstancePopoverContent } from '@/components/popovers/InstancePopoverContent.tsx';
import { useDrawerInstanceEditor } from '@/components/popovers/useDrawerInstanceEditor.ts';
import { rgbaToHex } from '@/lib/utils.ts';

export interface ConfirmedInstanceViewerProps {
  schemaId: string;
  classId: string;
  instanceId: string;
  coords: PdfBox[] | null;
}

/**
 * A confirmed instance in the schema viewer's class list. Shares edit/delete
 * semantics with the navigator's inline editor (via useDrawerInstanceEditor) but
 * owns its own presentation — free to look different from the navigator card.
 * Clicking any non-editable surface navigates to the annotation, so there's no
 * separate locate button.
 */
export function ConfirmedInstanceViewer({
  schemaId,
  classId,
  instanceId,
  coords,
}: ConfirmedInstanceViewerProps) {
  const { editor, accentColor } = useDrawerInstanceEditor({ schemaId, classId, instanceId });

  if (!editor.instance) return null;

  // Clicking the card navigates to the annotation — except on a form control
  // (notes, class picker, the delete kebab), which do their own thing. The class
  // dropdown and the kebab menu portal out of the card, so their clicks never
  // reach this handler.
  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('input, textarea, button')) return;
    if (coords) {
      scrollToAnnotation(coords);
      window.TractorBeamHighlights?.flashHighlight(instanceId);
    }
  };

  return (
    <div className="mx-1 my-2 cursor-pointer" onClick={handleClick}>
      <div
        className="rounded-lg overflow-hidden border bg-white"
        style={{ borderColor: rgbaToHex(accentColor, 1.0) }}
      >
        <InstancePopoverContent
          text={editor.text}
          positiveExample={editor.instance.positiveExample}
          pageNumber={editor.instance.coords?.[0]?.pageNumber}
          notesValue={editor.notesValue}
          onNotesChange={editor.setNotesValue}
          onNotesBlur={editor.save}
          selectedClass={editor.selectedClass}
          onSelectedClassChange={editor.setSelectedClass}
          inputValue={editor.inputValue}
          onInputValueChange={editor.setInputValue}
          actionButtons={editor.actionButtons}
          actionSlotWidthPx={40}
          allowCreateClass={true}
          classes={editor.classes}
          accentColor={accentColor}
          // Portal into the popover root: it's on document.body (so the panel's
          // overflow-scroll can't clip it) AND popover-styles.css scopes the theme
          // tokens (--popover etc.) there, so the dropdown isn't transparent.
          comboboxContainer={document.getElementById('tractor-beam-popover-root')}
          comboboxPositionerClassName="z-[100001]"
          closeComboboxOnScroll={true}
        />
      </div>
    </div>
  );
}
