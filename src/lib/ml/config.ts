import { DEFAULT_MODEL_CONFIG, MODEL_CONFIG_KEY, type ModelConfig } from './types';

const API_KEY_STORAGE_KEY = 'claudeApiKey';

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
  const result = await chrome.storage.local.get(API_KEY_STORAGE_KEY);
  return result[API_KEY_STORAGE_KEY] ?? null;
}

/** Store the Claude API key in chrome.storage.local. */
export async function setClaudeApiKey(key: string): Promise<void> {
  await chrome.storage.local.set({ [API_KEY_STORAGE_KEY]: key });
}
