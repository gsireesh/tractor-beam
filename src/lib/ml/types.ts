/** Callback for reporting model loading/inference progress */
export type ProgressCallback = (
  stage: string,
  progress: number,
  message?: string,
  requestId?: string,
) => void;

/** Available web-llm models (quantized, 3B+ range for NER) */
export const WEBLLM_MODELS = [
  'Qwen2.5-3B-Instruct-q4f16_1-MLC',
  'Phi-3.5-mini-instruct-q4f16_1-MLC',
] as const;

export type WebLlmModelId = (typeof WEBLLM_MODELS)[number];

export const DEFAULT_WEBLLM_MODEL: WebLlmModelId = 'Qwen2.5-3B-Instruct-q4f16_1-MLC';

/** Model provider types */
export type ModelProvider = 'webllm' | 'claude';

/** Available Claude models */
export const CLAUDE_MODELS = [
  'claude-sonnet-4-20250514',
  'claude-haiku-4-5-20251001',
] as const;

export type ClaudeModelId = (typeof CLAUDE_MODELS)[number];

export const DEFAULT_CLAUDE_MODEL: ClaudeModelId = 'claude-sonnet-4-20250514';

/** Persisted model configuration */
export interface ModelConfig {
  provider: ModelProvider;
  webllmModel: WebLlmModelId;
  claudeModel: ClaudeModelId;
}

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  provider: 'webllm',
  webllmModel: DEFAULT_WEBLLM_MODEL,
  claudeModel: DEFAULT_CLAUDE_MODEL,
};

export const MODEL_CONFIG_KEY = 'modelConfig';
