import { useEffect, useMemo, useState } from 'react';
import { MlProgressMessage } from '@/lib/messaging/message_definitions.ts';
import type { Highlight, MlRunScope, OutlineEntry } from '@/lib/definitions.ts';
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
import { Input } from '@/components/ui/input.tsx';
import { loadModelConfig, saveModelConfig, subscribeModelConfig } from '@/lib/config-storage.ts';
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
import {
  useModelReadiness,
  ModelReadinessIndicator,
} from '@/components/model-configuration/ModelReadiness.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import { mlAnnotationRunRepo, schemaRepo } from '@/storage/repositories.ts';
import { MlRunCard } from '@/components/sidebar/MlRunCard.tsx';
import { ScopeSectionTree } from '@/components/sidebar/ScopeSectionTree.tsx';
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

// The pdf.js viewer lives in the same page as the drawer. drawer-host.ts declares
// window.PDFViewerApplication only as { pdfDocument }, so narrow to the fields we
// read for scoping (current page + page count) here.
function readViewer(): { page?: number; pdfDocument?: { numPages?: number } } | undefined {
  return window.PDFViewerApplication as
    | { page?: number; pdfDocument?: { numPages?: number } }
    | undefined;
}
const currentViewerPage = () => readViewer()?.page ?? 1;
const viewerPageCount = () => readViewer()?.pdfDocument?.numPages ?? 1;

export function ModelControls({ status, progress, message, setMlHighlights }: ModelControlsProps) {
  const { activeSchema, pdfUrl } = useDrawerContext();
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [config, setConfig] = useState<ModelConfig | null>(null);
  // Prior ML runs for this schema+PDF, fetched lazily when the history menu opens.
  const [runs, setRuns] = useState<MlAnnotationRun[]>([]);
  // snapshotIndex → version label, to derive each run's schema-version name.
  const [versionLabels, setVersionLabels] = useState<Map<number, string>>(new Map());
  const [runsLoaded, setRunsLoaded] = useState(false);
  // PDF outline, fetched lazily when the scope menu first opens. null = not loaded
  // yet; [] = loaded and this PDF has no table of contents.
  const [outline, setOutline] = useState<OutlineEntry[] | null>(null);
  // Current 1-based viewer page for the "this page" label. Refreshed on menu open
  // (not via a scroll subscription): the menu is modal, so the PDF can't scroll
  // while it's shown, and pdf.js page changes otherwise don't re-render React.
  const [currentPage, setCurrentPage] = useState(currentViewerPage);
  // Scope menu is controlled so a per-row run button can close it explicitly (the
  // rows are plain divs, not auto-closing DropdownMenuItems).
  const [scopeMenuOpen, setScopeMenuOpen] = useState(false);
  // Page-range inputs (strings so partial edits don't fight React).
  const [rangeFrom, setRangeFrom] = useState('1');
  const [rangeTo, setRangeTo] = useState('1');
  const drawerRoot = useMemo(() => document.getElementById('tractor-beam-drawer-root'), []);

  const isRunning = status === 'running' && progress < 1;

  // Gate the run trigger on readiness: a run can't start unless the selected
  // model is actually usable. The reason (when not ready) is surfaced both on
  // the disabled button (tooltip) and beside the model name (warning triangle).
  const readiness = useModelReadiness(config);
  const runDisabled = isRunning || readiness.state !== 'ready';
  const runDisabledReason =
    readiness.state === 'unconfigured' || readiness.state === 'unreachable'
      ? readiness.reason
      : undefined;

  // Load the config once, then stay subscribed: readiness must react to edits
  // made in the config modal (e.g. clearing the API key), which writes storage
  // but doesn't share this component's local state.
  useEffect(() => {
    void loadModelConfig().then(setConfig);
    return subscribeModelConfig(setConfig);
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

  async function sendRunMessage() {
    const requestId = crypto.randomUUID();
    setCurrentRequestId(requestId);
    // Snapshot the schema this run is based on (doc 02 mlRun version) and reference
    // it from the run by snapshotIndex — the version's label is derived from that
    // snapshot, never copied. Snapshotting is a persistence concern → repo seam.
    const snapshotIndex = await schemaRepo.snapshot(activeSchema, 'mlRun');
    // Whole-document run: no scope (3rd arg), snapshotIndex is the 4th arg.
    void window.TractorBeamDrawer.runAnnotationPipeline(
      activeSchema,
      requestId,
      undefined,
      snapshotIndex,
    );
  }

  function sendCancelMessage() {
    if (!currentRequestId) return;
    window.TractorBeamDrawer.cancelAnnotationPipeline(currentRequestId);
    setCurrentRequestId(null);
  }

  // The scoped twin of sendRunMessage: same run dispatch, plus a scope descriptor
  // that drawer-host uses to filter blocks and to tag the stored run.
  async function runScoped(scope: MlRunScope) {
    const requestId = crypto.randomUUID();
    setCurrentRequestId(requestId);
    // Scoped runs are still mlRuns: snapshot the schema version they ran against,
    // exactly as the whole-document run does (sendRunMessage).
    const snapshotIndex = await schemaRepo.snapshot(activeSchema, 'mlRun');
    void window.TractorBeamDrawer.runAnnotationPipeline(
      activeSchema,
      requestId,
      scope,
      snapshotIndex,
    );
  }

  // Fetch the outline once, the first time the scope menu opens (same lazy pattern
  // as refreshRuns). On failure treat the PDF as having no TOC rather than retrying.
  async function loadOutline() {
    if (outline !== null) return;
    try {
      const entries = await window.TractorBeamPdf.extractOutline(window.PDFViewerApplication);
      setOutline(entries);
    } catch (err) {
      console.warn('[model-controls] Failed to read PDF outline:', err);
      setOutline([]);
    }
  }

  // Each run handler closes the scope menu itself (the rows are plain divs, so they
  // don't auto-close like DropdownMenuItems would).
  function runThisPage() {
    const n = currentViewerPage();
    void runScoped({ kind: 'page', pages: [n], label: `Page ${n}` });
    setScopeMenuOpen(false);
  }

  function submitRange() {
    const total = viewerPageCount();
    const clamp = (v: string) => Math.min(Math.max(1, Math.trunc(Number(v))), total);
    const a = clamp(rangeFrom);
    const b = clamp(rangeTo);
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    const pages = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
    const label = lo === hi ? `Page ${lo}` : `Pages ${lo}–${hi}`;
    void runScoped({ kind: 'range', pages, label });
    setScopeMenuOpen(false);
  }

  // One run over the union of the sections checked in the tree; `pages` is the exact
  // (possibly non-contiguous) set the section picker computed.
  function runSections(pages: number[], label: string) {
    if (pages.length === 0) return;
    void runScoped({ kind: 'toc', pages, label });
    setScopeMenuOpen(false);
  }

  // Range is valid only when both inputs are whole pages within bounds. `from > to`
  // is tolerated (submitRange swaps them), so it isn't a validity failure.
  const pageTotal = viewerPageCount();
  const rangeValid = (() => {
    const a = Number(rangeFrom);
    const b = Number(rangeTo);
    return (
      Number.isInteger(a) &&
      Number.isInteger(b) &&
      a >= 1 &&
      b >= 1 &&
      a <= pageTotal &&
      b <= pageTotal
    );
  })();

  // Refetch the run archive each time the history menu opens, newest first, so the
  // list reflects runs completed since it was last viewed. We show a brief loading
  // state by clearing runsLoaded up front.
  async function refreshRuns() {
    setRunsLoaded(false);
    // Runs + the schema's versions: the latter lets us derive each run's version
    // label from its snapshotIndex (doc 02: run references the snapshot, label is
    // derived — never copied onto the run).
    const [all, versions] = await Promise.all([
      mlAnnotationRunRepo.findBy(activeSchema.id, pdfUrl),
      schemaRepo.listVersions(activeSchema.id),
    ]);
    const labels = new Map<number, string>();
    for (const v of versions) if (v.label) labels.set(v.snapshotIndex, v.label);
    setRuns([...all].sort((a, b) => b.createdAt - a.createdAt));
    setVersionLabels(labels);
    setRunsLoaded(true);
  }

  // The scoped run split button (primary "Highlight with AI" + a caret opening the
  // page/range/section scope menu). Built once as an element so the readiness gate
  // in the return can render it either bare or wrapped in an explain-why tooltip
  // without duplicating the tree — and without the remount a wrapper *component*
  // would cause. Every run affordance here (primary action, caret, and each in-menu
  // run button) is gated by the same `runDisabled`.
  const runControls = (
    <div className="flex flex-row items-center">
      <IconButton
        title="Highlight with AI"
        label="Highlight with AI"
        variant="default"
        className="rounded-r-none"
        icon={Highlighter}
        color={null}
        onClick={sendRunMessage}
        disabled={runDisabled}
      />
      <DropdownMenu
        open={scopeMenuOpen}
        onOpenChange={(open) => {
          setScopeMenuOpen(open);
          if (open) {
            const p = String(currentViewerPage());
            setCurrentPage(currentViewerPage());
            setRangeFrom(p);
            setRangeTo(p);
            void loadOutline();
          }
        }}
      >
        <DropdownMenuTrigger disabled={runDisabled}>
          <IconButton
            title="Highlight options"
            variant="default"
            className="rounded-l-none border-l border-primary-foreground/30"
            icon={ChevronDown}
            color={null}
            size={'icon-sm'}
            disabled={runDisabled}
          />
        </DropdownMenuTrigger>
        <DropdownMenuPortal container={drawerRoot}>
          {/* Rows are plain divs, not DropdownMenuItems: each Highlighter button
              drives its own run (no whole-row click), and the range inputs accept
              typing without the menu's item typeahead/close-on-select firing. */}
          <DropdownMenuContent align="start" className="z-[10001] w-64">
            {/* This page */}
            <div className="flex items-center justify-between gap-2 px-2 py-1.5">
              <span className="text-sm">This page ({currentPage})</span>
              <IconButton
                title={`Highlight page ${currentPage}`}
                variant="default"
                icon={Highlighter}
                color={null}
                size={'icon-sm'}
                disabled={runDisabled}
                onClick={runThisPage}
              />
            </div>

            {/* Page range — inputs inline under the label; run stays disabled
                until both ends are valid pages. */}
            <div className="px-2 py-1.5">
              <span className="text-sm">Page range</span>
              <div className="mt-1.5 flex items-center gap-1.5">
                <Input
                  aria-label="From page"
                  type="number"
                  min={1}
                  max={pageTotal}
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  aria-invalid={!rangeValid}
                  className="h-7 w-14 px-2 text-sm"
                />
                <span className="text-sm text-muted-foreground">–</span>
                <Input
                  aria-label="To page"
                  type="number"
                  min={1}
                  max={pageTotal}
                  value={rangeTo}
                  onChange={(e) => setRangeTo(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  aria-invalid={!rangeValid}
                  className="h-7 w-14 px-2 text-sm"
                />
                <IconButton
                  title="Highlight page range"
                  variant="default"
                  className="ml-auto"
                  icon={Highlighter}
                  color={null}
                  size={'icon-sm'}
                  disabled={!rangeValid || runDisabled}
                  onClick={submitRange}
                />
              </div>
            </div>

            <ScopeSectionTree
              outline={outline}
              pageCount={pageTotal}
              disabled={runDisabled}
              onAnnotate={runSections}
            />
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenu>
    </div>
  );

  return (
    <div className="flex flex-col gap-2 border-t-2 border-[#9370DB] p-2 m-0 shadow-[0px_-4px_6px_-1px_rgba(0,0,0,0.1)]">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-semibold">AI Control Panel</h1>
        <ModelConfigurationModal container={drawerRoot} />
      </div>

      {config && (
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 text-sm outline-none">
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
          <ModelReadinessIndicator readiness={readiness} container={drawerRoot} />
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
          {/* Split button: the panel's one primary action, so it wears the filled
              `default` (brand purple) tier while every sibling stays quiet outline.
              The pair sits in its own gap-0 group so the row's gap-1 still spaces the
              History/Hide buttons; inner corners are flattened and the caret carries a
              hairline `border-primary-foreground/30` divider (same seam as the popover's
              "Add example" split button).

              When the selected model can't run, the whole split button is disabled and
              a tooltip — hung off a wrapping span, since disabled controls emit no
              pointer events — explains why. */}
          {runDisabledReason ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="flex flex-row items-center">
                  {runControls}
                </span>
              </TooltipTrigger>
              <TooltipContent container={drawerRoot} className="z-[10002]">
                {runDisabledReason}
              </TooltipContent>
            </Tooltip>
          ) : (
            runControls
          )}
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
              <DropdownMenuContent
                align="start"
                className="z-[10001] w-72 max-h-80 overflow-y-auto"
              >
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
                      <MlRunCard
                        run={run}
                        schemaVersion={
                          run.snapshotIndex !== undefined
                            ? versionLabels.get(run.snapshotIndex)
                            : undefined
                        }
                      />
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
