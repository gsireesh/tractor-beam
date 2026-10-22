import Anthropic from '@anthropic-ai/sdk';
import type { ChatMessage } from './webllm-runner';
import type { ProgressCallback } from './types';
import { CLAUDE_MODELS, DEFAULT_CLAUDE_MODEL } from './types';

/** Anthropic provider configuration block (composed into ModelConfig). */
export interface AnthropicConfig {
  apiKey: string | null;
  baseUrl: string;
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
};

export class ClaudeRunner {
  private apiKey: string | null = null;
  private baseUrl = 'https://api.anthropic.com';
  private model: string = DEFAULT_CLAUDE_MODEL;

  // Accepts the progress callback for interface parity with the other runners;
  // Claude calls return in one shot, so there's no load/stream progress to report.
  constructor(_onProgress: ProgressCallback) {}

  setModel(model: string) {
    this.model = model;
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
  async run(messages: ChatMessage[], _requestId?: string, maxTokens = 2048, timeoutMs = 60_000) {
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
      max_tokens: maxTokens,
      system: systemMessage
        ? [{ type: 'text', text: systemMessage.content, cache_control: { type: 'ephemeral' } }]
        : undefined,
      messages: turns,
    };

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

  /**
   * Free reachability + auth check: list models (GET /v1/models) rather than
   * spend a message. Resolves on success; throws the SDK error on failure so the
   * caller can classify it (bad key → 401, offline → connection error).
   */
  async verify(): Promise<void> {
    const apiKey = this.ensureApiKey();
    const client = new Anthropic({
      apiKey,
      baseURL: this.baseUrl,
      dangerouslyAllowBrowser: true,
    });
    await client.models.list({ limit: 1 });
  }
}
