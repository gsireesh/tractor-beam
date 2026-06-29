import Anthropic from '@anthropic-ai/sdk';
import type { ChatMessage } from './webllm-runner';
import type { ProgressCallback } from './types';
import { CLAUDE_MODELS, DEFAULT_CLAUDE_MODEL } from './types';

/** Reasoning-effort levels accepted by current Claude models. */
export type EffortLevel = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/**
 * Tunable parameters for Anthropic models. Current Claude models reject
 * temperature/top_p (HTTP 400), so the knobs here are reasoning effort and the
 * max output-token cap — not the OpenAI-style sampling params.
 */
export interface AnthropicParams {
  effort?: EffortLevel;
  maxTokens?: number;
}

/** Anthropic provider configuration block (composed into ModelConfig). */
export interface AnthropicConfig {
  apiKey: string | null;
  baseUrl: string;
  params: AnthropicParams;
}

/**
 * Selectable Anthropic models — fallback list for when the live /v1/models
 * fetch is unavailable. Aliased from the legacy CLAUDE_MODELS during the
 * refactor; will be defined here outright once ModelControls is ported off it.
 */
export const ANTHROPIC_MODELS = CLAUDE_MODELS;

/** Default model used to seed a fresh Anthropic selection. */
export const DEFAULT_ANTHROPIC_MODEL = DEFAULT_CLAUDE_MODEL;

export const DEFAULT_ANTHROPIC_CONFIG: AnthropicConfig = {
  apiKey: null,
  baseUrl: 'https://api.anthropic.com',
  params: { maxTokens: 1024 },
};

export class ClaudeRunner {
  private apiKey: string | null = null;
  private baseUrl = 'https://api.anthropic.com';
  private model: string = DEFAULT_CLAUDE_MODEL;
  private params: AnthropicParams = {};

  // Accepts the progress callback for interface parity with the other runners;
  // Claude calls return in one shot, so there's no load/stream progress to report.
  constructor(_onProgress: ProgressCallback) {}

  setModel(model: string) {
    this.model = model;
  }

  setParams(params: AnthropicParams) {
    this.params = params;
  }

  /** Set the API key in memory only (offscreen can't access chrome.storage). */
  setApiKeyDirect(key: string | null) {
    this.apiKey = key;
  }

  /** Override the API base URL (e.g. an Anthropic-compatible proxy/gateway). */
  setBaseUrl(url: string) {
    if (url) this.baseUrl = url;
  }

  ensureApiKey(): string {
    if (this.apiKey) return this.apiKey;
    throw new Error('Claude API key not configured. Set it in Model Configuration.');
  }

  /**
   * Run a chat completion against the Anthropic Messages API via the official
   * SDK. Returns a response shaped like WebLLM's ChatCompletion so the pipeline
   * can treat every runner uniformly.
   */
  async run(messages: ChatMessage[], _requestId?: string, maxTokens = 1024, timeoutMs = 60_000) {
    const apiKey = this.ensureApiKey();
    const client = new Anthropic({
      apiKey,
      baseURL: this.baseUrl,
      // Runs in the offscreen document (a real DOM context); the SDK gates
      // browser usage behind this flag.
      dangerouslyAllowBrowser: true,
    });

    // Anthropic takes the system prompt as its own parameter, not a message, and
    // the ephemeral cache breakpoint is applied here — a provider-specific concern
    // owned by this runner, not the shared neutral ChatMessage.
    const systemMessage = messages.find((m) => m.role === 'system');
    const turns = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const request: Anthropic.MessageCreateParamsNonStreaming = {
      model: this.model,
      max_tokens: this.params.maxTokens ?? maxTokens,
      system: systemMessage
        ? [{ type: 'text', text: systemMessage.content, cache_control: { type: 'ephemeral' } }]
        : undefined,
      messages: turns,
    };
    // `effort` is GA on the Messages API but only typed under the SDK's beta
    // messages resource in this version; attach it directly rather than switching
    // the whole call to client.beta.messages.
    if (this.params.effort) {
      (request as unknown as Record<string, unknown>).output_config = { effort: this.params.effort };
    }

    const message = await client.messages.create(request, { timeout: timeoutMs });

    const text =
      message.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text ?? '';
    return {
      choices: [
        {
          message: { role: 'assistant' as const, content: text },
          finish_reason: message.stop_reason ?? 'stop',
          index: 0,
          logprobs: null,
        },
      ],
      usage: {
        prompt_tokens: message.usage.input_tokens,
        completion_tokens: message.usage.output_tokens,
        total_tokens: message.usage.input_tokens + message.usage.output_tokens,
      },
    };
  }

  getStatus(): { loaded: boolean; model: string | null } {
    return { loaded: this.apiKey !== null, model: this.apiKey ? this.model : null };
  }
}
