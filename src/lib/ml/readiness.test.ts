import { describe, it, expect } from 'vitest';
import { describeConfigGap } from './readiness';
import { DEFAULT_MODEL_CONFIG, type ModelConfig } from './model-config';

/** Deep-ish clone of the default config with `selected` overridden. */
function withSelection(provider: ModelConfig['selected']['provider'], model: string): ModelConfig {
  return {
    ...DEFAULT_MODEL_CONFIG,
    anthropic: { ...DEFAULT_MODEL_CONFIG.anthropic },
    openai: { ...DEFAULT_MODEL_CONFIG.openai },
    webllm: { ...DEFAULT_MODEL_CONFIG.webllm },
    selected: { provider, model },
  };
}

describe('describeConfigGap', () => {
  it('reports a gap when no model is selected', () => {
    expect(describeConfigGap(withSelection('anthropic', ''))).toMatch(/select a model/i);
  });

  it('reports a missing Anthropic API key', () => {
    const config = withSelection('anthropic', 'claude-sonnet-4-6');
    config.anthropic.apiKey = null;
    expect(describeConfigGap(config)).toMatch(/anthropic api key/i);
  });

  it('is satisfied once an Anthropic key is present', () => {
    const config = withSelection('anthropic', 'claude-sonnet-4-6');
    config.anthropic.apiKey = 'sk-ant-test';
    expect(describeConfigGap(config)).toBeNull();
  });

  it('reports a missing OpenAI base URL', () => {
    const config = withSelection('openai', 'gpt-5.4');
    config.openai.baseUrl = '';
    expect(describeConfigGap(config)).toMatch(/base url/i);
  });

  it('is satisfied once an OpenAI base URL is present (key optional)', () => {
    const config = withSelection('openai', 'gpt-5.4');
    config.openai.baseUrl = 'http://localhost:11434/v1';
    config.openai.apiKey = null;
    expect(describeConfigGap(config)).toBeNull();
  });

  it('never requires a key/URL for local WebLLM, only a model', () => {
    expect(describeConfigGap(withSelection('webllm', 'Qwen2.5-3B-Instruct-q4f16_1-MLC'))).toBeNull();
    expect(describeConfigGap(withSelection('webllm', ''))).toMatch(/select a model/i);
  });
});
