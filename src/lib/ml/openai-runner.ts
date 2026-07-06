/**
 * OpenAI-compatible provider — covers any endpoint speaking the
 * /v1/chat/completions API: Ollama (at /v1), Together, OpenRouter, OpenAI
 * proper. Replaces the old Ollama-specific runner.
 *
 * This file currently defines the provider's configuration shape; the
 * OpenAiRunner class (built on the `openai` SDK) lands in the runner step.
 */

import OpenAI from 'openai';
import type { ChatMessage } from './webllm-runner';
import type { ProgressCallback } from './types';

/**
 * OpenAI-compatible provider configuration block (composed into ModelConfig).
 * `baseUrl` is required — there is no universal default endpoint — and the
 * model list is fetched live from the endpoint's /v1/models.
 */
export interface OpenAiConfig {
  apiKey: string | null;
  baseUrl: string;
}

export const DEFAULT_OPENAI_CONFIG: OpenAiConfig = {
  apiKey: null,
  baseUrl: '',
};

/**
 * Curated default models for OpenAI-compatible endpoints — a couple of current
 * OpenAI GPT-5.4 models. Placeholder until the list is fetched live from the
 * endpoint's /v1/models, since the real catalog is endpoint-specific (a custom
 * Ollama/Together/OpenRouter endpoint will serve entirely different ids).
 */
export const OPENAI_MODELS = ['gpt-5.4', 'gpt-5.4-mini'] as const;

export class OpenAiRunner {
  private apiKey: string | null = null;
  private baseUrl = '';
  private model = '';

  // Progress callback kept for interface parity; remote calls return in one shot.
  constructor(_onProgress: ProgressCallback) {}

  setModel(model: string) {
    this.model = model;
  }

  setApiKeyDirect(key: string | null) {
    this.apiKey = key;
  }

  setBaseUrl(url: string) {
    this.baseUrl = url;
  }

  /**
   * Run a chat completion against any OpenAI-compatible /v1/chat/completions
   * endpoint (Ollama, Together, OpenRouter, OpenAI proper). Returns a response
   * shaped like WebLLM's ChatCompletion so the pipeline treats runners uniformly.
   */
  async run(messages: ChatMessage[], _requestId?: string, maxTokens = 1024, timeoutMs = 60_000) {
    if (!this.baseUrl) {
      throw new Error('OpenAI-compatible base URL not configured. Set it in Model Configuration.');
    }
    const client = new OpenAI({
      // Many local endpoints (e.g. Ollama) ignore the key, but the SDK needs a value.
      apiKey: this.apiKey ?? 'not-needed',
      baseURL: this.baseUrl,
      dangerouslyAllowBrowser: true,
      timeout: timeoutMs,
    });

    const completion = await client.chat.completions.create({
      model: this.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })) as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      // `max_completion_tokens`, not the deprecated `max_tokens`: OpenAI's o-series
      // and GPT-5 models (our defaults) reject `max_tokens` with a 400. Modern
      // OpenAI-compatible servers (vLLM, OpenRouter, Together) accept this too;
      // older ones that only know `max_tokens` ignore the unknown field (no cap)
      // rather than erroring — a better failure mode than hard-breaking OpenAI.
      max_completion_tokens: maxTokens,
    });

    const content = completion.choices[0]?.message?.content ?? '';
    return {
      choices: [
        {
          message: { role: 'assistant' as const, content },
          finish_reason: completion.choices[0]?.finish_reason ?? 'stop',
          index: 0,
          logprobs: null,
        },
      ],
      usage: {
        prompt_tokens: completion.usage?.prompt_tokens ?? 0,
        completion_tokens: completion.usage?.completion_tokens ?? 0,
        total_tokens: completion.usage?.total_tokens ?? 0,
      },
    };
  }

  getStatus(): { loaded: boolean; model: string | null } {
    return { loaded: !!this.baseUrl, model: this.baseUrl ? this.model : null };
  }

  /**
   * Free reachability + auth check: list models (GET /v1/models) against the
   * configured endpoint rather than spend a completion. Resolves on success;
   * throws on failure (missing base URL, unreachable host, bad key) so the caller
   * can classify it.
   */
  async verify(): Promise<void> {
    if (!this.baseUrl) {
      throw new Error('OpenAI-compatible base URL not configured. Set it in Model Configuration.');
    }
    const client = new OpenAI({
      apiKey: this.apiKey ?? 'not-needed',
      baseURL: this.baseUrl,
      dangerouslyAllowBrowser: true,
    });
    await client.models.list();
  }
}
