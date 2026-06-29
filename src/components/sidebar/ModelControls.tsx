import { useState, useEffect, useMemo } from 'react';
import { MlProgressMessage } from '@/lib/messaging/message_definitions.ts';

import { Progress } from '@/components/ui/progress.tsx';
import {
  LayoutPanelLeft,
  Play,
  Settings,
  Square,
  Save,
  History,
  Highlighter,
  MoreVertical,
  ChevronDown,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu.tsx';
import {
  WEBLLM_MODELS,
  CLAUDE_MODELS,
  OLLAMA_MODELS,
  type ModelProvider,
  type ModelConfig,
} from '@/lib/ml/types.ts';
import { DEFAULT_OLLAMA_BASE_URL } from '@/lib/ml/types.ts';
import {
  getModelConfig,
  setModelConfig,
  getClaudeApiKey,
  setClaudeApiKey,
  getOllamaBaseUrl,
  setOllamaBaseUrl,
} from '@/lib/config-storage.ts';
import { useDrawerContext } from '@/contexts/DrawerContext.tsx';
import { IconButton } from '@/components/ui/IconButton.tsx';
import { ModelConfigurationModal } from '@/components/model-configuration/ModelConfigurationModal.tsx';
import { ModelProviderNameMap } from '@/lib/ml/model-config.ts';
import { DropdownMenuGroup } from '@/components/ui/dropdown-menu';

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

export function ModelControls({ status, progress, message }: ModelControlsProps) {
  const { activeSchema, pdfUrl } = useDrawerContext();
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [config, setLocalConfig] = useState<Partial<ModelConfig>>({});
  const [apiKey, setApiKey] = useState('');
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [ollamaUrl, setOllamaUrl] = useState(DEFAULT_OLLAMA_BASE_URL);
  const [ollamaUrlSaved, setOllamaUrlSaved] = useState(false);
  const drawerRoot = useMemo(() => document.getElementById('tractor-beam-drawer-root'), []);

  const isRunning = status === 'running' && progress < 1;

  useEffect(() => {
    Promise.all([getModelConfig(), getClaudeApiKey(), getOllamaBaseUrl()]).then(
      ([cfg, key, url]) => {
        setLocalConfig(cfg);
        if (key) setApiKey(key);
        if (url) setOllamaUrl(url);
      },
    );
  }, []);

  function updateConfig(partial: Partial<ModelConfig>) {
    setLocalConfig((prev) => ({ ...prev, ...partial }));
    void setModelConfig(partial);
  }

  async function saveApiKey() {
    await setClaudeApiKey(apiKey);
    setApiKeySaved(true);
    setTimeout(() => setApiKeySaved(false), 2000);
  }

  async function saveOllamaUrl() {
    await setOllamaBaseUrl(ollamaUrl);
    setOllamaUrlSaved(true);
    setTimeout(() => setOllamaUrlSaved(false), 2000);
  }

  function sendRunMessage() {
    const requestId = crypto.randomUUID();
    setCurrentRequestId(requestId);
    console.log('[ModelControls] triggering annotation pipeline!');
    window.TractorBeamDrawer.runAnnotationPipeline(activeSchema, requestId);
  }

  function sendCancelMessage() {
    if (!currentRequestId) return;
    console.log('[ModelControls] cancelling annotation pipeline!');
    window.TractorBeamDrawer.cancelAnnotationPipeline(currentRequestId);
    setCurrentRequestId(null);
  }

  const currentModel =
    config.provider === 'claude'
      ? config.claudeModel
      : config.provider === 'ollama'
        ? config.ollamaModel
        : config.webllmModel;

  return (
    <div className="border-t-2 border-[#9370DB] p-2 m-0 shadow-[0px_-4px_6px_-1px_rgba(0,0,0,0.1)]">
      <div className="flex items-center justify-between">
        <h1 className="font-semibold">Model Control Panel</h1>
        <ModelConfigurationModal container={drawerRoot} />
        {/*<DropdownMenu>*/}
        {/*  <DropdownMenuTrigger>*/}
        {/*    <IconButton icon={Settings} title="Model Settings" />*/}
        {/*  </DropdownMenuTrigger>*/}
        {/*  <DropdownMenuContent align="end" className="w-64 z-[10001]">*/}
        {/*    <DropdownMenuLabel>Provider</DropdownMenuLabel>*/}
        {/*    <DropdownMenuRadioGroup*/}
        {/*      value={config.provider ?? 'webllm'}*/}
        {/*      onValueChange={(v) => updateConfig({ provider: v as ModelProvider })}*/}
        {/*    >*/}
        {/*      <DropdownMenuRadioItem value="webllm">WebLLM (local)</DropdownMenuRadioItem>*/}
        {/*      <DropdownMenuRadioItem value="claude">Claude API</DropdownMenuRadioItem>*/}
        {/*      <DropdownMenuRadioItem value="ollama">Ollama (local)</DropdownMenuRadioItem>*/}
        {/*    </DropdownMenuRadioGroup>*/}
        {/*    <DropdownMenuSeparator />*/}
        {/*    <DropdownMenuLabel>Model</DropdownMenuLabel>*/}
        {/*    <DropdownMenuSub>*/}
        {/*      <DropdownMenuSubTrigger>{currentModel ?? 'Select model...'}</DropdownMenuSubTrigger>*/}
        {/*      /!* Portal into the themed drawer root: without a container Radix*/}
        {/*          portals to document.body, outside #tractor-beam-drawer-root's*/}
        {/*          .tractor-beam-themed scope, so --popover is undefined and the*/}
        {/*          submenu renders transparent. *!/*/}
        {/*      <DropdownMenuPortal container={document.getElementById('tractor-beam-drawer-root')}>*/}
        {/*        <DropdownMenuSubContent className="z-[10002]">*/}
        {/*          {config.provider === 'claude' ? (*/}
        {/*            <DropdownMenuRadioGroup*/}
        {/*              value={config.claudeModel ?? ''}*/}
        {/*              onValueChange={(v) =>*/}
        {/*                updateConfig({ claudeModel: v as (typeof CLAUDE_MODELS)[number] })*/}
        {/*              }*/}
        {/*            >*/}
        {/*              {CLAUDE_MODELS.map((m) => (*/}
        {/*                <DropdownMenuRadioItem key={m} value={m}>*/}
        {/*                  {m}*/}
        {/*                </DropdownMenuRadioItem>*/}
        {/*              ))}*/}
        {/*            </DropdownMenuRadioGroup>*/}
        {/*          ) : config.provider === 'ollama' ? (*/}
        {/*            <DropdownMenuRadioGroup*/}
        {/*              value={config.ollamaModel ?? ''}*/}
        {/*              onValueChange={(v) => updateConfig({ ollamaModel: v })}*/}
        {/*            >*/}
        {/*              {OLLAMA_MODELS.map((m) => (*/}
        {/*                <DropdownMenuRadioItem key={m} value={m}>*/}
        {/*                  {m}*/}
        {/*                </DropdownMenuRadioItem>*/}
        {/*              ))}*/}
        {/*            </DropdownMenuRadioGroup>*/}
        {/*          ) : (*/}
        {/*            <DropdownMenuRadioGroup*/}
        {/*              value={config.webllmModel ?? ''}*/}
        {/*              onValueChange={(v) =>*/}
        {/*                updateConfig({ webllmModel: v as (typeof WEBLLM_MODELS)[number] })*/}
        {/*              }*/}
        {/*            >*/}
        {/*              {WEBLLM_MODELS.map((m) => (*/}
        {/*                <DropdownMenuRadioItem key={m} value={m}>*/}
        {/*                  {m}*/}
        {/*                </DropdownMenuRadioItem>*/}
        {/*              ))}*/}
        {/*            </DropdownMenuRadioGroup>*/}
        {/*          )}*/}
        {/*        </DropdownMenuSubContent>*/}
        {/*      </DropdownMenuPortal>*/}
        {/*    </DropdownMenuSub>*/}
        {/*  </DropdownMenuContent>*/}
        {/*</DropdownMenu>*/}
      </div>
      <div>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-60 items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[placeholder]:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50">
            {currentModel ?? <span className="text-muted-foreground">Select model…</span>}
            <ChevronDown className="size-4 opacity-50" />
          </DropdownMenuTrigger>
          <DropdownMenuPortal container={document.getElementById('tractor-beam-drawer-root')}>
            <DropdownMenuContent className="z-[10001]">
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <DropdownMenuItem>Test 2</DropdownMenuItem>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuGroup>
                        <DropdownMenuRadioGroup>
                          <DropdownMenuRadioItem value={'test'}>
                            <p>Test 2</p>
                          </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenu>
        <p>
          Status: {status}{' '}
          <span
            className={
              'inline-block w-2 h-2 rounded-full ' + (STATUS_MAP[status] || 'bg-muted-foreground')
            }
          />
        </p>
      </div>
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
      <div className="flex flex-row justify-between flex gap-1 mt-1">
        <div className="flex flex-row justify-start">
          <div>
            <IconButton
              title="Start Annotation Pipeline"
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
              onClick={() => {
                console.log('[ModelControls] Loading cached annotations');
                void window.TractorBeamDrawer.loadCachedAnnotations(activeSchema.id, pdfUrl);
              }}
            />
          </div>
        </div>
        <div className={'flex flex-row justify-end'}>
          <DropdownMenu>
            <DropdownMenuTrigger>
              <IconButton title="More actions" icon={MoreVertical} size={'icon'} />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => {
                    console.log('[drawer] Running segmentation pipeline!');
                    void window.TractorBeamDrawer.runSegmentationPipeline();
                  }}
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
