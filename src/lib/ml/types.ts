/** Lifecycle stage of a model loading/inference run. */
export type MlStage = 'unloaded' | 'downloading' | 'loading' | 'running';

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

/** Model provider types */
export type ModelProvider = 'webllm' | 'claude' | 'ollama';

/** Available Claude models (current generation, one+ per tier) */
export const CLAUDE_MODELS = [
  'claude-opus-4-8',
  'claude-opus-4-7',
  'claude-sonnet-4-6',
  'claude-haiku-4-5',
] as const;

export type ClaudeModelId = (typeof CLAUDE_MODELS)[number];

export const DEFAULT_CLAUDE_MODEL: ClaudeModelId = 'claude-sonnet-4-6';

/** Available Ollama models */
export const OLLAMA_MODELS = ['llama3.2', 'qwen3.5:4b', 'qwen3.5:0.8b'];

export type OllamaModelId = (typeof OLLAMA_MODELS)[number];

export const DEFAULT_OLLAMA_MODEL: OllamaModelId = 'qwen3.5:4b';

export const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';

/** Persisted model configuration */
export interface ModelConfig {
  provider: ModelProvider;
  webllmModel: WebLlmModelId;
  claudeModel: ClaudeModelId;
  ollamaModel: OllamaModelId;
}

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  provider: 'claude',
  webllmModel: DEFAULT_WEBLLM_MODEL,
  claudeModel: DEFAULT_CLAUDE_MODEL,
  ollamaModel: DEFAULT_OLLAMA_MODEL,
};

// MODEL_CONFIG_KEY moved to config-storage.ts — it's a storage detail, not part
// of the config shape. The legacy ModelConfig/DEFAULT_MODEL_CONFIG above remain
// until their consumers move to the per-provider config in model-config.ts.
