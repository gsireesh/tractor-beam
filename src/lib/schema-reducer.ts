import { Instance, SchemaClass, Schema } from "@/lib/definitions.ts";

interface AddClass {
  actionType: "addClass";
  schemaId: string;
  classInfo: SchemaClass;
}

interface UpdateClass {
  actionType: "updateClass";
  schemaId: string;
  classId: string;
  classInfo: SchemaClass;
}

interface AddInstance {
  actionType: "addInstance",
  schemaId: string;
  classId: string;
  instance: Instance;
}

export type SchemaAction = AddClass | UpdateClass | AddInstance;

export function schemasReducer(draft: Schema[], action: SchemaAction) {
  console.log("action", action);
  switch (action.actionType) {
    case "addClass": {
      const schema = draft.find((s) => s.id == action.schemaId);
      if (schema) {
        schema.classes.push(action.classInfo);
      }
      return;
    }
    case "updateClass": {
      const schema = draft.find((s) => s.id == action.schemaId);
      const classIdx = schema?.classes.findIndex((c) => c.id == action.classId);

      if (schema && classIdx !== undefined) {
        schema.classes[classIdx] = action.classInfo;
      }
      return;;
    }
    case "addInstance": {
      const schema = draft.find((s) => s.id == action.schemaId);
      const classIdx = schema?.classes.findIndex((c) => c.id == action.classId);

      if (schema && classIdx !== undefined) {
        schema.classes[classIdx].instances.push(action.instance);
      }
      return;
    }

  }
}
