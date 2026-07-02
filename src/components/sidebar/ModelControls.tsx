import { useEffect, useMemo, useState } from 'react';
import { MlProgressMessage } from '@/lib/messaging/message_definitions.ts';
import type { Highlight } from '@/lib/definitions.ts';
import { Progress } from '@/components/ui/progress.tsx';
import {
  ChevronDown,
  EyeOff,
  Highlighter,
  History,
  LayoutPanelLeft,
  MoreVertical,
  Square,
} from 'lucide-react';
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
import { mlAnnotationRunRepo, schemaRepo } from '@/storage/repositories.ts';
import { MlRunCard } from '@/components/sidebar/MlRunCard.tsx';
import type { MlAnnotationRun } from '@/lib/definitions.ts';

export interface ModelControlsProps {
  status: MlProgressMessage['stage'];
  setMlHighlights: (highlights: Highlight[]) => void;
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

export function ModelControls({ status, progress, message, setMlHighlights }: ModelControlsProps) {
  const { activeSchema, pdfUrl } = useDrawerContext();
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [config, setConfig] = useState<ModelConfig | null>(null);
  // Prior ML runs for this schema+PDF, fetched lazily when the history menu opens.
  const [runs, setRuns] = useState<MlAnnotationRun[]>([]);
  const [runsLoaded, setRunsLoaded] = useState(false);
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
    // Snapshot the schema this run is based on (doc 02's mlRun version), mirroring
    // the snapshot taken before an export. A persistence concern, not a
    // SchemaAction, so it goes through the repo seam.
    void schemaRepo.snapshot(activeSchema, 'mlRun');
    void window.TractorBeamDrawer.runAnnotationPipeline(activeSchema, requestId);
  }

  function sendCancelMessage() {
    if (!currentRequestId) return;
    window.TractorBeamDrawer.cancelAnnotationPipeline(currentRequestId);
    setCurrentRequestId(null);
  }

  // Refetch the run archive each time the history menu opens, newest first, so the
  // list reflects runs completed since it was last viewed. We show a brief loading
  // state by clearing runsLoaded up front.
  async function refreshRuns() {
    setRunsLoaded(false);
    const all = await mlAnnotationRunRepo.findBy(activeSchema.id, pdfUrl);
    // TEMP diagnostic: are the returned runs actually scoped to this schema+PDF?
    console.log('[history] query', { schemaId: activeSchema.id, pdfUrl });
    console.table(
      all.map((r) => ({
        id: r.id,
        createdAt: new Date(r.createdAt).toLocaleString(),
        count: r.annotations.length,
        schemaId: r.schemaId,
        pdfUrl: r.pdfUrl,
      })),
    );
    setRuns(all.sort((a, b) => b.createdAt - a.createdAt));
    setRunsLoaded(true);
  }

  return (
    <div className="flex flex-col gap-2 border-t-2 border-[#9370DB] p-2 m-0 shadow-[0px_-4px_6px_-1px_rgba(0,0,0,0.1)]">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-semibold">AI Control Panel</h1>
        <ModelConfigurationModal container={drawerRoot} />
      </div>

      {config && (
        <div className="">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-2 text-sm outline-none">
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

      <p className="text-sm">
        Status: {status}{' '}
        <span
          className={
            'inline-block w-2 h-2 rounded-full ' + (STATUS_MAP[status] || 'bg-muted-foreground')
          }
        />
      </p>

      {isRunning && (
        <div className="flex flex-col gap-1">
          <div className="text-sm text-muted-foreground">{message || 'Annotating...'}</div>
          <Progress value={progress * 100} className="h-2 [&>div]:bg-green-500" />
        </div>
      )}
      {status === 'loading' && (
        <div className="flex flex-col gap-1">
          <div className="text-sm text-muted-foreground">Loading model...</div>
          <Progress value={progress * 100} className="h-2" />
        </div>
      )}

      <div className="flex flex-row justify-between gap-1">
        <div className="flex flex-row items-center justify-start gap-1">
          <IconButton
            title="Highlight with AI"
            label="Highlight with AI"
            variant="outline"
            className="border-[green]"
            icon={Highlighter}
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
          <DropdownMenu
            onOpenChange={(open) => {
              if (open) void refreshRuns();
            }}
          >
            <DropdownMenuTrigger>
              <IconButton title={'Prior AI runs'} icon={History} />
            </DropdownMenuTrigger>
            <DropdownMenuPortal container={drawerRoot}>
              <DropdownMenuContent align="start" className="z-[10001] w-72 max-h-80 overflow-y-auto">
                {!runsLoaded ? (
                  <DropdownMenuItem disabled>Loading…</DropdownMenuItem>
                ) : runs.length === 0 ? (
                  <DropdownMenuItem disabled>No prior AI runs</DropdownMenuItem>
                ) : (
                  runs.map((run) => (
                    <DropdownMenuItem
                      key={run.id}
                      onClick={() =>
                        void window.TractorBeamDrawer.loadCachedAnnotations(
                          activeSchema.id,
                          pdfUrl,
                          run.id,
                        )
                      }
                    >
                      <MlRunCard run={run} />
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenu>
          <IconButton
            title={'Hide AI Highlights'}
            icon={EyeOff}
            onClick={() => {
              setMlHighlights([]);
            }}
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
                  <LayoutPanelLeft /> View Page Segmentation
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
