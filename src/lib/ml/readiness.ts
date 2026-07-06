/**
 * Model readiness — is the selected model *structurally* usable before a run?
 *
 * This is deliberately a pure, synchronous, network-free check
 * (`describeConfigGap`): does the config have the fields a run needs (a selected
 * model, and for remote providers a key / base URL)? Reachability is NOT probed
 * eagerly — we have no reason to assume a user wants to run right now, and a
 * proxy that serves completions but not `/v1/models` shouldn't be falsely
 * blocked. Actual connectivity is proven at run time (offline pre-check +
 * circuit-breaker), or on demand via the modal's Test-connection button.
 *
 * The `ModelReadiness` union is what the UI consumes to gray the run button and
 * explain *why* it's disabled.
 */
import type { ModelConfig } from './model-config';

export type ModelReadiness =
  | { state: 'unconfigured'; reason: string }
  | { state: 'ready' };

/**
 * The structural reason the selected model can't run yet, or `null` when the
 * config is complete enough to attempt a connection. Pure and network-free:
 * this only inspects the config shape, not whether the endpoint actually answers.
 *
 * WebLLM is local — it needs a selected model but never a key or URL, so a
 * missing key is never a gap for it.
 */
export function describeConfigGap(config: ModelConfig): string | null {
  const { provider, model } = config.selected;
  if (!model) return 'Select a model to run.';

  switch (provider) {
    case 'anthropic':
      if (!config.anthropic.apiKey) {
        return 'Add an Anthropic API key in Model Configuration.';
      }
      return null;
    case 'openai':
      if (!config.openai.baseUrl) {
        return 'Set an OpenAI-compatible base URL in Model Configuration.';
      }
      return null;
    case 'webllm':
      return null;
    default:
      return null;
  }
}
