import { Schema } from '@/lib/definitions.ts';
import { useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  Download,
  EllipsisVerticalIcon,
  PencilLine,
  Plus,
  Table2,
  Trash2,
} from 'lucide-react';
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
import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

export function SchemaHeader({
  activeSchema,
  schemas,
  editing,
  onEditingChange,
  onRename,
  onSwitch,
  onNew,
  onDelete,
  onOpenManager,
  onExport,
}: {
  activeSchema: Schema | null;
  schemas: Schema[];
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onRename: (name: string) => void;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onDelete: () => void;
  onOpenManager: () => void;
  onExport: () => void;
}) {
  // Local draft so typing doesn't dispatch on every keystroke (which would log a
  // schema update per character). Seed it when editing begins; commit once on
  // blur/Enter. Clicking away or tabbing blurs the input, so blur also replaces
  // the old outside-click-to-close handler.
  const [draft, setDraft] = useState('');
  useEffect(() => {
    if (editing && activeSchema) setDraft(activeSchema.name);
  }, [editing, activeSchema]);

  if (!activeSchema) return null;

  const commitRename = () => {
    if (draft !== activeSchema.name) onRename(draft);
  };

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border">
      <div
        className="w-fit"
        onClick={() => {
          if (!editing) onEditingChange(true);
        }}
      >
        {editing ? (
          <input
            autoFocus
            placeholder="Untitled Project"
            className="border-2 bg-card text-base px-1 py-0.5 rounded"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              commitRename();
              onEditingChange(false);
            }}
            onKeyDown={(e) => {
              // Enter commits via blur (onBlur handles rename + close).
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
          />
        ) : (
          <div className="flex items-center gap-1 group cursor-pointer">
            <span className="text-base">{activeSchema.name || 'Untitled Project'}</span>
            <PencilLine
              strokeWidth={1}
              size={16}
              className="invisible group-hover:visible shrink-0"
            />
          </div>
        )}
      </div>
      <div className="ml-auto flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger>
            <IconButton title="Project Actions" icon={EllipsisVerticalIcon} size="icon-sm" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={onNew}>
                <Plus strokeWidth={1} size="1em" />
                New Project
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <ArrowLeftRight strokeWidth={1} size="1em" />
                  Switch Project
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {schemas.map((s) => (
                    <DropdownMenuItem key={s.id} onClick={() => onSwitch(s.id)}>
                      {s.name || 'Untitled Project'}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 strokeWidth={1} size="1em" />
                Delete Project
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={onOpenManager}>
                <Table2 strokeWidth={1} size={'1em'} />
                Open Project Manager
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onExport}>
                <Download strokeWidth={1} size="1em" />
                Export Data
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <ThemeToggle />
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
