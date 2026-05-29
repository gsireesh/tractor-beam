import { ReactNode, useEffect, useState } from 'react';
import { Combobox as ComboboxPrimitive } from '@base-ui/react';
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';

const CREATE_ITEM_PREFIX = '__create__:';

export interface CreatableComboboxProps {
  items: string[];
  value: string;
  inputValue: string;
  onInputValueChange: (v: string) => void;
  onSelect: (label: string) => void;
  onCreate: (label: string) => void;

  allowCreate?: boolean;
  renderCreateLabel?: (label: string) => ReactNode;
  renderItem?: (item: string) => ReactNode;

  inputClassName?: string;
  contentContainer?: ComboboxPrimitive.Portal.Props['container'];
  contentPositionerClassName?: string;
  /**
   * Close the dropdown when any ancestor scrolls. Needed when the dropdown is
   * portaled to a fixed layer (e.g. the popover root) while the trigger lives in
   * a scrolling panel — otherwise the open list stays put as the panel scrolls.
   */
  closeOnScroll?: boolean;
}

export function CreatableCombobox({
  items,
  value,
  inputValue,
  onInputValueChange,
  onSelect,
  onCreate,
  allowCreate = true,
  renderCreateLabel = (label) => `Create new "${label}"`,
  renderItem = (item) => item,
  inputClassName,
  contentContainer,
  contentPositionerClassName,
  closeOnScroll = false,
}: CreatableComboboxProps) {
  // Only take control of `open` when closeOnScroll is requested; otherwise the
  // combobox stays uncontrolled (unchanged behavior for the floating popovers).
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!closeOnScroll || !open) return;
    const close = () => setOpen(false);
    // Capture phase: scroll doesn't bubble, so this catches any scrolling ancestor.
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [closeOnScroll, open]);

  const trimmed = inputValue.trim();
  const hasExactMatch =
    items.some((i) => i.toLowerCase() === trimmed.toLowerCase()) ||
    value.toLowerCase() === trimmed.toLowerCase();
  const showCreate = allowCreate && trimmed.length > 0 && !hasExactMatch;

  const comboboxItems = showCreate ? [...items, CREATE_ITEM_PREFIX + trimmed] : items;

  const filter = (v: string, q: string) => {
    if (v.startsWith(CREATE_ITEM_PREFIX)) return true;
    return v.toLowerCase().includes(q.toLowerCase());
  };

  return (
    <Combobox
      items={comboboxItems}
      value={value}
      onInputValueChange={onInputValueChange}
      filter={filter}
      {...(closeOnScroll ? { open, onOpenChange: setOpen } : {})}
      onValueChange={(picked: string | null) => {
        if (typeof picked === 'string' && picked.startsWith(CREATE_ITEM_PREFIX)) {
          onCreate(picked.slice(CREATE_ITEM_PREFIX.length));
        } else if (typeof picked === 'string') {
          onSelect(picked);
        } else {
          onSelect('');
        }
      }}
    >
      <ComboboxInput
        className={inputClassName}
        onClick={() => onSelect('')}
      />
      <ComboboxContent
        container={contentContainer}
        positionerClassName={contentPositionerClassName}
      >
        <ComboboxList>
          {(name: string) => (
            <ComboboxItem key={name} value={name}>
              {name.startsWith(CREATE_ITEM_PREFIX)
                ? renderCreateLabel(name.slice(CREATE_ITEM_PREFIX.length))
                : renderItem(name)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
