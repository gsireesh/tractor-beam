import { useEffect, useMemo, useState } from 'react';
import { MlProgressMessage } from '@/lib/messaging/message_definitions.ts';

import { Progress } from '@/components/ui/progress.tsx';
import { ChevronDown, LayoutPanelLeft, Play, Square, History, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { loadModelConfig, saveModelConfig } from '@/lib/config-storage.ts';
import {
  type ModelConfig,
  type ModelProvider,
  ModelProviderNameMap,
} from '@/lib/ml/model-config.ts';
import { ANTHROPIC_MODELS } from '@/lib/ml/claude-runner.ts';
import { OPENAI_MODELS } from '@/lib/ml/openai-runner.ts';
import { WEBLLM_MODELS } from '@/lib/ml/types.ts';
import { useDrawerContext } from '@/contexts/DrawerContext.tsx';
import { IconButton } from '@/components/ui/IconButton.tsx';
import { ModelConfigurationModal } from '@/components/model-configuration/ModelConfigurationModal.tsx';

export interface ModelControlsProps {
  status: MlProgressMessage['stage'];
  progress: number;
  message: string;
}

const STATUS_MAP: Record<string, string> = {
  unloaded: 'bg-red-500',
  downloading: 'bg-yellow-400',
  loading: 'bg-yellow-400',
  running: 'bg-green-600',
};

// Curated default models per provider — a static placeholder until the lists are
// fetched live from each provider. One entry per submenu in the model picker.
const PROVIDER_MODELS: { provider: ModelProvider; models: readonly string[] }[] = [
  { provider: 'anthropic', models: ANTHROPIC_MODELS },
  { provider: 'openai', models: OPENAI_MODELS },
  { provider: 'webllm', models: WEBLLM_MODELS },
];

export function ModelControls({ status, progress, message }: ModelControlsProps) {
  const { activeSchema, pdfUrl } = useDrawerContext();
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [config, setConfig] = useState<ModelConfig | null>(null);
  const drawerRoot = useMemo(() => document.getElementById('tractor-beam-drawer-root'), []);

  const isRunning = status === 'running' && progress < 1;

  useEffect(() => {
    void loadModelConfig().then(setConfig);
  }, []);

  // Set the active model + the provider it belongs to. Local state updates for a
  // snappy UI; the patch persists the selection.
  function choose(provider: ModelProvider, model: string) {
    setConfig((c) => c && { ...c, selected: { provider, model } });
    void saveModelConfig({ selected: { provider, model } });
  }

  // The radio value for a provider's submenu: the active model when that provider
  // is selected, else '' (so no item shows a checkmark).
  const modelFor = (p: ModelProvider) =>
    config?.selected.provider === p ? config.selected.model : '';

  function sendRunMessage() {
    const requestId = crypto.randomUUID();
    setCurrentRequestId(requestId);
    window.TractorBeamDrawer.runAnnotationPipeline(activeSchema, requestId);
  }

  function sendCancelMessage() {
    if (!currentRequestId) return;
    window.TractorBeamDrawer.cancelAnnotationPipeline(currentRequestId);
    setCurrentRequestId(null);
  }

  return (
    <div className="border-t-2 border-[#9370DB] p-2 m-0 shadow-[0px_-4px_6px_-1px_rgba(0,0,0,0.1)]">
      <div className="flex items-center justify-between">
        <h1 className="font-semibold">AI Control Panel</h1>
        <ModelConfigurationModal container={drawerRoot} />
      </div>

      {config && (
        <div className="">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-2 outline-none">
              Highlighter:
              <span className={config.selected.model ? '' : 'text-muted-foreground'}>
                <b>{config.selected.model || 'Select model…'}</b>
              </span>
              <ChevronDown className="size-4 opacity-50" />
            </DropdownMenuTrigger>
            {/* Portal into the themed drawer root, or --popover is undefined and
                the menu renders transparent (same for each SubContent below). */}
            <DropdownMenuPortal container={drawerRoot}>
              <DropdownMenuContent align="start" className="z-[10001] w-56">
                {PROVIDER_MODELS.map(({ provider, models }) => (
                  <DropdownMenuSub key={provider}>
                    <DropdownMenuSubTrigger>
                      {ModelProviderNameMap[provider]}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal container={drawerRoot}>
                      <DropdownMenuSubContent className="z-[10002]">
                        <DropdownMenuRadioGroup
                          value={modelFor(provider)}
                          onValueChange={(m) => choose(provider, m)}
                        >
                          {models.map((m) => (
                            <DropdownMenuRadioItem key={m} value={m}>
                              {m}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                ))}
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenu>
        </div>
      )}

      <p className="mt-2">
        Status: {status}{' '}
        <span
          className={
            'inline-block w-2 h-2 rounded-full ' + (STATUS_MAP[status] || 'bg-muted-foreground')
          }
        />
      </p>

      {isRunning && (
        <div className="mt-1">
          <div className="text-xs text-muted-foreground">{message || 'Annotating...'}</div>
          <Progress value={progress * 100} className="h-2 [&>div]:bg-green-500" />
        </div>
      )}
      {status === 'loading' && (
        <div className="mt-1">
          <div className="text-xs text-muted-foreground">Loading model...</div>
          <Progress value={progress * 100} className="h-2" />
        </div>
      )}

      <div className="flex flex-row justify-between gap-1 mt-1">
        <div className="flex flex-row justify-start">
          <IconButton
            title="Highlight with AI"
            icon={Play}
            color={'green'}
            onClick={sendRunMessage}
            disabled={isRunning}
          />
          {isRunning && (
            <IconButton
              title={'Stop Annotation'}
              icon={Square}
              color={'red'}
              onClick={sendCancelMessage}
            />
          )}
          <IconButton
            title={'Load Prior Annotations'}
            icon={History}
            onClick={() =>
              void window.TractorBeamDrawer.loadCachedAnnotations(activeSchema.id, pdfUrl)
            }
          />
        </div>
        <div className="flex flex-row justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <IconButton title="More actions" icon={MoreVertical} size={'icon'} />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => void window.TractorBeamDrawer.runSegmentationPipeline()}
                >
                  <LayoutPanelLeft /> Run Segmentation Pipeline
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
