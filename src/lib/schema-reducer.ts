import type { Instance, Schema, SchemaAction } from '@/lib/definitions.ts';

export function schemasReducer(draft: Schema[], action: SchemaAction) {
  console.log('action', action);
  switch (action.actionType) {
    case 'addSchema': {
      draft.push(action.schema);
      return;
    }
    case 'updateSchema': {
      const idx = draft.findIndex((s) => s.id === action.schemaId);
      if (idx !== -1) {
        draft[idx] = action.schemaInfo;
      }
      return;
    }
    case 'deleteSchema': {
      const idx = draft.findIndex((s) => s.id === action.schemaId);
      if (idx !== -1) {
        draft.splice(idx, 1);
      }
      return;
    }
    case 'addClass': {
      const schema = draft.find((s) => s.id == action.schemaId);
      if (schema) {
        schema.classes.unshift(action.classInfo);
      }
      return;
    }
    case 'updateClass': {
      const schema = draft.find((s) => s.id == action.schemaId);
      const classIdx = schema?.classes.findIndex((c) => c.id == action.classId);

      if (schema && classIdx !== undefined) {
        schema.classes[classIdx] = action.classInfo;
      }
      return;
    }
    case 'deleteClass': {
      const schema = draft.find((s) => s.id == action.schemaId);
      if (schema) {
        schema.classes = schema.classes.filter((c) => c.id !== action.classId);
      }
      return;
    }
    case 'addInstance': {
      const schema = draft.find((s) => s.id == action.schemaId);
      const classIdx = schema?.classes.findIndex((c) => c.id == action.classId);

      if (schema && classIdx !== undefined) {
        schema.classes[classIdx].instances.push(action.instance);
      }
      return;
    }
    case 'deleteInstance': {
      for (const schema of draft) {
        const cls = schema.classes.find((c) => c.id === action.classId);
        if (cls) {
          cls.instances = cls.instances.filter((i) => i.id !== action.instanceId);
          return;
        }
      }
      return;
    }
    case 'updateInstance': {
      const schema = draft.find((s) => s.id === action.schemaId);
      if (!schema) return;
      const currentClass = schema.classes.find((c) => c.id === action.classId);
      if (!currentClass) return;
      const instIdx = currentClass.instances.findIndex((i) => i.id === action.instanceId);
      if (instIdx === -1) return;

      const updated: Instance = { ...currentClass.instances[instIdx] };
      if (action.updates.notes !== undefined) updated.notes = action.updates.notes;
      if (action.updates.positiveExample !== undefined)
        updated.positiveExample = action.updates.positiveExample;

      const moving =
        action.updates.newClassId !== undefined && action.updates.newClassId !== action.classId;
      if (moving) {
        const newClass = schema.classes.find((c) => c.id === action.updates.newClassId);
        if (!newClass) return;
        currentClass.instances.splice(instIdx, 1);
        newClass.instances.push(updated);
      } else {
        currentClass.instances[instIdx] = updated;
      }
      return;
    }
  }
}
