/**
 * OpenAI-compatible provider — covers any endpoint speaking the
 * /v1/chat/completions API: Ollama (at /v1), Together, OpenRouter, OpenAI
 * proper. Replaces the old Ollama-specific runner.
 *
 * This file currently defines the provider's configuration shape; the
 * OpenAiRunner class (built on the `openai` SDK) lands in the runner step.
 */

/** Tunable generation parameters for OpenAI-compatible chat models. */
export interface OpenAiParams {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}

/**
 * OpenAI-compatible provider configuration block (composed into ModelConfig).
 * `baseUrl` is required — there is no universal default endpoint — and the
 * model list is fetched live from the endpoint's /v1/models.
 */
export interface OpenAiConfig {
  apiKey: string | null;
  baseUrl: string;
  params: OpenAiParams;
}

export const DEFAULT_OPENAI_CONFIG: OpenAiConfig = {
  apiKey: null,
  baseUrl: '',
  params: { maxTokens: 1024 },
};
