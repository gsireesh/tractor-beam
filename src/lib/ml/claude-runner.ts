import type { ChatMessage } from './webllm-runner';
import type { ProgressCallback } from './types';
import { DEFAULT_CLAUDE_MODEL } from './types';

export class ClaudeRunner {
  private apiKey: string | null = null;
  private model = DEFAULT_CLAUDE_MODEL;
  private onProgress: ProgressCallback;

  constructor(onProgress: ProgressCallback) {
    this.onProgress = onProgress;
  }

  setModel(model: string) {
    this.model = model;
  }

  /** Set API key in memory only (for offscreen document which can't access chrome.storage). */
  setApiKeyDirect(key: string) {
    this.apiKey = key;
  }

  ensureApiKey(): string {
    if (this.apiKey) return this.apiKey;
    throw new Error('Claude API key not configured. Set it in the Model Control Panel.');
  }

  /**
   * Run a chat completion against the Claude API.
   * Returns a response shaped like WebLLM's ChatCompletion for compatibility.
   */
  async run(messages: ChatMessage[], requestId?: string, maxTokens = 1024, timeoutMs = 60_000) {
    const apiKey = this.ensureApiKey();

    // Claude API uses a separate system parameter rather than a system message
    const systemMessage = messages.find(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: maxTokens,
      messages: nonSystemMessages.map(m => ({ role: m.role, content: m.content })),
    };
    if (systemMessage) {
      body.system = systemMessage.content;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Claude API error ${response.status}: ${errorBody}`);
      }

      const data = await response.json();

      // Map Claude response to OpenAI-compatible shape for the pipeline
      const content = data.content?.[0]?.text ?? '';
      return {
        choices: [{
          message: { role: 'assistant' as const, content },
          finish_reason: data.stop_reason ?? 'stop',
          index: 0,
          logprobs: null,
        }],
        usage: {
          prompt_tokens: data.usage?.input_tokens ?? 0,
          completion_tokens: data.usage?.output_tokens ?? 0,
          total_tokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  getStatus(): { loaded: boolean; model: string | null } {
    return { loaded: this.apiKey !== null, model: this.apiKey ? this.model : null };
  }
}
