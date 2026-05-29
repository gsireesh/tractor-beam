import { useRef, useState } from 'react';
import { Instance, Schema, SchemaClass } from '@/lib/definitions';
import { rgbaToHex } from '@/lib/utils';
import { SchemaAction } from '@/lib/schema-reducer';
import { normalizeNoteText } from '@/components/popovers/utils';
import { Trash2 } from 'lucide-react';
import { createElement } from 'react';

/**
 * Where the editor reads/writes instance data. The floating popover supplies a
 * window-API adapter; the in-navigator editor supplies a DrawerContext adapter.
 * Same edit logic either way.
 */
export interface InstanceDataAdapter {
  getActiveSchema: () => Schema | null;
  getInstance: (schemaId: string, classId: string, instanceId: string) => Instance | null;
  dispatch: (action: SchemaAction) => void;
}

export interface UseEditInstanceParams {
  schemaId: string;
  classId: string;
  instanceId: string;
  /** Called after a delete is dispatched (e.g. to close a popover). */
  onDeleted?: () => void;
}

/**
 * Shared edit-instance logic. Seeds form state from the live instance, computes
 * a dirty diff, and exposes `save()` (dispatch the diff) + `handleDelete()`.
 * Callers decide *when* to save: the popover on unmount, the inline editor on
 * blur / class-change.
 */
export function useEditInstance(
  { schemaId, classId, instanceId, onDeleted }: UseEditInstanceParams,
  adapter: InstanceDataAdapter,
) {
  const activeSchema = adapter.getActiveSchema();
  const instance = adapter.getInstance(schemaId, classId, instanceId);
  const initialClass = activeSchema?.classes.find((c) => c.id === classId) ?? null;

  const [selectedClass, setSelectedClass] = useState<SchemaClass | null>(initialClass);
  const [inputValue, setInputValue] = useState<string>(initialClass?.name ?? '');
  const [notesValue, setNotesValue] = useState<string | null>(instance?.notes ?? null);

  // Snapshot of last-persisted values for the dirty check. Reset after each save
  // so repeated saves (the inline editor saves often) don't re-dispatch no-ops.
  const initialValuesRef = useRef({ notes: instance?.notes ?? null, classId });

  // Live state mirrored into refs so save() — which may be invoked from an unmount
  // cleanup that closed over an earlier render — reads the latest values.
  const notesRef = useRef(notesValue);
  notesRef.current = notesValue;
  const selectedClassRef = useRef(selectedClass);
  selectedClassRef.current = selectedClass;

  // Set by the delete path so a trailing save() (e.g. on unmount) is skipped.
  const skipSaveRef = useRef(false);

  const computeUpdates = (): SchemaAction[] => {
    const updateActions: SchemaAction[] = [];
    const schema = adapter.getActiveSchema();
    if (!schema) return updateActions;

    // A brand-new class created inline isn't in the schema yet — add it first.
    if (selectedClassRef.current !== null && !schema.classes.some((sc) => sc.id === selectedClassRef.current!.id)) {
      updateActions.push({
        actionType: 'addClass',
        schemaId: schema.id,
        classInfo: selectedClassRef.current,
      });
    }

    const notesChanged = normalizeNoteText(notesRef.current) !== normalizeNoteText(initialValuesRef.current.notes);
    const classChanged = !!selectedClassRef.current?.id && selectedClassRef.current.id !== initialValuesRef.current.classId;

    if (notesChanged || classChanged) {
      updateActions.push({
        actionType: 'updateInstance',
        schemaId: schema.id,
        classId: initialValuesRef.current.classId,
        instanceId,
        updates: {
          ...(notesChanged ? { notes: notesRef.current } : {}),
          ...(classChanged ? { newClassId: selectedClassRef.current!.id } : {}),
        },
      });
    }

    return updateActions;
  };

  const save = () => {
    if (skipSaveRef.current) return;
    const updates = computeUpdates();
    if (updates.length === 0) return;
    for (const update of updates) {
      adapter.dispatch(update);
    }
    // Advance the baseline so the next save only sees genuinely new edits.
    initialValuesRef.current = {
      notes: notesRef.current,
      classId: selectedClassRef.current?.id ?? initialValuesRef.current.classId,
    };
  };

  const handleDelete = () => {
    skipSaveRef.current = true;
    adapter.dispatch({ actionType: 'deleteInstance', schemaId, classId, instanceId });
    onDeleted?.();
  };

  const actionButtons = createElement(
    'button',
    {
      className:
        'flex-1 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 flex items-center justify-center gap-1',
      style: { backgroundColor: rgbaToHex('rgba(220, 38, 38, 1)', 1.0) },
      onClick: handleDelete,
      title: 'Delete instance',
    },
    createElement(Trash2, { size: 14, strokeWidth: 1.5 }),
    'Delete',
  );

  return {
    instance,
    text: instance?.text ?? '',
    notesValue,
    setNotesValue,
    selectedClass,
    setSelectedClass,
    inputValue,
    setInputValue,
    actionButtons,
    classes: activeSchema?.classes ?? [],
    save,
    handleDelete,
  };
}
