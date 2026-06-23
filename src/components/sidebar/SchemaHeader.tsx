import { Schema } from '@/lib/definitions.ts';
import { useEffect, useRef } from 'react';
import { ArrowLeftRight, EllipsisVerticalIcon, PencilLine, Plus, Trash2 } from 'lucide-react';
import { ThemeToggle } from '@/components/sidebar/ThemeToggle.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { IconButton } from '@/components/ui/IconButton.tsx';

export function SchemaHeader({
  activeSchema,
  schemas,
  editing,
  onEditingChange,
  onRename,
  onSwitch,
  onNew,
  onDelete,
}: {
  activeSchema: Schema | null;
  schemas: Schema[];
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onRename: (name: string) => void;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onDelete: () => void;
}) {
  const titleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editing) return;
    const handler = (e: MouseEvent) => {
      if (titleRef.current && !titleRef.current.contains(e.target as Node)) {
        onEditingChange(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editing, onEditingChange]);

  if (!activeSchema) return null;

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border">
      <div
        ref={titleRef}
        className="w-fit"
        onClick={() => {
          if (!editing) onEditingChange(true);
        }}
      >
        {editing ? (
          <input
            autoFocus
            placeholder="Schema name"
            className="border-2 bg-card text-base px-1 py-0.5 rounded"
            value={activeSchema.name}
            onChange={(e) => onRename(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onEditingChange(false);
            }}
          />
        ) : (
          <div className="flex items-center gap-1 group cursor-pointer">
            <span className="text-base">{activeSchema.name || 'Untitled schema'}</span>
            <PencilLine
              strokeWidth={1}
              size={16}
              className="invisible group-hover:visible shrink-0"
            />
          </div>
        )}
      </div>
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger>
            <IconButton title="Schema actions" icon={EllipsisVerticalIcon} size="icon-sm" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={onNew}>
                <Plus strokeWidth={1} size="1em" />
                New Schema
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <ArrowLeftRight strokeWidth={1} size="1em" />
                  Switch Schema
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {schemas.map((s) => (
                    <DropdownMenuItem key={s.id} onClick={() => onSwitch(s.id)}>
                      {s.name || 'Untitled schema'}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 strokeWidth={1} size="1em" />
                Delete Schema
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
