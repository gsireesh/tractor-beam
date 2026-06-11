import { Schema } from '@/lib/definitions';
import { ExportOptions } from '@/lib/export';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ExportPanel } from '@/components/ExportPanel';

interface ExportModalProps {
  open: boolean;
  schema: Schema | null;
  /**
   * Portal target, which must be inside a `.tractor-beam-themed` root or the
   * dialog's `bg-background`/`bg-popover` tokens resolve to nothing and it
   * renders transparent. The drawer passes its untransformed root (also escaping
   * the drawer's transform); standalone pages like the Schema Manager pass their
   * themed `#root`. Defaults to document.body, which is themed on no surface.
   */
  container?: HTMLElement | null;
  onClose: () => void;
  onExport: (opts: ExportOptions) => void;
}

export function ExportModal({ open, schema, container, onClose, onExport }: ExportModalProps) {
  if (!schema) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent container={container ?? undefined} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export &ldquo;{schema.name || 'Untitled schema'}&rdquo;</DialogTitle>
          <DialogDescription>
            Download this schema and bookmark its current state.
          </DialogDescription>
        </DialogHeader>
        <ExportPanel schema={schema} onExport={onExport} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
