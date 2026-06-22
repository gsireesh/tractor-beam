import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { schemasReducer } from '@/lib/schema-reducer.ts';
import { placeholderSchemas } from '@/lib/placeholder-schemas.ts';
import type { Schema, SchemaClass, Instance, SchemaAction } from '@/lib/definitions.ts';

// Run the reducer the way the app actually runs it: through Immer's `produce`,
// exactly like `useImmerReducer` does in persisted-reducer.ts. `produce` applies
// the draft mutations immutably and returns a NEW state, leaving the input
// untouched — so we can assert immutability, and a true no-op returns deep-equal
// state.
function reduce(state: Schema[], action: SchemaAction): Schema[] {
  return produce(state, (draft) => {
    schemasReducer(draft, action);
  });
}

// A fresh, deep copy of the real seed data for each test, so tests stay isolated
// and never leak mutations into one another.
function freshState(): Schema[] {
  return structuredClone(placeholderSchemas);
}

// Find-and-guard helpers: locate by name (not brittle index), and fail loudly +
// narrow the type if the fixture isn't shaped as expected. `expect.unreachable`
// returns `never`, so callers get a non-optional type back.
function getSchema(state: Schema[], name: string): Schema {
  const schema = state.find((s) => s.name === name);
  if (!schema) expect.unreachable(`fixture/result missing schema: ${name}`);
  return schema;
}
function getClass(schema: Schema, name: string): SchemaClass {
  const cls = schema.classes.find((c) => c.name === name);
  if (!cls) expect.unreachable(`fixture/result missing class: ${name}`);
  return cls;
}

describe('schemasReducer', () => {
  describe('addSchema', () => {
    it('appends the new schema and leaves the original state untouched', () => {
      const state = freshState();
      const before = state.length;
      const newSchema: Schema = { id: 'brand-new', name: 'New Schema', classes: [] };

      const next = reduce(state, { actionType: 'addSchema', schema: newSchema });

      expect(next).toHaveLength(before + 1);
      expect(next.find((s) => s.id === 'brand-new')).toEqual(newSchema);
      // Immutability: produce must not have mutated the input array.
      expect(state).toHaveLength(before);
    });

    it('adds the schema without disturbing existing schemas', () => {
      const state = freshState();
      const existingIds = state.map((s) => s.id);

      const next = reduce(state, {
        actionType: 'addSchema',
        schema: { id: 'brand-new', name: 'New Schema', classes: [] },
      });

      for (const id of existingIds) {
        expect(next.map((s) => s.id)).toContain(id);
      }
    });
  });

  describe('updateSchema', () => {
    it('replaces the matched schema wholesale', () => {
      const state = freshState();
      const target = getSchema(state, 'MatSci Schema');
      const replacement: Schema = { id: target.id, name: 'Renamed MatSci', classes: [] };

      const next = reduce(state, {
        actionType: 'updateSchema',
        schemaId: target.id,
        schemaInfo: replacement,
      });

      expect(getSchema(next, 'Renamed MatSci')).toEqual(replacement);
      expect(next.find((s) => s.name === 'MatSci Schema')).toBeUndefined();
    });

    it('leaves sibling schemas untouched', () => {
      const state = freshState();
      const target = getSchema(state, 'MatSci Schema');
      const sibling = getSchema(state, 'STS Reading');

      const next = reduce(state, {
        actionType: 'updateSchema',
        schemaId: target.id,
        schemaInfo: { id: target.id, name: 'X', classes: [] },
      });

      expect(getSchema(next, 'STS Reading')).toEqual(sibling);
    });

    it('is a no-op when the schemaId is not found', () => {
      const state = freshState();
      const next = reduce(state, {
        actionType: 'updateSchema',
        schemaId: 'nonexistent',
        schemaInfo: { id: 'nonexistent', name: 'X', classes: [] },
      });

      expect(next).toEqual(freshState());
    });
  });

  describe('deleteSchema', () => {
    it('removes the target schema', () => {
      const state = freshState();
      const target = getSchema(state, 'MatSci Schema');

      const next = reduce(state, { actionType: 'deleteSchema', schemaId: target.id });

      expect(next.map((s) => s.id)).not.toContain(target.id);
      expect(next).toHaveLength(state.length - 1);
    });

    it('leaves sibling schemas present', () => {
      const state = freshState();
      const target = getSchema(state, 'MatSci Schema');

      const next = reduce(state, { actionType: 'deleteSchema', schemaId: target.id });

      expect(next.find((s) => s.name === 'STS Reading')).toBeDefined();
    });

    it('is a no-op when the schemaId is not found', () => {
      const state = freshState();
      const next = reduce(state, { actionType: 'deleteSchema', schemaId: 'nonexistent' });

      expect(next).toEqual(freshState());
    });
  });

  describe('addClass', () => {
    const makeClass = (): SchemaClass => ({
      id: 'new-class',
      name: 'New Class',
      description: '',
      color: '#aabbcc',
      instances: [],
    });

    it('adds the class to the correct schema', () => {
      const state = freshState();
      const schema = getSchema(state, 'MatSci Schema');

      const next = reduce(state, {
        actionType: 'addClass',
        schemaId: schema.id,
        classInfo: makeClass(),
      });

      expect(getSchema(next, 'MatSci Schema').classes.map((c) => c.id)).toContain('new-class');
    });

    it('does not add the class to other schemas', () => {
      const state = freshState();
      const schema = getSchema(state, 'MatSci Schema');
      const stsClassCount = getSchema(state, 'STS Reading').classes.length;

      const next = reduce(state, {
        actionType: 'addClass',
        schemaId: schema.id,
        classInfo: makeClass(),
      });

      expect(getSchema(next, 'STS Reading').classes).toHaveLength(stsClassCount);
    });

    it('is a no-op when the schemaId is not found', () => {
      const state = freshState();
      const next = reduce(state, {
        actionType: 'addClass',
        schemaId: 'nonexistent',
        classInfo: makeClass(),
      });

      expect(next).toEqual(freshState());
    });
  });

  describe('updateClass', () => {
    it('replaces the matched class content', () => {
      const state = freshState();
      const schema = getSchema(state, 'MatSci Schema');
      const target = getClass(schema, 'Material');
      const replacement: SchemaClass = { ...target, name: 'Renamed Material' };

      const next = reduce(state, {
        actionType: 'updateClass',
        schemaId: schema.id,
        classId: target.id,
        classInfo: replacement,
      });

      expect(getClass(getSchema(next, 'MatSci Schema'), 'Renamed Material')).toEqual(replacement);
    });

    it('is a no-op when the schemaId is not found', () => {
      const state = freshState();
      const next = reduce(state, {
        actionType: 'updateClass',
        schemaId: 'nonexistent',
        classId: 'Material',
        classInfo: { id: 'x', name: 'X', description: '', color: '#fff', instances: [] },
      });

      expect(next).toEqual(freshState());
    });

    // ⚠️ Asserts CORRECT behavior (no-op). Expected to FAIL: the guard checks
    // `classIdx !== undefined`, but findIndex returns -1 (not undefined) when the
    // class is missing, so the reducer runs `schema.classes[-1] = classInfo`.
    it('is a no-op when the classId is not found', () => {
      const state = freshState();
      const schema = getSchema(state, 'MatSci Schema');

      const next = reduce(state, {
        actionType: 'updateClass',
        schemaId: schema.id,
        classId: 'nonexistent-class',
        classInfo: { id: 'x', name: 'X', description: '', color: '#fff', instances: [] },
      });

      expect(next).toEqual(freshState());
    });
  });

  describe('addInstance', () => {
    const makeInstance = (): Instance => ({
      id: 'new-inst',
      instanceType: 'text',
      text: 'hello',
      positiveExample: true,
      coords: null,
      pdfUrl: 'https://example.com/doc.pdf',
    });

    it('adds the instance to the correct class', () => {
      const state = freshState();
      const schema = getSchema(state, 'STS Reading');
      const cls = getClass(schema, 'Historical AI Projects');

      const next = reduce(state, {
        actionType: 'addInstance',
        schemaId: schema.id,
        classId: cls.id,
        instance: makeInstance(),
      });

      expect(
        getClass(getSchema(next, 'STS Reading'), 'Historical AI Projects').instances.map(
          (i) => i.id,
        ),
      ).toContain('new-inst');
    });

    it('is a no-op when the schemaId is not found', () => {
      const state = freshState();
      const next = reduce(state, {
        actionType: 'addInstance',
        schemaId: 'nonexistent',
        classId: 'whatever',
        instance: makeInstance(),
      });

      expect(next).toEqual(freshState());
    });

    // ⚠️ Asserts CORRECT behavior (no-op). Expected to ERROR (TypeError): same
    // broken guard as updateClass — `schema.classes[-1]` is undefined, so
    // `.instances.push(...)` throws.
    it('is a no-op when the classId is not found', () => {
      const state = freshState();
      const schema = getSchema(state, 'STS Reading');

      const next = reduce(state, {
        actionType: 'addInstance',
        schemaId: schema.id,
        classId: 'nonexistent-class',
        instance: makeInstance(),
      });

      expect(next).toEqual(freshState());
    });
  });

  describe('deleteClass', () => {
    it('removes the target class from its schema', () => {
      const state = freshState();
      const schema = getSchema(state, 'STS Reading');
      const target = getClass(schema, 'Methods/Approaches');

      const next = reduce(state, {
        actionType: 'deleteClass',
        schemaId: schema.id,
        classId: target.id,
      });

      expect(getSchema(next, 'STS Reading').classes.map((c) => c.id)).not.toContain(target.id);
    });

    it('is a no-op when the classId is not found', () => {
      const state = freshState();
      const schema = getSchema(state, 'STS Reading');

      const next = reduce(state, {
        actionType: 'deleteClass',
        schemaId: schema.id,
        classId: 'nonexistent-class',
      });

      expect(next).toEqual(freshState());
    });

    it('is a no-op when the schemaId is not found', () => {
      const state = freshState();
      const next = reduce(state, {
        actionType: 'deleteClass',
        schemaId: 'nonexistent',
        classId: 'whatever',
      });

      expect(next).toEqual(freshState());
    });
  });

  describe('deleteInstance', () => {
    it('removes the instance from its class', () => {
      const state = freshState();
      const schema = getSchema(state, 'STS Reading');
      const cls = getClass(schema, 'Historical AI Projects');
      const instanceId = cls.instances[0].id;

      const next = reduce(state, {
        actionType: 'deleteInstance',
        schemaId: schema.id,
        classId: cls.id,
        instanceId,
      });

      expect(
        getClass(getSchema(next, 'STS Reading'), 'Historical AI Projects').instances.map(
          (i) => i.id,
        ),
      ).not.toContain(instanceId);
    });

    it('is a no-op when the instanceId is not found', () => {
      const state = freshState();
      const schema = getSchema(state, 'STS Reading');
      const cls = getClass(schema, 'Historical AI Projects');

      const next = reduce(state, {
        actionType: 'deleteInstance',
        schemaId: schema.id,
        classId: cls.id,
        instanceId: 'nonexistent-instance',
      });

      expect(next).toEqual(freshState());
    });

    // Regression guards for the scoping fix: deleteInstance must NOT delete when
    // the schemaId/classId don't match (it used to ignore them and search all
    // schemas, deleting the instance wherever it lived).
    it('is a no-op when the schemaId does not match', () => {
      const state = freshState();
      const schema = getSchema(state, 'STS Reading');
      const cls = getClass(schema, 'Historical AI Projects');
      const instanceId = cls.instances[0].id;

      const next = reduce(state, {
        actionType: 'deleteInstance',
        schemaId: 'nonexistent-schema',
        classId: cls.id,
        instanceId,
      });

      expect(next).toEqual(freshState());
    });

    it('is a no-op when the classId does not match', () => {
      const state = freshState();
      const schema = getSchema(state, 'STS Reading');
      const cls = getClass(schema, 'Historical AI Projects');
      const instanceId = cls.instances[0].id;

      const next = reduce(state, {
        actionType: 'deleteInstance',
        schemaId: schema.id,
        classId: 'nonexistent-class',
        instanceId,
      });

      expect(next).toEqual(freshState());
    });
  });

  describe('updateInstance (move between classes)', () => {
    it('moves an instance from its old class into the new class', () => {
      const state = freshState();
      const schema = getSchema(state, 'STS Reading');
      const sourceClass = getClass(schema, 'Historical AI Projects');
      const targetClass = getClass(schema, 'Methods/Approaches');
      const instance = sourceClass.instances[0];

      const updatedState = reduce(state, {
        actionType: 'updateInstance',
        schemaId: schema.id,
        instanceId: instance.id,
        classId: sourceClass.id,
        updates: { newClassId: targetClass.id },
      });

      const updatedSchema = getSchema(updatedState, 'STS Reading');
      const updatedSource = getClass(updatedSchema, 'Historical AI Projects');
      const updatedTarget = getClass(updatedSchema, 'Methods/Approaches');

      expect(updatedTarget.instances.map((i) => i.id)).toContain(instance.id);
      expect(updatedSource.instances.map((i) => i.id)).not.toContain(instance.id);
    });

    it('is a no-op when moving to a non-existent class (instance stays in source)', () => {
      const state = freshState();
      const schema = getSchema(state, 'STS Reading');
      const sourceClass = getClass(schema, 'Historical AI Projects');
      const instance = sourceClass.instances[0];

      const next = reduce(state, {
        actionType: 'updateInstance',
        schemaId: schema.id,
        classId: sourceClass.id,
        instanceId: instance.id,
        updates: { newClassId: 'nonexistent-class' },
      });

      expect(
        getClass(getSchema(next, 'STS Reading'), 'Historical AI Projects').instances.map(
          (i) => i.id,
        ),
      ).toContain(instance.id);
    });
  });

  describe('updateInstance (field updates)', () => {
    it('updates notes in place', () => {
      const state = freshState();
      const schema = getSchema(state, 'STS Reading');
      const cls = getClass(schema, 'Historical AI Projects');
      const target = cls.instances[0];

      const next = reduce(state, {
        actionType: 'updateInstance',
        schemaId: schema.id,
        classId: cls.id,
        instanceId: target.id,
        updates: { notes: 'edited note' },
      });

      const updated = getClass(
        getSchema(next, 'STS Reading'),
        'Historical AI Projects',
      ).instances.find((i) => i.id === target.id);
      expect(updated?.notes).toBe('edited note');
    });

    it('updates positiveExample in place', () => {
      const state = freshState();
      const schema = getSchema(state, 'STS Reading');
      const cls = getClass(schema, 'Historical AI Projects');
      const target = cls.instances[0];

      const next = reduce(state, {
        actionType: 'updateInstance',
        schemaId: schema.id,
        classId: cls.id,
        instanceId: target.id,
        updates: { positiveExample: !target.positiveExample },
      });

      const updated = getClass(
        getSchema(next, 'STS Reading'),
        'Historical AI Projects',
      ).instances.find((i) => i.id === target.id);
      expect(updated?.positiveExample).toBe(!target.positiveExample);
    });

    it('is a no-op when the instanceId is not found', () => {
      const state = freshState();
      const schema = getSchema(state, 'STS Reading');
      const cls = getClass(schema, 'Historical AI Projects');

      const next = reduce(state, {
        actionType: 'updateInstance',
        schemaId: schema.id,
        classId: cls.id,
        instanceId: 'nonexistent-instance',
        updates: { notes: 'x' },
      });

      expect(next).toEqual(freshState());
    });
  });
});
