/**
 * The aggregate model configuration.
 *
 * Composition layer: each runner owns its own provider config type; this file
 * stitches them into the single `ModelConfig` that the rest of the app reads
 * and persists. The import graph is one-directional —
 *   types.ts ← runners ← model-config.ts ← config-storage / UI
 * — so the runner↔config relationship can never form a cycle.
 */
import {
  type AnthropicConfig,
  DEFAULT_ANTHROPIC_CONFIG,
  DEFAULT_ANTHROPIC_MODEL,
} from './claude-runner';
import { type OpenAiConfig, DEFAULT_OPENAI_CONFIG } from './openai-runner';
import { type WebLlmConfig, DEFAULT_WEBLLM_CONFIG } from './webllm-runner';

/** The active inference backend. */
export type ModelProvider = 'webllm' | 'anthropic' | 'openai';

export const ModelProviderNameMap: Record<ModelProvider, string> = {
  webllm: 'Local (webLLM)',
  anthropic: 'Anthropic Compatible',
  openai: 'OpenAI Compatible',
};

/**
 * A model-first selection: the active model and the provider it belongs to.
 * Chosen outside the modal (which only configures provider connections), and
 * designed to be overridable per-document later.
 */
export interface ModelSelection {
  provider: ModelProvider;
  model: string;
}

/**
 * Full persisted model configuration. The three provider blocks hold connection
 * settings + params (configured in the modal); `selected` is the active
 * model-first choice (set outside the modal). Each block is the runner's own
 * config type, so the runner stays the single source of truth for its shape.
 */
export interface ModelConfig {
  anthropic: AnthropicConfig;
  openai: OpenAiConfig;
  webllm: WebLlmConfig;
  selected: ModelSelection;
}

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  anthropic: DEFAULT_ANTHROPIC_CONFIG,
  openai: DEFAULT_OPENAI_CONFIG,
  webllm: DEFAULT_WEBLLM_CONFIG,
  selected: { provider: 'anthropic', model: DEFAULT_ANTHROPIC_MODEL },
};
