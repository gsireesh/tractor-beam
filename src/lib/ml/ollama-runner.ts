import { Ollama } from 'ollama/browser';
import type { ChatMessage } from './webllm-runner';
import type { ProgressCallback } from './types';
import { DEFAULT_OLLAMA_MODEL, DEFAULT_OLLAMA_BASE_URL } from './types';

export class OllamaRunner {
  private client: Ollama;
  private model = DEFAULT_OLLAMA_MODEL;
  private baseUrl = DEFAULT_OLLAMA_BASE_URL;
  private onProgress: ProgressCallback;
  private available = false;

  constructor(onProgress: ProgressCallback) {
    this.onProgress = onProgress;
    this.client = new Ollama({ host: this.baseUrl });
  }

  setModel(model: string) {
    this.model = model;
  }

  setBaseUrl(url: string) {
    if (url !== this.baseUrl) {
      this.baseUrl = url;
      this.client = new Ollama({ host: url });
      this.available = false;
    }
    void this.checkAvailability();
  }

  /** Ping Ollama to verify the server is reachable. Caches the result. */
  async checkAvailability(): Promise<boolean> {
    try {
      await this.client.list();
      this.available = true;
    } catch {
      this.available = false;
    }
    return this.available;
  }

  /**
   * Run a chat completion against the local Ollama server.
   * Returns a response shaped like WebLLM's ChatCompletion for compatibility.
   */
  async run(messages: ChatMessage[], _requestId?: string, _maxTokens = 1024, _timeoutMs = 60_000) {
    try {
      const response = await this.client.chat({
        model: this.model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        think: false
      });

      this.available = true;
      const content = response.message.content ?? '';
      return {
        choices: [{
          message: { role: 'assistant' as const, content },
          finish_reason: response.done_reason ?? 'stop',
          index: 0,
          logprobs: null,
        }],
        usage: {
          prompt_tokens: response.prompt_eval_count ?? 0,
          completion_tokens: response.eval_count ?? 0,
          total_tokens: (response.prompt_eval_count ?? 0) + (response.eval_count ?? 0),
        },
      };
    } catch (err) {
      this.available = false;
      throw err;
    }
  }

  getStatus(): { loaded: boolean; model: string | null } {
    return { loaded: this.available, model: this.available ? this.model : null };
  }
}
