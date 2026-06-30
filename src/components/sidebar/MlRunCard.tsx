import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { MlAnnotationRun } from '@/lib/definitions.ts';
import { ModelProviderNameMap, type ModelProvider } from '@/lib/ml/model-config.ts';

export interface MlRunCardProps {
  run: MlAnnotationRun;
  /**
   * Human-readable label for the schema version (snapshot) this run was produced
   * against. Currently always undefined: doc 02 plans a run → snapshot link via a
   * `snapshotIndex` field on MlAnnotationRun, but that field doesn't exist yet.
   * When it lands, resolve the snapshot to a label and pass it here — the "Schema
   * version" row then shows it instead of the placeholder.
   */
  snapshotLabel?: string;
}

function providerLabel(provider: string): string {
  return ModelProviderNameMap[provider as ModelProvider] ?? provider;
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-mono">{value}</span>
    </div>
  );
}

/**
 * Compact summary of a single ML annotation run, sized to sit inside a dropdown
 * row: timestamp, model used, highlight count, schema version, and an expandable
 * disclosure of the run's (credential-free) model config.
 *
 * The card renders inside a DropdownMenuItem whose click loads the run, so the
 * config toggle and its panel stop event propagation — interacting with the
 * config must not load the run or close the menu.
 */
export function MlRunCard({ run, snapshotLabel }: MlRunCardProps) {
  const [showConfig, setShowConfig] = useState(false);
  const count = run.annotations.length;
  const model = run.model;
  const params = Object.entries(model?.params ?? {}).filter(
    ([, v]) => v !== undefined && v !== '',
  );
  const hasConfig = Boolean(model && (model.baseUrl || params.length > 0));

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm font-medium">{new Date(run.createdAt).toLocaleString()}</span>
      <span className="text-xs">Model: {model ? model.model : 'not recorded'}</span>
      <span className="text-xs text-muted-foreground">
        {count} highlight{count === 1 ? '' : 's'}
      </span>
      <span className="text-xs text-muted-foreground">
        Schema version: {snapshotLabel ?? 'not yet tracked'}
      </span>

      {model && hasConfig && (
        <>
          <button
            type="button"
            aria-expanded={showConfig}
            // Keep events off the enclosing DropdownMenuItem (which loads the run
            // and closes the menu) — we only want to toggle the disclosure. Radix
            // selects the item on pointerup, so that one matters most.
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setShowConfig((v) => !v);
            }}
            className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronRight
              className={`size-3 transition-transform ${showConfig ? 'rotate-90' : ''}`}
            />
            Config
          </button>
          {showConfig && (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="mt-1 flex flex-col gap-0.5 rounded bg-muted/50 p-1.5 text-xs"
            >
              <ConfigRow label="Provider" value={providerLabel(model.provider)} />
              {model.baseUrl && <ConfigRow label="Base URL" value={model.baseUrl} />}
              {params.map(([k, v]) => (
                <ConfigRow key={k} label={k} value={String(v)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}