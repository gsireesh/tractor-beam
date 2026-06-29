// `@mlc-ai/web-llm` is loaded lazily inside ensureEngine() (see below): its
// transitive web-xgrammar dep runs `new URL(...)` at module-load, which throws
// under WXT's Node build evaluation, so merely importing this file (e.g. for
// DEFAULT_WEBLLM_CONFIG) must not pull in the runtime. The type import is erased
// at compile time, so it adds no load.
import type { MLCEngine } from '@mlc-ai/web-llm';
import { type ChatMessage, DEFAULT_WEBLLM_MODEL, type ProgressCallback } from './types';

// ChatMessage now lives in ./types (shared primitive). Re-exported here so the
// existing `from './webllm-runner'` importers keep working during the refactor.
export type { ChatMessage };

/** Tunable generation parameters for the in-browser WebLLM runner. */
export interface WebLlmParams {
  temperature?: number;
  maxTokens?: number;
}

/**
 * WebLLM provider config block (composed into ModelConfig). Local, so no
 * key/URL — just generation params; the active model lives in ModelConfig.selected.
 */
export interface WebLlmConfig {
  params: WebLlmParams;
}

export const DEFAULT_WEBLLM_CONFIG: WebLlmConfig = {
  params: { maxTokens: 1024 },
};

export class WebLlmRunner {
  private engine: MLCEngine | null = null;
  private loadedModel: string | null = null;
  private loading = false;
  private currentModel: string = DEFAULT_WEBLLM_MODEL;
  private onProgress: ProgressCallback;
  private params: WebLlmParams = {};

  constructor(onProgress: ProgressCallback) {
    this.onProgress = onProgress;
  }

  setModel(model: string) {
    this.currentModel = model;
  }

  setParams(params: WebLlmParams) {
    this.params = params;
  }

  /** Ensure the engine is loaded with the current model. */
  private async ensureEngine(requestId?: string): Promise<MLCEngine> {
    if (this.engine && this.loadedModel === this.currentModel) {
      return this.engine;
    }

    // Only one model at a time — GPU memory constraint
    if (this.engine) {
      await this.engine.unload();
      this.engine = null;
      this.loadedModel = null;
    }

    this.loading = true;
    try {
      // Lazy-load the runtime only when actually creating an engine (browser
      // context), keeping web-llm out of the build-time module graph.
      const { CreateMLCEngine } = await import('@mlc-ai/web-llm');
      this.engine = await CreateMLCEngine(this.currentModel, {
        initProgressCallback: (report) => {
          this.onProgress('loading', report.progress, report.text, requestId);
        },
      });
      this.onProgress('running', 1, '', '');
      this.loadedModel = this.currentModel;
      return this.engine;
    } finally {
      this.loading = false;
    }
  }

  /**
   * Run a chat completion. Thin wrapper around the OpenAI-compatible API.
   * Returns the raw API response.
   */
  async run(messages: ChatMessage[], requestId?: string, maxTokens = 1024, timeoutMs = 60_000) {
    const engine = await this.ensureEngine(requestId);
    const completionPromise = engine.chat.completions.create({
      messages,
      max_tokens: this.params.maxTokens ?? maxTokens,
      ...(this.params.temperature != null ? { temperature: this.params.temperature } : {}),
    });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('WebLLM inference timed out')), timeoutMs),
    );
    return await Promise.race([completionPromise, timeoutPromise]);
  }

  getStatus(): { loaded: boolean; model: string | null } {
    return { loaded: this.engine !== null, model: this.loadedModel };
  }
}
