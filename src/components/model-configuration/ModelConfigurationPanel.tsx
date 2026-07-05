import { useEffect, useState } from 'react';
import {
  applyModelConfigPatch,
  loadModelConfig,
  saveModelConfig,
  type ModelConfigPatch,
} from '@/lib/config-storage';
import type { ModelConfig, ModelProvider } from '@/lib/ml/model-config';
import { ModelProviderNameMap } from '@/lib/ml/model-config';
import type { EffortLevel } from '@/lib/ml/claude-runner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Check, Loader2, TriangleAlert } from 'lucide-react';
import { verifyModelConnection } from '@/lib/ml/verify-connection';
import { describeMlError } from '@/lib/ml/errors';

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

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok' }
  | { status: 'error'; message: string };

/**
 * Explicit "Test connection" for one provider tab — the modal-only counterpart to
 * the panel's passive readiness triangle. Runs the same free `models.list()` probe
 * against the tab's provider (overriding the active selection), so a user can
 * confirm a key/URL before leaving the modal.
 */
function TestConnection({ config, provider }: { config: ModelConfig; provider: ModelProvider }) {
  const [state, setState] = useState<TestState>({ status: 'idle' });

  async function run() {
    setState({ status: 'testing' });
    const res = await verifyModelConnection(config, provider);
    setState(
      res.ok
        ? { status: 'ok' }
        : { status: 'error', message: describeMlError(res.classification ?? 'unknown', res.error) },
    );
  }

  return (
    <div className="flex items-center gap-2 pt-1">
      <Button variant="outline" size="sm" onClick={() => void run()} disabled={state.status === 'testing'}>
        {state.status === 'testing' && <Loader2 className="size-4 animate-spin" />}
        Test connection
      </Button>
      {state.status === 'ok' && (
        <span className="flex items-center gap-1 text-sm text-green-600">
          <Check className="size-4" /> Connected
        </span>
      )}
      {state.status === 'error' && (
        <span className="flex items-center gap-1 text-sm text-amber-600">
          <TriangleAlert className="size-4 shrink-0" /> {state.message}
        </span>
      )}
    </div>
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
        <TestConnection config={config} provider="anthropic" />
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
        <TestConnection config={config} provider="openai" />
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
        <TestConnection config={config} provider="webllm" />
      </TabsContent>
    </Tabs>
  );
}
