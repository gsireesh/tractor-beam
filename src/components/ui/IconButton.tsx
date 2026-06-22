import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';

interface IconButtonProps {
  title: string;
  icon: LucideIcon;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  color?: string | null;
  size?: 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg';
}

export function IconButton(props: IconButtonProps) {
  const { onClick, title, icon: Icon, color, size } = props;
  return (
    <Button variant="ghost" size={size} title={title} onClick={onClick}>
      <Icon strokeWidth={1} color={color ?? 'currentColor'} />
    </Button>
  );
}
