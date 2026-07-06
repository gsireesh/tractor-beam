import { useEffect, useState } from 'react';
import {
  applyModelConfigPatch,
  loadModelConfig,
  saveModelConfig,
  type ModelConfigPatch,
} from '@/lib/config-storage';
import type { ModelConfig, ModelProvider } from '@/lib/ml/model-config';
import { ModelProviderNameMap } from '@/lib/ml/model-config';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Check, Loader2, TriangleAlert } from 'lucide-react';
import { verifyModelConnection } from '@/lib/ml/verify-connection';
import { describeMlError } from '@/lib/ml/errors';

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
 * connection settings only (API key, base URL). Generation params (effort,
 * temperature, max tokens, …) are intentionally not exposed — they're
 * model-dependent, and runners use fixed defaults. The active model/provider
 * selection lives outside the modal (in ModelControls).
 *
 * Local state mirrors storage for snappy typing; every change persists the
 * matching patch through saveModelConfig (which heals + merges on write).
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
        <TestConnection config={config} provider="openai" />
      </TabsContent>

      <TabsContent value="webllm" className="flex flex-col gap-2 pt-2">
        {/* Local, in-browser model — no connection to configure. */}
        <p className="text-sm text-muted-foreground">
          Runs locally in your browser via WebGPU. No API key or endpoint to configure — the
          model downloads on first use.
        </p>
      </TabsContent>
    </Tabs>
  );
}
