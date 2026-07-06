/**
 * Offscreen document entry point.
 *
 * Hosts ML model inference (web-llm, transformers.js) in a persistent page
 * context with access to WebGPU, WASM, and Web Workers.
 *
 * This is the prompt-building layer: it converts schema + PDF text into
 * model-specific prompts and calls the runners.
 */

import type {
  ExtensionMessage,
  MlProgressMessage,
  RunWebLlmTaskMessage,
  RunAnnotationPipelineMessage,
} from '@/lib/messaging/message_definitions';
import type { Schema } from '@/lib/definitions';
import { constructSchemaNERPrompt } from '@/lib/ml/prompting.ts';
import { parseSingleBlockNerOutput } from '@/lib/ml/ner-parser.ts';
import { WebLlmRunner, type ChatMessage } from '@/lib/ml/webllm-runner';
import { TransformersRunner } from '@/lib/ml/transformers-runner';
import { ClaudeRunner } from '@/lib/ml/claude-runner';
import { OpenAiRunner } from '@/lib/ml/openai-runner';
import { DEFAULT_MODEL_CONFIG, type ModelConfig } from '@/lib/ml/model-config';
import { parallelMap } from '@/lib/ml/parallel';
import { classifyMlError, describeMlError } from '@/lib/ml/errors';
import { shouldAbortRun } from '@/lib/ml/circuit-breaker';
import type {
  VerifyModelConnectionMessage,
  ModelConnectionResult,
} from '@/lib/messaging/message_definitions';

const webllm = new WebLlmRunner(broadcastProgress);
const transformers = new TransformersRunner(broadcastProgress);
const claude = new ClaudeRunner(broadcastProgress);
const openai = new OpenAiRunner(broadcastProgress);

/** The inference backends that drive the annotation pipeline. */
type Runner = ClaudeRunner | OpenAiRunner | WebLlmRunner;
const RUNNERS = { anthropic: claude, openai, webllm } as const;

/**
 * Configure the runner for the active provider from the per-provider config,
 * and return it ready to run. Each provider block (config.anthropic /
 * config.openai / config.webllm) holds that backend's connection settings +
 * params; config.selected names the active provider and model.
 */
function configureRunner(config: ModelConfig): Runner {
  const runner = RUNNERS[config.selected.provider];
  if (runner instanceof ClaudeRunner) {
    runner.setApiKeyDirect(config.anthropic.apiKey);
    runner.setParams(config.anthropic.params);
    runner.setModel(config.selected.model);
  } else if (runner instanceof OpenAiRunner) {
    if (config.openai.baseUrl) runner.setBaseUrl(config.openai.baseUrl);
    runner.setApiKeyDirect(config.openai.apiKey);
    runner.setParams(config.openai.params);
    runner.setModel(config.selected.model);
  } else {
    runner.setModel(config.selected.model);
  }
  return runner;
}

/**
 * Probe whether a provider is reachable and authenticated, without spending a
 * completion. `provider` (when set) overrides the active selection so the config
 * modal can test a specific tab. Never throws — classifies the failure so the
 * panel can show why (bad key vs offline vs rate limited).
 */
async function handleVerifyConnection(
  message: VerifyModelConnectionMessage,
): Promise<ModelConnectionResult> {
  const base = message.modelConfig ?? DEFAULT_MODEL_CONFIG;
  const config: ModelConfig = message.provider
    ? { ...base, selected: { ...base.selected, provider: message.provider } }
    : base;
  try {
    const runner = configureRunner(config);
    await runner.verify();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      classification: classifyMlError(err),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

const cancelledRequestIds = new Set<string>();

function broadcastProgress(
  stage: MlProgressMessage['stage'],
  progress: number,
  message = '',
  requestId?: string,
) {
  console.log(`[offscreen] progress: ${stage}, ${progress}, ${message}`);
  chrome.runtime
    .sendMessage({
      type: 'mlProgress',
      requestId,
      stage,
      progress,
      message,
    })
    .catch((err) => {
      console.log('Progress message failed', err);
    });
}

/**
 * Report a single failed block to the UI instead of console.warn-swallowing it.
 * The message is classified (bad key vs offline vs rate limited) so the drawer's
 * expandable warning list reads clearly.
 */
function reportBlockError(requestId: string, blockId: string, err: unknown) {
  const message = describeMlError(
    classifyMlError(err),
    err instanceof Error ? err.message : String(err),
  );
  console.warn(`[offscreen] Block ${blockId} failed: ${message}`, err);
  chrome.runtime
    .sendMessage({ type: 'mlBlockError', requestId, blockId, message })
    .catch(() => {});
}

function buildNerPrompt(
  schema: Schema,
  pdfText: { pageNumber: number; text: string }[],
): ChatMessage[] {
  const systemPrompt = constructSchemaNERPrompt(schema);
  return [
    { role: 'system', content: systemPrompt },
    ...pdfText.map((t) => {
      return { role: 'user', content: t.text } as ChatMessage;
    }),
  ];
}

async function handleWebLlmTask(task: RunWebLlmTaskMessage) {
  const messages = buildNerPrompt(task.schema, task.pdfText);
  return await webllm.run(messages, task.requestId);
}

async function handleAnnotationPipeline(task: RunAnnotationPipelineMessage) {
  console.log('[offscreen] Starting annotation pipeline:', task.requestId);

  const blocks = task.blocks;
  if (!blocks || blocks.length === 0) {
    throw new Error('No visual blocks provided — background failed to fetch them from the viewer');
  }
  console.log(`[offscreen] Processing ${blocks.length} visual blocks one at a time`);

  // Use model config from the message (offscreen can't access chrome.storage).
  const config = task.modelConfig ?? DEFAULT_MODEL_CONFIG;
  const provider = config.selected.provider;
  const runner = configureRunner(config);
  console.log(`[offscreen] Using ${provider}: ${config.selected.model}`);

  const systemPrompt = constructSchemaNERPrompt(task.schema);
  console.log('System prompt: ', systemPrompt);
  const pdfUrl = '';

  // Filter out blocks that are too short
  const processableBlocks = blocks.filter((b) => b.text.length >= 50);
  console.log(
    `[offscreen] ${processableBlocks.length} blocks to process (${blocks.length - processableBlocks.length} skipped as too short)`,
  );

  // Offline pre-check for remote providers: don't fire a request per block only
  // to have every one fail. The throw surfaces as an `error` run state via the
  // outer mlTaskError catch. (Local webLLM needs no network.)
  if (
    (provider === 'anthropic' || provider === 'openai') &&
    typeof navigator !== 'undefined' &&
    !navigator.onLine
  ) {
    throw new Error('You appear to be offline. Connect to the internet and try again.');
  }

  if (provider === 'anthropic' || provider === 'openai') {
    // Parallel execution for remote APIs (benefits from concurrent requests)
    const CONCURRENCY = provider === 'anthropic' ? 5 : 3;
    let completed = 0;
    // Circuit-breaker: consecutive settle-order failures, reset by any success.
    let consecutiveFailures = 0;

    const processBlock = async (block: (typeof processableBlocks)[number]) => {
      const messages: ChatMessage[] = [
        // Prompt-cache breakpoints are applied inside claude-runner when it
        // builds the Anthropic request — not set here on the neutral message.
        { role: 'system', content: systemPrompt },
        { role: 'user', content: block.text },
      ];
      const result = await runner.run(messages, task.requestId);
      return { block, nerText: result.choices?.[0]?.message?.content ?? '' };
    };

    for await (const outcome of parallelMap(processableBlocks, processBlock, CONCURRENCY, () =>
      cancelledRequestIds.has(task.requestId),
    )) {
      completed++;
      broadcastProgress(
        'running',
        completed / processableBlocks.length,
        `Block ${completed}/${processableBlocks.length}`,
        task.requestId,
      );

      if (!outcome.ok) {
        // Map the failure back to its block via the outcome index, then surface it.
        reportBlockError(task.requestId, processableBlocks[outcome.index].blockId, outcome.error);
        consecutiveFailures++;
        const decision = shouldAbortRun({
          consecutiveFailures,
          classification: classifyMlError(outcome.error),
          isFirstBlock: completed === 1,
        });
        // Throw to short-circuit: in-flight blocks won't launch more (parallelMap
        // stops on the next tick) and the outer catch turns this into an error run.
        if (decision.abort) throw new Error(decision.reason);
        continue;
      }
      consecutiveFailures = 0; // a success resets the streak

      const { result } = outcome;
      console.log(`[offscreen] Block ${result.block.blockId} NER output:`, result.nerText);

      const annotations = parseSingleBlockNerOutput(
        result.nerText,
        result.block,
        task.schema,
        pdfUrl,
      );
      if (annotations.length > 0) {
        console.log(
          `[offscreen] Block ${result.block.blockId}: ${annotations.length} annotations, broadcasting`,
        );
        chrome.runtime
          .sendMessage({
            type: 'annotationResults',
            requestId: task.requestId,
            annotations,
          })
          .catch(() => {});
      }
    }
  } else {
    // Sequential execution for WebLLM (local GPU, one inference at a time)
    let consecutiveFailures = 0;
    for (let i = 0; i < processableBlocks.length; i++) {
      const block = processableBlocks[i];
      console.log(
        `[offscreen] Block ${i + 1}/${processableBlocks.length}: ${block.blockId} (${block.text.length} chars)`,
      );
      broadcastProgress(
        'running',
        i / processableBlocks.length,
        `Block ${i + 1}/${processableBlocks.length}`,
        task.requestId,
      );

      if (cancelledRequestIds.has(task.requestId)) {
        console.log(`[offscreen] Pipeline ${task.requestId} cancelled at block ${i + 1}`);
        cancelledRequestIds.delete(task.requestId);
        broadcastProgress('cancelled', 1, 'Cancelled', task.requestId);
        return;
      }

      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: block.text },
      ];

      try {
        const result = await runner.run(messages, task.requestId);
        const nerText = result.choices?.[0]?.message?.content ?? '';
        console.log(`[offscreen] Block ${block.blockId} NER output:`, nerText);
        consecutiveFailures = 0; // a success resets the streak

        const annotations = parseSingleBlockNerOutput(nerText, block, task.schema, pdfUrl);
        if (annotations.length > 0) {
          console.log(
            `[offscreen] Block ${block.blockId}: ${annotations.length} annotations, broadcasting`,
          );
          chrome.runtime
            .sendMessage({
              type: 'annotationResults',
              requestId: task.requestId,
              annotations,
            })
            .catch(() => {});
        }
      } catch (err) {
        reportBlockError(task.requestId, block.blockId, err);
        consecutiveFailures++;
        const decision = shouldAbortRun({
          consecutiveFailures,
          classification: classifyMlError(err),
          isFirstBlock: i === 0,
        });
        if (decision.abort) throw new Error(decision.reason);
      }
    }
  }

  // Signal completion with a real terminal stage (not running@1, which left the
  // status stuck green with no way to tell finished from failed).
  if (cancelledRequestIds.has(task.requestId)) {
    cancelledRequestIds.delete(task.requestId);
    broadcastProgress('cancelled', 1, 'Cancelled', task.requestId);
  } else {
    broadcastProgress('done', 1, 'Done', task.requestId);
  }
  chrome.runtime
    .sendMessage({
      type: 'mlTaskResult',
      requestId: task.requestId,
      result: `Processed ${processableBlocks.length} blocks via ${provider}`,
    })
    .catch(() => {});
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  switch (message.type) {
    case 'cancelAnnotationPipeline':
      console.log('[offscreen] Cancel requested for:', message.requestId);
      cancelledRequestIds.add(message.requestId);
      break;

    case 'runAnnotationPipeline':
      handleAnnotationPipeline(message).catch((err) => {
        chrome.runtime
          .sendMessage({
            type: 'mlTaskError',
            requestId: message.requestId,
            error: err.message || String(err),
          })
          .catch(() => {});
      });
      break;

    case 'runWebLlmTask':
      handleWebLlmTask(message)
        .then((result) => {
          chrome.runtime
            .sendMessage({
              type: 'mlTaskResult',
              requestId: message.requestId,
              result,
            })
            .catch(() => {});
        })
        .catch((err) => {
          chrome.runtime
            .sendMessage({
              type: 'mlTaskError',
              requestId: message.requestId,
              error: err.message || String(err),
            })
            .catch(() => {});
        });
      break;

    case 'runTransformersTask':
      transformers
        .run(message)
        .then((result) => {
          chrome.runtime
            .sendMessage({
              type: 'mlTaskResult',
              requestId: message.requestId,
              result,
            })
            .catch(() => {});
        })
        .catch((err) => {
          chrome.runtime
            .sendMessage({
              type: 'mlTaskError',
              requestId: message.requestId,
              error: err.message || String(err),
            })
            .catch(() => {});
        });
      break;

    case 'getModelStatus':
      sendResponse({
        type: 'modelStatusReport',
        webllm: webllm.getStatus(),
        transformers: transformers.getStatus(),
        anthropic: claude.getStatus(),
        openai: openai.getStatus(),
      });
      return true;

    case 'verifyModelConnection':
      handleVerifyConnection(message).then(sendResponse);
      return true; // async response
  }
});

console.log('[offscreen] ML offscreen document ready');
