import { describe, it, expect } from 'vitest';
import { describeSchemaAction } from '@/lib/schema-history.ts';
import type { Instance, Schema, SchemaClass } from '@/lib/definitions.ts';

// Minimal, type-honest fixtures. The schema has two classes so name resolution
// (and the move-between-classes case) can be exercised.
function makeClass(overrides: Partial<SchemaClass> = {}): SchemaClass {
  return { id: 'c1', name: 'Materials', description: '', color: 'red', instances: [], ...overrides };
}
function makeInstance(overrides: Partial<Instance> = {}): Instance {
  return {
    id: 'i1',
    instanceType: 'text',
    text: 'graphene',
    positiveExample: true,
    coords: null,
    pdfUrl: 'doc.pdf',
    ...overrides,
  };
}
const schema: Schema = {
  id: 's1',
  name: 'Paper',
  classes: [makeClass(), makeClass({ id: 'c2', name: 'Methods' })],
};

describe('describeSchemaAction', () => {
  it('describes schema-level actions', () => {
    expect(describeSchemaAction({ actionType: 'addSchema', schema })).toBe('Created schema "Paper"');
    expect(
      describeSchemaAction({ actionType: 'updateSchema', schemaId: 's1', schemaInfo: schema }),
    ).toBe('Updated schema "Paper"');
    expect(describeSchemaAction({ actionType: 'deleteSchema', schemaId: 's1' })).toBe(
      'Deleted schema',
    );
  });

  it('describes class actions, using the class name from the action when present', () => {
    expect(
      describeSchemaAction({
        actionType: 'addClass',
        schemaId: 's1',
        classInfo: makeClass({ name: 'Properties' }),
      }),
    ).toBe('Added highlighter "Properties"');
    expect(
      describeSchemaAction({
        actionType: 'updateClass',
        schemaId: 's1',
        classId: 'c1',
        classInfo: makeClass({ name: 'Renamed' }),
      }),
    ).toBe('Updated highlighter "Renamed"');
  });

  it('resolves class names from the current schema for ID-only actions', () => {
    expect(
      describeSchemaAction({ actionType: 'deleteClass', schemaId: 's1', classId: 'c1' }, schema),
    ).toBe('Deleted highlighter "Materials"');
    expect(
      describeSchemaAction(
        { actionType: 'addInstance', schemaId: 's1', classId: 'c2', instance: makeInstance() },
        schema,
      ),
    ).toBe('Added example in "Methods"');
    expect(
      describeSchemaAction(
        { actionType: 'deleteInstance', schemaId: 's1', classId: 'c1', instanceId: 'i1' },
        schema,
      ),
    ).toBe('Removed example in "Materials"');
  });

  it('falls back to generic phrasing when the class no longer resolves', () => {
    // No schema passed, or class deleted/renamed since → no dangling ID leaks out.
    expect(describeSchemaAction({ actionType: 'deleteClass', schemaId: 's1', classId: 'gone' })).toBe(
      'Deleted a highlighter',
    );
    expect(
      describeSchemaAction(
        { actionType: 'addInstance', schemaId: 's1', classId: 'gone', instance: makeInstance() },
        schema,
      ),
    ).toBe('Added an example');
  });

  describe('updateInstance discriminates on what changed', () => {
    const base = { actionType: 'updateInstance' as const, schemaId: 's1', classId: 'c1', instanceId: 'i1' };

    it('reports a move to another highlighter', () => {
      expect(describeSchemaAction({ ...base, updates: { newClassId: 'c2' } }, schema)).toBe(
        'Moved example to "Methods"',
      );
    });
    it('reports positive/negative marking', () => {
      expect(describeSchemaAction({ ...base, updates: { positiveExample: true } })).toBe(
        'Marked example positive',
      );
      expect(describeSchemaAction({ ...base, updates: { positiveExample: false } })).toBe(
        'Marked example negative',
      );
    });
    it('reports a notes edit', () => {
      expect(describeSchemaAction({ ...base, updates: { notes: 'see fig 2' } })).toBe(
        'Edited example notes',
      );
    });
  });

  describe('restore', () => {
    it('names the target version via the resolver', () => {
      expect(
        describeSchemaAction(
          { actionType: 'restore', schemaId: 's1', restoredFrom: 20, schema },
          schema,
          (ref) => (ref === 20 ? 'amber-ledger' : undefined),
        ),
      ).toBe('Restored to version "amber-ledger"');
    });

    it('falls back when the version label cannot be resolved', () => {
      expect(
        describeSchemaAction({ actionType: 'restore', schemaId: 's1', restoredFrom: 99, schema }),
      ).toBe('Restored to an earlier version');
    });
  });
});
