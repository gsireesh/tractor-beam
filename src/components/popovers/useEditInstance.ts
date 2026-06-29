import { useEffect, useRef, useState } from 'react';
import { Instance, Schema, SchemaAction, SchemaClass } from '@/lib/definitions';
import { normalizeNoteText } from '@/components/popovers/utils';
import { InstanceActionsMenu } from '@/components/popovers/InstanceActionsMenu.tsx';
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
  // Local copy so the chip flips immediately even in the floating popover, which
  // reads a window-API snapshot and so doesn't re-render on dispatch alone.
  const [positiveExample, setPositiveExample] = useState<boolean>(
    instance?.positiveExample ?? true,
  );

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

  // Re-sync notes when the live instance changes underneath us — e.g. the same
  // instance edited from the floating popover while this editor stays mounted in
  // the drawer. useState only seeds at mount, so without this the textarea shows
  // a stale snapshot until the component remounts.
  const persistedNotes = instance?.notes ?? null;
  useEffect(() => {
    setNotesValue(persistedNotes);
  }, [persistedNotes]);

  // Same re-sync for the positive/negative flag (e.g. toggled from another surface).
  const persistedPositive = instance?.positiveExample;
  useEffect(() => {
    if (persistedPositive !== undefined) setPositiveExample(persistedPositive);
  }, [persistedPositive]);

  const computeUpdates = (): SchemaAction[] => {
    const updateActions: SchemaAction[] = [];
    const schema = adapter.getActiveSchema();
    if (!schema) return updateActions;

    // A brand-new class created inline isn't in the schema yet — add it first.
    if (
      selectedClassRef.current !== null &&
      !schema.classes.some((sc) => sc.id === selectedClassRef.current!.id)
    ) {
      updateActions.push({
        actionType: 'addClass',
        schemaId: schema.id,
        classInfo: selectedClassRef.current,
      });
    }

    const notesChanged =
      normalizeNoteText(notesRef.current) !== normalizeNoteText(initialValuesRef.current.notes);
    const classChanged =
      !!selectedClassRef.current?.id &&
      selectedClassRef.current.id !== initialValuesRef.current.classId;

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

  // Flip positive <-> negative immediately (it's a discrete toggle, not part of
  // the dirty-diff form state). Read the live instance so rapid clicks compose.
  const togglePositiveExample = () => {
    const current = adapter.getInstance(schemaId, classId, instanceId);
    if (!current) return;
    const next = !current.positiveExample;
    setPositiveExample(next); // optimistic — drives the floating popover's re-render
    adapter.dispatch({
      actionType: 'updateInstance',
      schemaId,
      classId,
      instanceId,
      updates: { positiveExample: next },
    });
  };

  const actionButtons = createElement(InstanceActionsMenu, { onDelete: handleDelete });

  return {
    instance,
    text: instance?.text ?? '',
    notesValue,
    setNotesValue,
    selectedClass,
    setSelectedClass,
    inputValue,
    setInputValue,
    positiveExample,
    actionButtons,
    classes: activeSchema?.classes ?? [],
    save,
    handleDelete,
    togglePositiveExample,
  };
}
