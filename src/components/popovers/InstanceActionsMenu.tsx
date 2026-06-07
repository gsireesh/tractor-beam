import { MoreVertical, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { IconButton } from '@/components/IconButton.tsx';

/**
 * Kebab → dropdown → destructive "Delete" for an instance, mirroring the class
 * actions menu in SchemaClassViewer. The content is portaled into
 * `#tractor-beam-popover-root`: that element is on document.body (so the
 * popover/drawer overflow can't clip it) AND popover-styles.css scopes the
 * shadcn theme tokens (--popover etc.) there, so the menu isn't transparent.
 */
export function InstanceActionsMenu({ onDelete }: { onDelete: () => void }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger>
        <IconButton title="Instance actions" icon={MoreVertical} size={'icon'} />
      </DropdownMenuTrigger>
      <DropdownMenuPortal container={document.getElementById('tractor-beam-popover-root')}>
        <DropdownMenuContent className="z-[100001]">
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 strokeWidth={1} size={'1em'} />
              Delete
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}
