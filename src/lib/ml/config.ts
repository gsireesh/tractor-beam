import { DEFAULT_MODEL_CONFIG, MODEL_CONFIG_KEY, type ModelConfig } from './types';

const API_KEY_STORAGE_KEY = 'claudeApiKey';
const OLLAMA_BASE_URL_KEY = 'ollamaBaseUrl';

/** Read model config from chrome.storage.local, merged with defaults. */
export async function getModelConfig(): Promise<ModelConfig> {
  const result = await chrome.storage.local.get(MODEL_CONFIG_KEY);
  const stored = result[MODEL_CONFIG_KEY] as Partial<ModelConfig> | undefined;
  return { ...DEFAULT_MODEL_CONFIG, ...stored };
}

/** Partial-update model config in chrome.storage.local. */
export async function setModelConfig(config: Partial<ModelConfig>): Promise<void> {
  const current = await getModelConfig();
  await chrome.storage.local.set({ [MODEL_CONFIG_KEY]: { ...current, ...config } });
}

/** Read the Claude API key from chrome.storage.local. */
export async function getClaudeApiKey(): Promise<string | null> {
  const result: Record<string, string> = await chrome.storage.local.get(API_KEY_STORAGE_KEY);
  return result[API_KEY_STORAGE_KEY] ?? null;
}

/** Store the Claude API key in chrome.storage.local. */
export async function setClaudeApiKey(key: string): Promise<void> {
  await chrome.storage.local.set({ [API_KEY_STORAGE_KEY]: key });
}

/** Read the Ollama base URL from chrome.storage.local. */
export async function getOllamaBaseUrl(): Promise<string | null> {
  const result: Record<string, string> = await chrome.storage.local.get(OLLAMA_BASE_URL_KEY);
  return result[OLLAMA_BASE_URL_KEY] ?? null;
}

/** Store the Ollama base URL in chrome.storage.local. */
export async function setOllamaBaseUrl(url: string): Promise<void> {
  await chrome.storage.local.set({ [OLLAMA_BASE_URL_KEY]: url });
}
