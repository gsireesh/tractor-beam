/**
 * Row projection out of the schema tree.
 *
 * A ManagerRow is one instance, flattened out of the schema tree
 * (schema → class → instance) so it can live in a flat, filterable/exportable
 * table. Kept as a standalone leaf module so both the Schema Manager UI and the
 * export lib can reuse it without dragging in the manager's filtering code.
 */

import { Schema } from '@/lib/definitions';

export interface ManagerRow {
  instanceId: string;
  classId: string;
  className: string;
  classColor: string; // rgba(...) string from SchemaClass.color
  pdfUrl: string;
  text: string;
  notes: string | null;
  positiveExample: boolean;
}

export function flattenSchema(schema: Schema): ManagerRow[] {
  return schema.classes.flatMap((cls) =>
    cls.instances.map((inst) => ({
      instanceId: inst.id,
      classId: cls.id,
      className: cls.name,
      classColor: cls.color,
      pdfUrl: inst.pdfUrl,
      text: inst.text,
      notes: inst.notes ?? null,
      positiveExample: inst.positiveExample,
    })),
  );
}
