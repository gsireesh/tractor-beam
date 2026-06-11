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
   * Portal target. The drawer passes its untransformed root so the overlay
   * covers the viewport rather than being trapped by the drawer's transform.
   * Omit (defaults to document.body) on normal pages like the Schema Manager.
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
