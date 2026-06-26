import { describe, it, expect } from 'vitest';
import { coerceModelConfig } from '@/lib/config-storage.ts';
import { DEFAULT_MODEL_CONFIG } from '@/lib/ml/model-config.ts';

// `coerceModelConfig` is the heal-on-read entry point for model config. Given
// whatever sits under the `modelConfig` storage key — the new per-provider
// shape, the legacy flat shape, or nothing — plus the value read from the
// legacy top-level `claudeApiKey` key, it returns a valid new-shape ModelConfig.
// It is pure, so we exercise it with literal inputs rather than mocking
// chrome.storage.
//
// The legacy fixtures mirror the real on-disk shape that shipped to users:
//   { provider, webllmModel, claudeModel, ollamaModel }
// with credentials stored separately under `claudeApiKey` / `ollamaBaseUrl`.

describe('coerceModelConfig', () => {
  describe('legacy flat config → per-provider shape', () => {
    it('maps a Claude user onto the anthropic block, folding in the separate API key', () => {
      const legacy = {
        provider: 'claude',
        webllmModel: 'Qwen2.5-3B-Instruct-q4f16_1-MLC',
        claudeModel: 'claude-opus-4-7',
        ollamaModel: 'qwen3.5:4b',
      };
      const config = coerceModelConfig(legacy, 'sk-ant-test-key');

      expect(config.provider).toBe('anthropic');
      expect(config.anthropic.apiKey).toBe('sk-ant-test-key');
      expect(config.anthropic.model).toBe('claude-opus-4-7');
    });

    it('maps an Ollama user onto anthropic and drops Ollama settings entirely', () => {
      const legacy = {
        provider: 'ollama',
        webllmModel: 'Qwen2.5-3B-Instruct-q4f16_1-MLC',
        claudeModel: 'claude-sonnet-4-6',
        ollamaModel: 'qwen3.5:4b',
      };
      const config = coerceModelConfig(legacy, null);

      // Ollama is gone. Rather than the local default, these users land on
      // Anthropic — and since they had no Claude key stored, apiKey heals to
      // null (they'll be prompted to add one).
      expect(config.provider).toBe('anthropic');
      expect(config.anthropic.apiKey).toBeNull();
      // The openai block stays at defaults — nothing from ollamaModel leaks in.
      expect(config.openai).toEqual(DEFAULT_MODEL_CONFIG.openai);
    });

    it("preserves a WebLLM user's selected model", () => {
      const legacy = {
        provider: 'webllm',
        webllmModel: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
        claudeModel: 'claude-sonnet-4-6',
        ollamaModel: 'qwen3.5:4b',
      };
      const config = coerceModelConfig(legacy, null);

      expect(config.provider).toBe('webllm');
      expect(config.webllm.model).toBe('Phi-3.5-mini-instruct-q4f16_1-MLC');
    });

    it('leaves anthropic.apiKey null when no legacy key was stored', () => {
      const legacy = { provider: 'claude', claudeModel: 'claude-sonnet-4-6' };
      const config = coerceModelConfig(legacy, null);
      expect(config.anthropic.apiKey).toBeNull();
    });
  });

  describe('already new-shape config', () => {
    it('returns it intact, healing any missing block from defaults', () => {
      const stored = {
        provider: 'anthropic' as const,
        anthropic: {
          apiKey: 'sk-ant-existing',
          baseUrl: 'https://proxy.example.com',
          model: 'claude-opus-4-8',
          params: { effort: 'high' as const, maxTokens: 2048 },
        },
        // openai + webllm blocks omitted — should be filled from defaults.
      };
      const config = coerceModelConfig(stored, null);

      expect(config.provider).toBe('anthropic');
      expect(config.anthropic.baseUrl).toBe('https://proxy.example.com');
      expect(config.anthropic.params.maxTokens).toBe(2048);
      expect(config.openai).toEqual(DEFAULT_MODEL_CONFIG.openai);
      expect(config.webllm).toEqual(DEFAULT_MODEL_CONFIG.webllm);
    });
  });

  describe('absent or unusable storage', () => {
    it('falls back to defaults for undefined / null / non-object values', () => {
      expect(coerceModelConfig(undefined, null)).toEqual(DEFAULT_MODEL_CONFIG);
      expect(coerceModelConfig(null, null)).toEqual(DEFAULT_MODEL_CONFIG);
      expect(coerceModelConfig('garbage', null)).toEqual(DEFAULT_MODEL_CONFIG);
    });
  });
});
