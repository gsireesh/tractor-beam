import { useEffect, useRef, useState } from 'react';
import { SchemaClass } from '@/lib/definitions';
import { rgbaToHex } from '@/lib/utils';
import { Trash2 } from 'lucide-react';
import { InstancePopover } from './InstancePopover';
import {SchemaAction} from "@/lib/schema-reducer.ts";
import {normalizeNoteText} from "@/components/popovers/utils.ts";

interface EditInstancePopoverProps {
  schemaId: string;
  classId: string;
  instanceId: string;
  position: { top: number; left: number; bottom: number };
  onClose: () => void;
}


export function EditInstancePopover({
  schemaId,
  classId,
  instanceId,
  position,
  onClose,
}: EditInstancePopoverProps) {
  const activeSchema = window.TractorBeamDrawer?.getActiveSchema() ?? null;
  const instance = window.TractorBeamDrawer?.getInstance(schemaId, classId, instanceId) ?? null;
  const initialClass = activeSchema?.classes.find((c) => c.id === classId) ?? null;

  const [selectedClass, setSelectedClass] = useState<SchemaClass | null>(initialClass);
  const [inputValue, setInputValue] = useState<string>(initialClass?.name ?? '');
  const [notesValue, setNotesValue] = useState<string | null>(instance?.notes ?? null);

  // Snapshot of initial values used by the dirty check.
  const initialValuesRef = useRef({
    notes: instance?.notes ?? null,
    classId,
  });

  // Live state mirrored into refs so the unmount cleanup reads the latest values
  // (cleanups close over the initial render's state otherwise).
  const notesRef = useRef(notesValue);
  notesRef.current = notesValue;
  const selectedClassRef = useRef(selectedClass);
  selectedClassRef.current = selectedClass;

  // When set, the unmount cleanup skips the autosave (used by the Delete path).
  const skipAutosaveRef = useRef(false);

  // TODO(human): Implement the dirty-check that decides what (if anything) to persist
  // when the popover closes. Compare the current values (`notesRef.current`,
  // `selectedClassRef.current`) to `initialValuesRef.current` and return either:
  //   - `null` if nothing meaningful changed (no dispatch will be sent), or
  //   - an `InstanceUpdates` object containing only the fields that actually changed.
  //
  // Things to think about:
  //   - notes: the textarea uses `""` when empty but the instance stores `null` for "no notes".
  //     Are those equivalent? What about whitespace-only edits?
  //   - selectedClass: compare by `id`. It can also be `null` while the user is mid-type in the
  //     combobox — that shouldn't count as a class change.
  //   - newClassId: only include if the class actually changed; otherwise omit so the reducer
  //     stays in the in-place branch.
  const computeUpdates = (): SchemaAction[]=> {
    const updateActions: SchemaAction[] = [];
    if (selectedClassRef.current !== null && !activeSchema!.classes.map(sc => sc.id).includes(selectedClassRef.current.id)) {
      updateActions.push({
        actionType: "addClass",
        schemaId: activeSchema!.id,
        classInfo: selectedClassRef.current
      })
    }

    const textWasUpdated = normalizeNoteText(notesRef.current) !== normalizeNoteText(initialValuesRef.current.notes);
    const classWasChanged = !!selectedClassRef.current?.id && selectedClassRef.current.id !== initialValuesRef.current.classId;

    if (textWasUpdated || classWasChanged) {
      updateActions.push({
        actionType: "updateInstance",
        schemaId: activeSchema!.id,
        classId: initialValuesRef.current.classId,
        instanceId: instanceId,
        updates: {
          ...(textWasUpdated ? { notes: notesRef.current } : {}),
          ...(classWasChanged ? { newClassId: selectedClassRef.current!.id } : {}),
        },
      });
    }

    return updateActions;
  };

  useEffect(() => {
    return () => {
      if (skipAutosaveRef.current) return;
      const updates = computeUpdates();
      if (updates.length === 0) return;
      for (const update of updates) {
        window.TractorBeamDrawer?.dispatch(update);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = () => {
    skipAutosaveRef.current = true;
    window.TractorBeamDrawer?.dispatch({
      actionType: 'deleteInstance',
      schemaId,
      classId,
      instanceId,
    });
    onClose();
  };

  const accentColor = selectedClass?.color ?? 'rgba(0,0,0,0)';

  const actionButtons = (
    <button
      className="flex-1 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 flex items-center justify-center gap-1"
      style={{ backgroundColor: rgbaToHex('rgba(220, 38, 38, 1)', 1.0) }}
      onClick={handleDelete}
      title="Delete instance"
    >
      <Trash2 size={14} strokeWidth={1.5} />
      Delete
    </button>
  );

  if (!instance) {
    // Instance lookup failed — close immediately.
    onClose();
    return null;
  }

  // The reference to accentColor is unused here directly but the popover derives it
  // from selectedClass internally, which we hand it.
  void accentColor;

  return (
    <InstancePopover
      text={instance.text}
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
      allowCreateClass={true}
    />
  );
}
