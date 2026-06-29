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

/** Tunable generation parameters for OpenAI-compatible chat models. */
export interface OpenAiParams {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}

/**
 * OpenAI-compatible provider configuration block (composed into ModelConfig).
 * `baseUrl` is required — there is no universal default endpoint — and the
 * model list is fetched live from the endpoint's /v1/models.
 */
export interface OpenAiConfig {
  apiKey: string | null;
  baseUrl: string;
  params: OpenAiParams;
}

export const DEFAULT_OPENAI_CONFIG: OpenAiConfig = {
  apiKey: null,
  baseUrl: '',
  params: { maxTokens: 1024 },
};

export class OpenAiRunner {
  private apiKey: string | null = null;
  private baseUrl = '';
  private model = '';
  private params: OpenAiParams = {};

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

  setParams(params: OpenAiParams) {
    this.params = params;
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
      max_tokens: this.params.maxTokens ?? maxTokens,
      ...(this.params.temperature != null ? { temperature: this.params.temperature } : {}),
      ...(this.params.topP != null ? { top_p: this.params.topP } : {}),
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
}
