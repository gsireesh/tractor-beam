import type { Story } from '@ladle/react';
import { Play, Square, Save, Settings } from 'lucide-react';
import { IconButton } from './IconButton';

export const Default: Story = () => (
  <IconButton title="Run" icon={Play} onClick={() => console.log('run')} />
);

export const Colored: Story = () => (
  <div className="flex gap-2">
    <IconButton title="Run" icon={Play} color="green" />
    <IconButton title="Stop" icon={Square} color="red" />
    <IconButton title="Save" icon={Save} color="blue" />
  </div>
);

export const Sizes: Story = () => (
  <div className="flex items-center gap-2">
    <IconButton title="xs" icon={Settings} size="icon-xs" />
    <IconButton title="sm" icon={Settings} size="icon-sm" />
    <IconButton title="md" icon={Settings} size="icon" />
    <IconButton title="lg" icon={Settings} size="icon-lg" />
  </div>
);
