import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface IconButtonProps {
    title: string;
    icon: LucideIcon;
    onClick?: ((e: React.MouseEvent) => void);
    disabled?: boolean;
    color?: string | null;
    size?: number | null;
}


export function IconButton(props: IconButtonProps) {
    const {onClick, title, icon: Icon, color, size} = props;
    return (
        <Button variant="ghost" title={title} onClick={onClick}>
            <Icon strokeWidth={1} size={size ?? "1em"} color={color ?? "black"} />
        </Button>
    )
}