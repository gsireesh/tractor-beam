import { CreateMLCEngine, type MLCEngine } from '@mlc-ai/web-llm';
import { DEFAULT_WEBLLM_MODEL, type ProgressCallback, type WebLlmModelId } from './types';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class WebLlmRunner {
  private engine: MLCEngine | null = null;
  private loadedModel: string | null = null;
  private loading = false;
  private currentModel: WebLlmModelId = DEFAULT_WEBLLM_MODEL;
  private onProgress: ProgressCallback;

  constructor(onProgress: ProgressCallback) {
    this.onProgress = onProgress;
  }

  setModel(model: WebLlmModelId) {
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

    this.loading = true;
    try {
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
  async run(messages: ChatMessage[], requestId?: string) {
    const engine = await this.ensureEngine(requestId);
    return await engine.chat.completions.create({ messages });
  }

  getStatus(): { loaded: boolean; model: string | null } {
    return { loaded: this.engine !== null, model: this.loadedModel };
  }
}
