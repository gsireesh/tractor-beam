import { useEffect, useMemo } from 'react';
import { InstancePopover } from './InstancePopover';
import { InstanceDataAdapter, useEditInstance } from './useEditInstance';

interface EditInstancePopoverProps {
  schemaId: string;
  classId: string;
  instanceId: string;
  position: { top: number; left: number; bottom: number };
  onClose: () => void;
}

/**
 * Floating host: drives the shared edit logic against the window API and renders
 * it in the rect-anchored popover chrome. Autosaves on close (unmount).
 */
export function EditInstancePopover({
  schemaId,
  classId,
  instanceId,
  position,
  onClose,
}: EditInstancePopoverProps) {
  const adapter = useMemo<InstanceDataAdapter>(
    () => ({
      getActiveSchema: () => window.TractorBeamDrawer?.getActiveSchema() ?? null,
      getInstance: (s, c, i) => window.TractorBeamDrawer?.getInstance(s, c, i) ?? null,
      dispatch: (a) => window.TractorBeamDrawer?.dispatch(a),
    }),
    [],
  );

  const editor = useEditInstance({ schemaId, classId, instanceId, onDeleted: onClose }, adapter);

  useEffect(() => {
    return () => editor.save();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!editor.instance) {
    // Instance lookup failed — close immediately.
    onClose();
    return null;
  }

  return (
    <InstancePopover
      text={editor.text}
      positiveExample={editor.instance.positiveExample}
      position={position}
      notesValue={editor.notesValue}
      onNotesChange={editor.setNotesValue}
      selectedClass={editor.selectedClass}
      onSelectedClassChange={editor.setSelectedClass}
      inputValue={editor.inputValue}
      onInputValueChange={editor.setInputValue}
      actionButtons={editor.actionButtons}
      actionSlotWidthPx={100}
      onClose={onClose}
      allowCreateClass={true}
    />
  );
}
