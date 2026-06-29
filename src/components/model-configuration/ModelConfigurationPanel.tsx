import { useEffect, useState } from 'react';
import {
  applyModelConfigPatch,
  loadModelConfig,
  saveModelConfig,
  type ModelConfigPatch,
} from '@/lib/config-storage';
import type { ModelConfig } from '@/lib/ml/model-config';
import { ModelProviderNameMap } from '@/lib/ml/model-config';
import type { EffortLevel } from '@/lib/ml/claude-runner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const EFFORT_LEVELS: EffortLevel[] = ['low', 'medium', 'high', 'xhigh', 'max'];

/** A labelled form row — label on the left, control on the right. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="w-48">{children}</div>
    </label>
  );
}

/**
 * The model-configuration form: a tab per provider, each holding that provider's
 * connection settings (API key, base URL) and tunable params. The active
 * model/provider selection lives outside the modal (in ModelControls) — this
 * panel only configures the connection blocks.
 *
 * Local state mirrors storage for snappy typing; every change persists the
 * matching patch through saveModelConfig (which heals + merges on write). Numeric
 * params parse to undefined when blank so clearing a field falls back to defaults.
 */
export function ModelConfigurationPanel() {
  const [config, setConfig] = useState<ModelConfig | null>(null);

  useEffect(() => {
    void loadModelConfig().then(setConfig);
  }, []);

  if (!config) {
    return <div className="p-2 text-sm text-muted-foreground">Loading…</div>;
  }

  // Apply a patch to both local state (immediate) and storage (persisted). One
  // merge implementation, shared with the write path.
  const update = (patch: ModelConfigPatch) => {
    setConfig((prev) => (prev ? applyModelConfigPatch(prev, patch) : prev));
    void saveModelConfig(patch);
  };

  const num = (v: string): number | undefined => (v === '' ? undefined : Number(v));

  // Open on the provider the user is actually running.
  return (
    <Tabs defaultValue={config.selected.provider}>
      <TabsList className="w-full">
        <TabsTrigger value="anthropic">{ModelProviderNameMap.anthropic}</TabsTrigger>
        <TabsTrigger value="openai">{ModelProviderNameMap.openai}</TabsTrigger>
        <TabsTrigger value="webllm">{ModelProviderNameMap.webllm}</TabsTrigger>
      </TabsList>

      <TabsContent value="anthropic" className="flex flex-col gap-2 pt-2">
        <Field label="API key">
          <Input
            type="password"
            placeholder="sk-ant-…"
            value={config.anthropic.apiKey ?? ''}
            onChange={(e) => update({ anthropic: { apiKey: e.target.value || null } })}
          />
        </Field>
        <Field label="Base URL">
          <Input
            type="text"
            value={config.anthropic.baseUrl}
            onChange={(e) => update({ anthropic: { baseUrl: e.target.value } })}
          />
        </Field>
        <Field label="Effort">
          <select
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={config.anthropic.params.effort ?? ''}
            onChange={(e) =>
              update({
                anthropic: { params: { effort: (e.target.value || undefined) as EffortLevel } },
              })
            }
          >
            <option value="">default</option>
            {EFFORT_LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Max tokens">
          <Input
            type="number"
            value={config.anthropic.params.maxTokens ?? ''}
            onChange={(e) => update({ anthropic: { params: { maxTokens: num(e.target.value) } } })}
          />
        </Field>
      </TabsContent>

      <TabsContent value="openai" className="flex flex-col gap-2 pt-2">
        <Field label="API key">
          <Input
            type="password"
            placeholder="optional for local endpoints"
            value={config.openai.apiKey ?? ''}
            onChange={(e) => update({ openai: { apiKey: e.target.value || null } })}
          />
        </Field>
        <Field label="Base URL">
          <Input
            type="text"
            placeholder="http://localhost:11434/v1"
            value={config.openai.baseUrl}
            onChange={(e) => update({ openai: { baseUrl: e.target.value } })}
          />
        </Field>
        <Field label="Temperature">
          <Input
            type="number"
            value={config.openai.params.temperature ?? ''}
            onChange={(e) => update({ openai: { params: { temperature: num(e.target.value) } } })}
          />
        </Field>
        <Field label="Top P">
          <Input
            type="number"
            value={config.openai.params.topP ?? ''}
            onChange={(e) => update({ openai: { params: { topP: num(e.target.value) } } })}
          />
        </Field>
        <Field label="Max tokens">
          <Input
            type="number"
            value={config.openai.params.maxTokens ?? ''}
            onChange={(e) => update({ openai: { params: { maxTokens: num(e.target.value) } } })}
          />
        </Field>
      </TabsContent>

      <TabsContent value="webllm" className="flex flex-col gap-2 pt-2">
        <Field label="Temperature">
          <Input
            type="number"
            value={config.webllm.params.temperature ?? ''}
            onChange={(e) => update({ webllm: { params: { temperature: num(e.target.value) } } })}
          />
        </Field>
        <Field label="Max tokens">
          <Input
            type="number"
            value={config.webllm.params.maxTokens ?? ''}
            onChange={(e) => update({ webllm: { params: { maxTokens: num(e.target.value) } } })}
          />
        </Field>
      </TabsContent>
    </Tabs>
  );
}
