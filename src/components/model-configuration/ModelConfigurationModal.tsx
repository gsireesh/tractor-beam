import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { ModelConfigurationPanel } from '@/components/model-configuration/ModelConfigurationPanel.tsx';
import { DialogTrigger } from '@/components/ui/dialog';
import { Settings } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton.tsx';

interface ModelConfigProps {
  container?: HTMLElement | null;
}

export function ModelConfigurationModal({ container }: ModelConfigProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <IconButton icon={Settings} title="Model Settings" />
      </DialogTrigger>
      <DialogContent container={container ?? undefined}>
        <DialogHeader>
          <DialogTitle>Configure Model Options</DialogTitle>
        </DialogHeader>
        <ModelConfigurationPanel />
      </DialogContent>
    </Dialog>
  );
}
