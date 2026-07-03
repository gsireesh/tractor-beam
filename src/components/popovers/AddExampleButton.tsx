import { ChevronDown, Minus } from 'lucide-react';
import { rgbaToHex } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';

interface AddExampleButtonProps {
  /** Accent color (rgba string) used to fill both buttons. */
  accentColor: string;
  /** Disables the primary button and the caret menu trigger together. */
  disabled?: boolean;
  /** Commit an example; `positiveExample` is false for the negative-example item. */
  onSubmit: (positiveExample: boolean) => void;
}

/**
 * Action row for committing a highlighted span as a labeled example. The primary
 * button adds a positive example; the caret opens a menu whose only item adds a
 * *negative* example. Shared verbatim by CreateInstancePopover,
 * PromoteInstancePopover, and ProvisionalHighlightSignpost — they build the same
 * Instance and differ only in their disabled condition and accent source.
 *
 * The menu portals into `#tractor-beam-popover-root` (on document.body, where
 * popover-styles.css scopes the theme tokens) so it neither clips against the
 * popover's overflow nor renders transparent — the same trick as InstanceActionsMenu.
 */
export function AddExampleButton({ accentColor, disabled, onSubmit }: AddExampleButtonProps) {
  const fill = rgbaToHex(accentColor, 1.0);
  // Rounding is set per-half (not here) so the two buttons fuse into one split
  // button; a shared `rounded-md` would fight the per-corner overrides since these
  // template classNames don't go through tailwind-merge.
  const buttonClasses =
    'py-2 text-sm font-medium cursor-pointer text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90';

  return (
    <div className="flex shrink-0">
      <button
        className={`px-3 whitespace-nowrap rounded-l-md rounded-r-none ${buttonClasses}`}
        style={{ backgroundColor: fill }}
        onClick={() => onSubmit(true)}
        disabled={disabled}
      >
        Add example
      </button>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          {/* Fused caret half: flat left edge + a faint divider so the two click
              targets read as distinct on the single-color fill. */}
          <button
            className={`px-2 rounded-r-md rounded-l-none border-l border-white/30 ${buttonClasses}`}
            style={{ backgroundColor: fill }}
            disabled={disabled}
            title="More add options"
            aria-label="More add options"
          >
            <ChevronDown size="1em" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal container={document.getElementById('tractor-beam-popover-root')}>
          <DropdownMenuContent align="end" className="z-[100001]">
            <DropdownMenuItem onClick={() => onSubmit(false)}>
              <Minus strokeWidth={1} size="1em" />
              Add negative example
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenu>
    </div>
  );
}
