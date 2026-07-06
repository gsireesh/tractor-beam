import { pipeline, type Pipeline } from '@huggingface/transformers';
import type { RunTransformersTaskMessage } from '@/lib/messaging/message_definitions';
import type { ProgressCallback } from './types';

/** Default models per task type */
const DEFAULT_MODELS: Record<string, string> = {
  ner: 'Xenova/bert-base-NER',
  embeddings: 'Xenova/all-MiniLM-L6-v2',
  classification: 'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
};

/** Map our task names to transformers.js pipeline task names */
const PIPELINE_TASKS: Record<string, string> = {
  ner: 'token-classification',
  embeddings: 'feature-extraction',
  classification: 'text-classification',
};

export class TransformersRunner {
  private pipelines = new Map<string, Pipeline>();
  private onProgress: ProgressCallback;

  constructor(onProgress: ProgressCallback) {
    this.onProgress = onProgress;
  }

  /** Get or lazily create a pipeline for the given task + model combo. */
  private async ensurePipeline(
    task: string,
    model?: string,
    requestId?: string,
  ): Promise<Pipeline> {
    const resolvedModel = model || DEFAULT_MODELS[task];
    if (!resolvedModel) {
      throw new Error(`No default model for task: ${task}`);
    }

    const key = `${task}:${resolvedModel}`;
    const existing = this.pipelines.get(key);
    if (existing) return existing;

    const pipelineTask = PIPELINE_TASKS[task];
    if (!pipelineTask) {
      throw new Error(`Unknown task type: ${task}`);
    }

    this.onProgress('downloading', 0, `Loading ${resolvedModel}...`, requestId);

    // transformers.js types pipeline() as a 20+ member union of every pipeline
    // subtype — too complex for TS to represent (TS2590) and not assignable to
    // the base Pipeline. Cast at this boundary so the Map/return/call sites stay
    // clean; Pipeline is callable, so run()'s pipe(task.input) is still typed.
    const pipe = (await pipeline(pipelineTask as Parameters<typeof pipeline>[0], resolvedModel, {
      progress_callback: (progress: { status: string; progress?: number }) => {
        if (progress.progress !== undefined) {
          this.onProgress('downloading', progress.progress / 100, progress.status, requestId);
        }
      },
    })) as unknown as Pipeline;

    this.pipelines.set(key, pipe);
    return pipe;
  }

  async run(task: RunTransformersTaskMessage): Promise<unknown> {
    const pipe = await this.ensurePipeline(task.task, task.model, task.requestId);
    this.onProgress('running', 0, 'Running inference...', task.requestId);
    const result = await pipe(task.input);
    return result;
  }

  getStatus(): { loaded: boolean; pipelines: string[] } {
    return {
      loaded: this.pipelines.size > 0,
      pipelines: Array.from(this.pipelines.keys()),
    };
  }
}
