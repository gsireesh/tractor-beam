import { ReactNode, useEffect, useRef, useState } from 'react';
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

  // Track the last *committed* (non-empty) selection so we can restore it if the
  // user leaves the field with half-typed or unmatched text. An effect keeps the
  // ref current, so the deferred blur handler below always reads a post-commit
  // value — making it a no-op when the blur actually accompanied a real selection.
  const lastValidValueRef = useRef(value);
  useEffect(() => {
    if (value) lastValidValueRef.current = value;
  }, [value]);

  // Guard the deferred revert against running after unmount (the popover unmounts
  // on outside-click, which is itself a blur).
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const revertToLastValidOnBlur = () => {
    // Defer past the current task so any item-selection commit lands first; by the
    // next macrotask `lastValidValueRef` reflects it and re-committing is a no-op.
    window.setTimeout(() => {
      if (!mountedRef.current) return;
      const committed = lastValidValueRef.current;
      // Re-derive the selection ONLY for a name that's in the list — onSelect looks
      // the class up there. A just-created class isn't in `items` yet (it lives as
      // the current selection until save), so looking it up would null it out and
      // blank the field; its selection is already correct, so only fix the text.
      if (items.includes(committed)) {
        onSelect(committed);
      }
      onInputValueChange(committed);
    }, 0);
  };

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
      // Keep the first filtered option highlighted while typing so Enter commits it
      // (an existing class if one matches, otherwise the "Create new" item) instead
      // of committing nothing and blanking the input.
      autoHighlight
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
        onBlur={revertToLastValidOnBlur}
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
