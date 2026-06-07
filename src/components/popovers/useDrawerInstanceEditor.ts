import { useContext, useEffect, useMemo, useRef } from 'react';
import { DrawerContext } from '@/contexts/DrawerContext';
import { InstanceDataAdapter, useEditInstance } from '@/components/popovers/useEditInstance';
import { useStableAccentColor } from '@/components/popovers/InstancePopoverContent';

const noopAdapter: InstanceDataAdapter = {
  getActiveSchema: () => null,
  getInstance: () => null,
  dispatch: () => {},
};

interface UseDrawerInstanceEditorParams {
  schemaId: string;
  classId: string;
  instanceId: string;
  /** Override the data source (used by Ladle stories that have no DrawerContext). */
  adapter?: InstanceDataAdapter;
}

/**
 * Shared *logic* for editing a confirmed instance from within the drawer: wires
 * the DrawerContext into an InstanceDataAdapter, runs the edit hook, and persists
 * eagerly on class change (the notes path saves on blur). Presentation is left to
 * the caller — the navigator and the schema viewer render this with different
 * chrome, so only the semantics are unified here, not the look.
 */
export function useDrawerInstanceEditor({
  schemaId,
  classId,
  instanceId,
  adapter,
}: UseDrawerInstanceEditorParams) {
  // Read the raw context (null-safe) rather than useDrawerContext(), which throws
  // outside a provider — so callers degrade gracefully in stories.
  const ctx = useContext(DrawerContext);
  const ctxAdapter = useMemo<InstanceDataAdapter | null>(() => {
    if (!ctx) return null;
    return {
      getActiveSchema: () => ctx.activeSchema,
      getInstance: (_s, c, i) =>
        ctx.activeSchema.classes
          .find((cls) => cls.id === c)
          ?.instances.find((inst) => inst.id === i) ?? null,
      dispatch: ctx.dispatch,
    };
  }, [ctx]);

  const editor = useEditInstance(
    { schemaId, classId, instanceId },
    adapter ?? ctxAdapter ?? noopAdapter,
  );
  const accentColor = useStableAccentColor(editor.selectedClass);

  // Persist when the class changes. Skip the initial mount so seeding the form
  // from the live instance isn't treated as a "change."
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    editor.save();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor.selectedClass]);

  return { editor, accentColor };
}
