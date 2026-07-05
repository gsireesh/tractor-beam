/**
 * Model readiness — is the selected model actually usable *before* a run starts?
 *
 * Two layers, deliberately separated from the run-lifecycle state (`MlStage`):
 *
 *  - `describeConfigGap` is the pure, synchronous *structural* check: does the
 *    config even have the fields a run needs (a selected model, and for remote
 *    providers a key / base URL)? It never touches the network, so it's the
 *    cheap first gate and is trivially unit-testable.
 *  - A live connection probe (added in a later slice) upgrades a structurally-OK
 *    config to `ready` / `unreachable`.
 *
 * The `ModelReadiness` union is what the UI consumes to gray the run button and
 * explain *why* it's disabled.
 */
import type { ModelConfig } from './model-config';

export type ModelReadiness =
  | { state: 'unconfigured'; reason: string }
  | { state: 'verifying' }
  | { state: 'ready' }
  | { state: 'unreachable'; reason: string };

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
