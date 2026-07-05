/**
 * Lifecycle stage of a model loading/inference run.
 *
 * `unloaded` is the pre-run idle state; `downloading`/`loading` are local-model
 * warmup; `running` is inference in progress. The three terminal stages —
 * `done`, `error`, `cancelled` — are real end states so the UI can stop faking
 * completion as `running` at progress 1 (which left the status stuck) and can
 * render a failed or cancelled run distinctly.
 */
export type MlStage =
  | 'unloaded'
  | 'downloading'
  | 'loading'
  | 'running'
  | 'done'
  | 'error'
  | 'cancelled';

/** Callback for reporting model loading/inference progress */
export type ProgressCallback = (
  stage: MlStage,
  progress: number,
  message?: string,
  requestId?: string,
) => void;

/**
 * Canonical, provider-neutral chat-message shape shared by every runner. Lives
 * here (a primitive with no dependencies) rather than in a runner, so runners
 * never import inference vocabulary from one another. Re-exported from
 * webllm-runner for now to avoid churning the existing importers.
 *
 * Deliberately neutral: provider-specific concerns (e.g. Anthropic prompt-cache
 * breakpoints) belong inside that provider's runner when it translates these
 * messages into its SDK's native request — not on this shared contract.
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Available web-llm models (quantized, 3B+ range for NER) */
export const WEBLLM_MODELS = [
  'Qwen2.5-3B-Instruct-q4f16_1-MLC',
  'Phi-3.5-mini-instruct-q4f16_1-MLC',
] as const;

export type WebLlmModelId = (typeof WEBLLM_MODELS)[number];

export const DEFAULT_WEBLLM_MODEL: WebLlmModelId = 'Qwen2.5-3B-Instruct-q4f16_1-MLC';

/** Available Claude models (current generation, one+ per tier) */
export const CLAUDE_MODELS = [
  'claude-opus-4-8',
  'claude-opus-4-7',
  'claude-sonnet-4-6',
  'claude-haiku-4-5',
] as const;

export type ClaudeModelId = (typeof CLAUDE_MODELS)[number];

export const DEFAULT_CLAUDE_MODEL: ClaudeModelId = 'claude-sonnet-4-6';
