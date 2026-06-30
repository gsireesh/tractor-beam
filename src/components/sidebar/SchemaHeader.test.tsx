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
