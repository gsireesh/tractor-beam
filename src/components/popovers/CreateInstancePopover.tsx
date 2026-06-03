import { useState } from 'react';
import { Instance, PdfBox, SchemaClass } from '@/lib/definitions';
import { generateId, rgbaToHex } from '@/lib/utils';
import { InstancePopover } from './InstancePopover';

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
  const [addButtonHovered, setAddButtonHovered] = useState<boolean>(false);

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
    <div
      className="flex shrink-0 w-full"
      style={{ gap: 4 }}
      onMouseEnter={() => setAddButtonHovered(true)}
      onMouseLeave={() => setAddButtonHovered(false)}
    >
      <button
        className="flex-1 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
        style={{ backgroundColor: rgbaToHex(accentColor, 1.0) }}
        onClick={() => submit(true)}
        disabled={!selectedClass?.id || !activeSchema}
      >
        {addButtonHovered ? '+' : 'Add'}
      </button>
      {addButtonHovered && (
        <button
          className="flex-1 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
          style={{ backgroundColor: rgbaToHex(accentColor, 1.0) }}
          onClick={() => submit(false)}
          disabled={!selectedClass?.id || !activeSchema}
        >
          −
        </button>
      )}
    </div>
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
      actionSlotWidthPx={100}
      onClose={onClose}
    />
  );
}
