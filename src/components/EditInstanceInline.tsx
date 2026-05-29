import { useContext, useEffect, useMemo, useRef } from 'react';
import { DrawerContext } from '@/contexts/DrawerContext';
import { InstancePopoverContent, useStableAccentColor } from '@/components/popovers/InstancePopoverContent';
import { InstanceDataAdapter, useEditInstance } from '@/components/popovers/useEditInstance';

interface EditInstanceInlineProps {
  schemaId: string;
  classId: string;
  instanceId: string;
  /** Override the data source (used by Ladle stories that have no DrawerContext). */
  adapter?: InstanceDataAdapter;
}

const noopAdapter: InstanceDataAdapter = {
  getActiveSchema: () => null,
  getInstance: () => null,
  dispatch: () => {},
};

/**
 * Inline host: renders the shared instance form directly in the navigator (no
 * floating chrome, no arrow). Reads/writes through DrawerContext in-process, and
 * persists eagerly — on notes blur and on class change — since it never closes.
 */
export function EditInstanceInline({ schemaId, classId, instanceId, adapter }: EditInstanceInlineProps) {
  // Read the raw context (null-safe) rather than useDrawerContext(), which throws
  // outside a provider — so the component degrades gracefully in stories.
  const ctx = useContext(DrawerContext);
  const ctxAdapter = useMemo<InstanceDataAdapter | null>(() => {
    if (!ctx) return null;
    return {
      getActiveSchema: () => ctx.activeSchema,
      getInstance: (_s, c, i) =>
        ctx.activeSchema.classes.find((cls) => cls.id === c)?.instances.find((inst) => inst.id === i) ?? null,
      dispatch: ctx.dispatch,
    };
  }, [ctx]);

  const effectiveAdapter = adapter ?? ctxAdapter ?? noopAdapter;
  const editor = useEditInstance({ schemaId, classId, instanceId }, effectiveAdapter);
  const accentColor = useStableAccentColor(editor.selectedClass);

  // Persist when the class changes (the notes path saves on blur). Skip the
  // initial mount so seeding the form from the live instance isn't a "change".
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    editor.save();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor.selectedClass]);

  if (!editor.instance) return null;

  return (
    <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700" style={{ backgroundColor: accentColor }}>
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
        actionSlotWidthPx={100}
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
