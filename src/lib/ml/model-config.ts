/**
 * The aggregate model configuration.
 *
 * Composition layer: each runner owns its own provider config type; this file
 * stitches them into the single `ModelConfig` that the rest of the app reads
 * and persists. The import graph is one-directional —
 *   types.ts ← runners ← model-config.ts ← config-storage / UI
 * — so the runner↔config relationship can never form a cycle.
 */
import { type AnthropicConfig, DEFAULT_ANTHROPIC_CONFIG } from './claude-runner';
import { type OpenAiConfig, DEFAULT_OPENAI_CONFIG } from './openai-runner';
import { type WebLlmConfig, DEFAULT_WEBLLM_CONFIG } from './webllm-runner';

/** The active inference backend. */
export type ModelProvider = 'webllm' | 'anthropic' | 'openai';

/**
 * Full persisted model configuration: one settings block per provider, with
 * `provider` selecting which is active. Each block is the runner's own config
 * type, so the runner remains the single source of truth for its shape.
 */
export interface ModelConfig {
  provider: ModelProvider;
  anthropic: AnthropicConfig;
  openai: OpenAiConfig;
  webllm: WebLlmConfig;
}

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  provider: 'webllm',
  anthropic: DEFAULT_ANTHROPIC_CONFIG,
  openai: DEFAULT_OPENAI_CONFIG,
  webllm: DEFAULT_WEBLLM_CONFIG,
};
