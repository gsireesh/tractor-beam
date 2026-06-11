import type { IconType } from 'react-icons';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ExpandableIconButtonItem {
  key: string;
  label: string;
  icon: IconType;
  onClick: () => void;
}

interface ExpandableIconButtonBarProps {
  items: ExpandableIconButtonItem[];
  className?: string;
}

/**
 * A row of icon-only buttons that expand to reveal their text label on hover.
 * Built for the narrow drawer rail, where three full-text buttons don't fit.
 * The expand is pure CSS (`group` + a width/opacity transition on the label) —
 * no JS state — so it stays cheap and accessible (`title` mirrors the label).
 */
export function ExpandableIconButtonBar({ items, className }: ExpandableIconButtonBarProps) {
  return (
    <div className={cn('inline-flex items-center gap-1 px-1', className)}>
      {items.map(({ key, label, icon: Icon, onClick }) => (
        <Button
          key={key}
          variant="outline"
          size="sm"
          className="group h-6"
          title={label}
          aria-label={label}
          onClick={onClick}
        >
          <Icon />
          <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover:ml-1 group-hover:max-w-[12rem] group-hover:opacity-100">
            {label}
          </span>
        </Button>
      ))}
    </div>
  );
}
