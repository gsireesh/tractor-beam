import { describe, it, expect } from 'vitest';
import { coerceModelConfig } from '@/lib/config-storage.ts';
import { DEFAULT_MODEL_CONFIG } from '@/lib/ml/model-config.ts';

// `coerceModelConfig` is the heal-on-read entry point for model config. Given
// whatever sits under the `modelConfig` storage key — the new shape, the legacy
// flat shape, or nothing — plus the value read from the legacy `claudeApiKey`
// key, it returns a valid new-shape ModelConfig. Pure, so we exercise it with
// literal inputs rather than mocking chrome.storage.
//
// New shape: provider connection blocks (anthropic/openai/webllm, no model) plus
// a top-level model-first `selected: { provider, model }`. Legacy fixtures mirror
// the real on-disk shape that shipped: { provider, webllmModel, claudeModel,
// ollamaModel }, with the API key under a separate `claudeApiKey` key.

describe('coerceModelConfig', () => {
  describe('legacy flat config → selection + provider blocks', () => {
    it('maps a Claude user to an anthropic selection, folding in the separate API key', () => {
      const legacy = {
        provider: 'claude',
        webllmModel: 'Qwen2.5-3B-Instruct-q4f16_1-MLC',
        claudeModel: 'claude-opus-4-7',
        ollamaModel: 'qwen3.5:4b',
      };
      const config = coerceModelConfig(legacy, 'sk-ant-test-key');

      expect(config.selected).toEqual({ provider: 'anthropic', model: 'claude-opus-4-7' });
      expect(config.anthropic.apiKey).toBe('sk-ant-test-key');
    });

    it('maps an Ollama user to an anthropic selection and drops Ollama settings', () => {
      const legacy = {
        provider: 'ollama',
        webllmModel: 'Qwen2.5-3B-Instruct-q4f16_1-MLC',
        claudeModel: 'claude-sonnet-4-6',
        ollamaModel: 'qwen3.5:4b',
      };
      const config = coerceModelConfig(legacy, null);

      // Ollama is gone: these users land on Anthropic with no key stored yet.
      expect(config.selected.provider).toBe('anthropic');
      expect(config.anthropic.apiKey).toBeNull();
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

      expect(config.selected).toEqual({
        provider: 'webllm',
        model: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
      });
    });

    it('falls back to the default model when the legacy block had none', () => {
      const legacy = { provider: 'claude' };
      const config = coerceModelConfig(legacy, null);

      expect(config.selected.provider).toBe('anthropic');
      expect(config.selected.model).toBe(DEFAULT_MODEL_CONFIG.selected.model);
      expect(config.anthropic.apiKey).toBeNull();
    });
  });

  describe('already new-shape config', () => {
    it('returns it intact, healing any missing block from defaults', () => {
      const stored = {
        selected: { provider: 'anthropic' as const, model: 'claude-opus-4-8' },
        anthropic: {
          apiKey: 'sk-ant-existing',
          baseUrl: 'https://proxy.example.com',
        },
        // openai + webllm blocks omitted — filled from defaults.
      };
      const config = coerceModelConfig(stored, null);

      expect(config.selected).toEqual({ provider: 'anthropic', model: 'claude-opus-4-8' });
      expect(config.anthropic.baseUrl).toBe('https://proxy.example.com');
      expect(config.anthropic.apiKey).toBe('sk-ant-existing');
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
