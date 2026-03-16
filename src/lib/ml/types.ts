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
