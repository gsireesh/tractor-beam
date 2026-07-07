// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { SchemaHeader } from './SchemaHeader';
import type { Schema } from '@/lib/definitions.ts';

const schema: Schema = { id: 's1', name: 'Foo', classes: [] };

function renderHeader(overrides: Partial<Parameters<typeof SchemaHeader>[0]> = {}) {
  const props = {
    activeSchema: schema,
    schemas: [schema],
    editing: true,
    onEditingChange: vi.fn(),
    onRename: vi.fn(),
    onInstructionsChange: vi.fn(),
    onSwitch: vi.fn(),
    onNew: vi.fn(),
    onDelete: vi.fn(),
    onOpenManager: vi.fn(),
    onExport: vi.fn(),
    ...overrides,
  };
  render(<SchemaHeader {...props} />);
  return props;
}

describe('SchemaHeader rename', () => {
  it('does not rename per keystroke — only commits once on blur', async () => {
    const user = userEvent.setup();
    const { onRename, onEditingChange } = renderHeader();

    const input = screen.getByPlaceholderText('Untitled Project');
    expect(input).toHaveValue('Foo'); // seeded from the active schema

    await user.type(input, ' Bar');
    // Still responsive locally, but no dispatch yet.
    expect(input).toHaveValue('Foo Bar');
    expect(onRename).not.toHaveBeenCalled();

    await user.tab(); // blur
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onRename).toHaveBeenCalledWith('Foo Bar');
    expect(onEditingChange).toHaveBeenLastCalledWith(false);
  });

  it('commits on Enter (via blur) and not before', async () => {
    const user = userEvent.setup();
    const { onRename } = renderHeader();

    const input = screen.getByPlaceholderText('Untitled Project');
    await user.type(input, ' Baz');
    expect(onRename).not.toHaveBeenCalled();

    await user.keyboard('{Enter}');
    expect(onRename).toHaveBeenCalledExactlyOnceWith('Foo Baz');
  });

  it('does not dispatch when the name is unchanged', async () => {
    const user = userEvent.setup();
    const { onRename } = renderHeader();

    await user.click(screen.getByPlaceholderText('Untitled Project'));
    await user.tab(); // blur without editing
    expect(onRename).not.toHaveBeenCalled();
  });
});

describe('SchemaHeader instructions', () => {
  it('commits instructions once on close, not per keystroke', async () => {
    const user = userEvent.setup();
    const { onInstructionsChange } = renderHeader({ editing: false });

    await user.click(screen.getByTitle('Project instructions'));
    const textarea = screen.getByPlaceholderText(/Citations are/i);

    await user.type(textarea, 'These are invoices.');
    expect(onInstructionsChange).not.toHaveBeenCalled(); // local draft only

    await user.keyboard('{Escape}'); // closes the popover -> commit
    expect(onInstructionsChange).toHaveBeenCalledExactlyOnceWith('These are invoices.');
  });

  it('does not dispatch when instructions are unchanged', async () => {
    const user = userEvent.setup();
    const withInstructions: Schema = { ...schema, instructions: 'Existing notes.' };
    const { onInstructionsChange } = renderHeader({
      editing: false,
      activeSchema: withInstructions,
    });

    await user.click(screen.getByTitle('Project instructions'));
    expect(screen.getByPlaceholderText(/Citations are/i)).toHaveValue('Existing notes.');
    await user.keyboard('{Escape}'); // close without editing
    expect(onInstructionsChange).not.toHaveBeenCalled();
  });
});
