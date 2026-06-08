import { InstancePopoverContent } from '@/components/popovers/InstancePopoverContent';
import { InstanceDataAdapter } from '@/components/popovers/useEditInstance';
import { useDrawerInstanceEditor } from '@/components/popovers/useDrawerInstanceEditor';
import { rgbaToHex } from '@/lib/utils';

interface EditInstanceInlineProps {
  schemaId: string;
  classId: string;
  instanceId: string;
  /** Override the data source (used by Ladle stories that have no DrawerContext). */
  adapter?: InstanceDataAdapter;
}

/**
 * Inline host: renders the shared instance form directly in the navigator (no
 * floating chrome, no arrow) on an accent-colored card. Edit/save semantics live
 * in useDrawerInstanceEditor; this owns only the navigator's presentation.
 */
export function EditInstanceInline({
  schemaId,
  classId,
  instanceId,
  adapter,
}: EditInstanceInlineProps) {
  const { editor, accentColor } = useDrawerInstanceEditor({
    schemaId,
    classId,
    instanceId,
    adapter,
  });

  if (!editor.instance) return null;

  return (
    <div
      className="rounded-lg overflow-hidden border bg-[var(--tb-fill)]"
      style={{ ['--tb-fill' as string]: accentColor, borderColor: rgbaToHex(accentColor, 1.0) }}
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
  );
}
