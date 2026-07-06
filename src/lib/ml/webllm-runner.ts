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

/**
 * WebLLM provider config block (composed into ModelConfig). Local, so it has no
 * connection settings at all — the active model lives in ModelConfig.selected.
 * Kept as an (empty) block so the three providers stay structurally symmetric.
 */
export type WebLlmConfig = Record<string, never>;

export const DEFAULT_WEBLLM_CONFIG: WebLlmConfig = {};

export class WebLlmRunner {
  private engine: MLCEngine | null = null;
  private loadedModel: string | null = null;
  private currentModel: string = DEFAULT_WEBLLM_MODEL;
  private onProgress: ProgressCallback;

  constructor(onProgress: ProgressCallback) {
    this.onProgress = onProgress;
  }

  setModel(model: string) {
    this.currentModel = model;
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
  }

  /**
   * Run a chat completion. Thin wrapper around the OpenAI-compatible API.
   * Returns the raw API response.
   */
  async run(messages: ChatMessage[], requestId?: string, maxTokens = 1024, timeoutMs = 60_000) {
    const engine = await this.ensureEngine(requestId);
    const completionPromise = engine.chat.completions.create({
      messages,
      max_tokens: maxTokens,
    });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('WebLLM inference timed out')), timeoutMs),
    );
    return await Promise.race([completionPromise, timeoutPromise]);
  }

  getStatus(): { loaded: boolean; model: string | null } {
    return { loaded: this.engine !== null, model: this.loadedModel };
  }

  /**
   * Local model — there is no endpoint to probe, so a connection check is a
   * no-op success. Readiness for WebLLM is purely structural (a model is
   * selected); the expensive GPU load happens at run time, not here.
   */
  async verify(): Promise<void> {
    return;
  }
}
