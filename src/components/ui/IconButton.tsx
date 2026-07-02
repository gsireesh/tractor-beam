import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import { cn } from '@/lib/utils';

interface IconButtonProps {
  title: string;
  icon: LucideIcon;
  /**
   * Optional text shown beside the icon. When set, the button uses a text-sized
   * shape (with padding for the label) instead of a square icon button; the
   * passed `size` (icon sizes) applies only to the icon-only form.
   */
  label?: string;
  /** Button style. Defaults to 'ghost' (borderless); use 'outline' to give a
   *  primary action a border. */
  variant?: 'ghost' | 'outline' | 'secondary' | 'default' | 'destructive' | 'link';
  /** Extra classes merged onto the button (e.g. a custom border color). */
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  color?: string | null;
  /** SVG fill for the icon. Omit for lucide's default outline; set to render a
   *  filled icon (e.g. a filled bookmark to signal a saved state). */
  fill?: string;
  size?: 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg';
  strokeWidth?: number;
}

export function IconButton(props: IconButtonProps) {
  const {
    onClick,
    title,
    icon: Icon,
    label,
    variant,
    className,
    color,
    fill,
    size,
    strokeWidth,
    disabled,
  } = props;
  return (
    <Button
      variant={variant ?? 'ghost'}
      size={label ? 'sm' : (size ?? 'icon')}
      className={cn(label && 'font-normal', className)}
      title={title}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon strokeWidth={strokeWidth ?? 1} color={color ?? 'currentColor'} fill={fill ?? 'none'} />
      {label}
    </Button>
  );
}
