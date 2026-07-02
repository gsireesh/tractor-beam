// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { DrawerContext, type DrawerContextValue } from '@/contexts/DrawerContext.tsx';
import { SchemaClassViewer } from './SchemaClassViewer';
import type { Schema, SchemaClass } from '@/lib/definitions.ts';

const ctx: DrawerContextValue = {
  activeSchema: { id: 's1', name: 'S', classes: [] } as Schema,
  pdfUrl: 'doc.pdf',
  dispatch: () => {},
  removeMlHighlight: () => {},
};

function makeClass(overrides: Partial<SchemaClass> = {}): SchemaClass {
  return {
    id: 'c1',
    name: 'Foo',
    description: '',
    color: 'rgba(147, 112, 219, 0.3)',
    instances: [],
    ...overrides,
  };
}

function renderViewer(dispatch = vi.fn()) {
  render(
    <DrawerContext.Provider value={ctx}>
      <SchemaClassViewer schemaId="s1" schemaClass={makeClass()} dispatch={dispatch} />
    </DrawerContext.Provider>,
  );
  return dispatch;
}

describe('SchemaClassViewer name editing', () => {
  it('does not dispatch while typing, and commits once on Enter', async () => {
    const user = userEvent.setup();
    const dispatch = renderViewer();

    // Enter edit mode by clicking the class title.
    await user.click(screen.getByText('Foo'));
    const input = screen.getByDisplayValue('Foo');

    await user.type(input, ' Bar');
    expect(dispatch).not.toHaveBeenCalled(); // local draft only, no per-keystroke dispatch

    await user.keyboard('{Enter}');
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'updateClass',
        schemaId: 's1',
        classId: 'c1',
        classInfo: expect.objectContaining({ name: 'Foo Bar' }),
      }),
    );
  });
});
