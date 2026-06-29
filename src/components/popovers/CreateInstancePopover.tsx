import { useState } from 'react';
import { Instance, PdfBox, SchemaClass } from '@/lib/definitions';
import { generateId } from '@/lib/utils';
import { InstancePopover } from './InstancePopover';
import { AddExampleButton } from './AddExampleButton';

interface CreateInstancePopoverProps {
  text: string;
  pdfUrl: string;
  position: { top: number; left: number; bottom: number };
  coords?: PdfBox[] | null;
  onClose: () => void;
  onAddInstance: (schemaId: string, classId: string, instance: Instance) => void;
  onAddClass: (schemaId: string, schemaClass: SchemaClass) => void;
}

export function CreateInstancePopover({
  text,
  pdfUrl,
  position,
  coords,
  onClose,
  onAddInstance,
  onAddClass,
}: CreateInstancePopoverProps) {
  const activeSchema = window.TractorBeamDrawer?.getActiveSchema() ?? null;
  const [selectedClass, setSelectedClass] = useState<SchemaClass | null>(
    () => activeSchema?.classes?.[0] ?? null,
  );
  const [inputValue, setInputValue] = useState<string>(activeSchema?.classes?.[0]?.name ?? '');
  const [notesValue, setNotesValue] = useState<string | null>(null);

  const accentColor = selectedClass?.color ?? 'rgba(0,0,0,0)';

  const submit = (positiveExample: boolean) => {
    if (!activeSchema || !selectedClass) return;
    const instance: Instance = {
      id: generateId(),
      instanceType: 'text',
      text,
      coords: coords ?? null,
      pdfUrl,
      positiveExample,
      notes: notesValue,
    };
    if (activeSchema.classes.some((c) => c.id === selectedClass.id)) {
      onAddInstance(activeSchema.id, selectedClass.id, instance);
    } else {
      onAddClass(activeSchema.id, { ...selectedClass, instances: [instance] });
    }
  };

  const actionButtons = (
    <AddExampleButton
      accentColor={accentColor}
      disabled={!selectedClass?.id || !activeSchema}
      onSubmit={submit}
    />
  );

  return (
    <InstancePopover
      text={text}
      position={position}
      notesValue={notesValue}
      onNotesChange={setNotesValue}
      selectedClass={selectedClass}
      onSelectedClassChange={setSelectedClass}
      inputValue={inputValue}
      onInputValueChange={setInputValue}
      actionButtons={actionButtons}
      onClose={onClose}
    />
  );
}
