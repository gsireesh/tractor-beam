import { useEffect, useRef, useState } from 'react';
import { Highlight, Instance, SchemaClass } from '@/lib/definitions';
import { generateId, rgbaToHex } from '@/lib/utils';
import { InstancePopover } from './InstancePopover';

interface PromoteInstancePopoverProps {
  highlight: Highlight;
  position: { top: number; left: number; bottom: number };
  onClose: () => void;
}

export function PromoteInstancePopover({
  highlight,
  position,
  onClose,
}: PromoteInstancePopoverProps) {
  const activeSchema = window.TractorBeamDrawer?.getActiveSchema() ?? null;
  const initialClass = activeSchema?.classes.find((c) => c.id === highlight.classId) ?? null;
  const [selectedClass, setSelectedClass] = useState<SchemaClass | null>(initialClass);
  const [inputValue, setInputValue] = useState<string>(initialClass?.name ?? '');
  const [notesValue, setNotesValue] = useState<string | null>(null);
  const [addButtonHovered, setAddButtonHovered] = useState<boolean>(false);

  // Track whether the user submitted (so we know whether to restore on unmount).
  const submittedRef = useRef(false);
  const originalColorRef = useRef<string>(highlight.color);

  // Live color preview: when the selected class changes, push the new color
  // into the highlight render so the underlying rect tracks the popover's accent.
  useEffect(() => {
    if (selectedClass) {
      window.TractorBeamHighlights?.setHighlightColor(highlight.id, selectedClass.color);
    }
  }, [selectedClass, highlight.id]);

  // On unmount: if the user didn't submit, restore the original color.
  useEffect(() => {
    return () => {
      if (!submittedRef.current) {
        window.TractorBeamHighlights?.setHighlightColor(highlight.id, originalColorRef.current);
      }
    };
  }, [highlight.id]);

  const accentColor = selectedClass?.color ?? 'rgba(0,0,0,0)';

  const submit = (positiveExample: boolean) => {
    if (!activeSchema || !selectedClass) return;
    submittedRef.current = true;
    const instance: Instance = {
      id: generateId(),
      instanceType: 'text',
      text: highlight.text ?? '',
      coords: highlight.coords,
      pdfUrl: new URLSearchParams(window.location.search).get('file') ?? '',
      positiveExample,
      notes: notesValue,
    };
    if (activeSchema.classes.some((c) => c.id === selectedClass.id)) {
      window.TractorBeamDrawer.dispatch({
        actionType: 'addInstance',
        schemaId: activeSchema.id,
        classId: selectedClass.id,
        instance,
      });
    } else {
      window.TractorBeamDrawer.dispatch({
        actionType: 'addClass',
        schemaId: activeSchema.id,
        classInfo: { ...selectedClass, instances: [instance] },
      });
    }
    onClose();
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
      text={highlight.text ?? ''}
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
