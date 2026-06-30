import type { Schema, SchemaAction } from '@/lib/definitions';

/**
 * Render a persisted schema-change action as a short, human-friendly sentence for
 * the schema history view. Pure — no storage or context.
 *
 * Class-referencing actions resolve the class name against the *current* schema
 * when given one (instance/class IDs alone aren't human-readable). A class that
 * was renamed or deleted since the change won't resolve, so those fall back to
 * generic phrasing rather than a dangling ID.
 */
export function describeSchemaAction(action: SchemaAction, schema?: Schema): string {
  switch (action.actionType) {
    case 'addSchema':
      return `Created schema "${action.schema.name}"`;
    case 'updateSchema':
      return `Updated schema "${action.schemaInfo.name}"`;
    case 'deleteSchema':
      return 'Deleted schema';
    case 'addClass':
      return `Added highlighter "${action.classInfo.name}"`;
    case 'updateClass':
      return `Updated highlighter "${action.classInfo.name}"`;
    case 'deleteClass': {
      const label = classLabel(schema, action.classId);
      return label ? `Deleted highlighter ${label}` : 'Deleted a highlighter';
    }
    case 'addInstance': {
      const label = classLabel(schema, action.classId);
      return label ? `Added example in ${label}` : 'Added an example';
    }
    case 'deleteInstance': {
      const label = classLabel(schema, action.classId);
      return label ? `Removed example in ${label}` : 'Removed an example';
    }
    case 'updateInstance': {
      const { newClassId, positiveExample, notes } = action.updates;
      if (newClassId !== undefined) {
        const label = classLabel(schema, newClassId);
        return label ? `Moved example to ${label}` : 'Moved example to another highlighter';
      }
      if (positiveExample !== undefined) {
        return `Marked example ${positiveExample ? 'positive' : 'negative'}`;
      }
      if (notes !== undefined) {
        return 'Edited example notes';
      }
      return 'Edited an example';
    }
  }
}

/** The quoted current name of a class, or null if it can't be resolved. */
function classLabel(schema: Schema | undefined, classId: string): string | null {
  const name = schema?.classes.find((c) => c.id === classId)?.name;
  return name ? `"${name}"` : null;
}
