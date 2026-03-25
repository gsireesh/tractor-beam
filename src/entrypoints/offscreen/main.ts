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
  RunWebLlmTaskMessage,
  RunAnnotationPipelineMessage,
} from '@/lib/messaging/message_definitions';
import type { Schema } from '@/lib/definitions';
import { constructSchemaNERPrompt } from "@/lib/ml/prompting.ts";
import { parseSingleBlockNerOutput } from "@/lib/ml/ner-parser.ts";
import { WebLlmRunner, type ChatMessage } from '@/lib/ml/webllm-runner';
import { TransformersRunner } from '@/lib/ml/transformers-runner';


const webllm = new WebLlmRunner(broadcastProgress);
const transformers = new TransformersRunner(broadcastProgress);

let cancelledRequestIds = new Set<string>();

function broadcastProgress(stage: string, progress: number, message?: string, requestId?: string) {
  console.log(`[offscreen] progress: ${stage}, ${progress}, ${message}`);
  chrome.runtime.sendMessage({
    type: 'mlProgress',
    requestId,
    stage,
    progress,
    message,
  }).catch((err) => {console.log("Progress message failed", err)});
}

function buildNerPrompt(schema: Schema, pdfText: { pageNumber: number; text: string }[]): ChatMessage[] {
  const systemPrompt = constructSchemaNERPrompt(schema);
  return [
    {role: "system", content: systemPrompt},
      ...pdfText.map(t => {return {role: 'user', 'content': t.text} as ChatMessage})
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

  const systemPrompt = constructSchemaNERPrompt(task.schema);
  console.log("System prompt: ", systemPrompt);
  const pdfUrl = '';

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    console.log(`[offscreen] Block ${i + 1}/${blocks.length}: ${block.blockId} (${block.text.length} chars)`);

    // Broadcast progress for each block
    broadcastProgress('running', i / blocks.length, `Block ${i + 1}/${blocks.length}`, task.requestId);

    if (cancelledRequestIds.has(task.requestId)) {
      console.log(`[offscreen] Pipeline ${task.requestId} cancelled at block ${i + 1}`);
      cancelledRequestIds.delete(task.requestId);
      broadcastProgress('running', 1, 'Cancelled', task.requestId);
      return;
    }

    if (block.text.length < 50) {
      console.log(`[offscreen] Skipping block ${block.blockId}: too short (${block.text.length} chars)`);
      continue;
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: block.text },
    ];

    try {
      const result = await webllm.run(messages, task.requestId);
      const nerText = result.choices?.[0]?.message?.content ?? '';
      console.log(`[offscreen] Block ${block.blockId} NER output:`, nerText);

      const annotations = parseSingleBlockNerOutput(nerText, block, task.schema, pdfUrl);

      if (annotations.length > 0) {
        console.log(`[offscreen] Block ${block.blockId}: ${annotations.length} annotations, broadcasting`);
        chrome.runtime.sendMessage({
          type: 'annotationResults',
          requestId: task.requestId,
          annotations,
        }).catch(() => {});
      }
    } catch (err) {
      console.warn(`[offscreen] Block ${block.blockId} failed, skipping:`, err);
    }
  }

  // Signal completion
  broadcastProgress('running', 1, 'Done', task.requestId);
  chrome.runtime.sendMessage({
    type: 'mlTaskResult',
    requestId: task.requestId,
    result: `Processed ${blocks.length} blocks`,
  }).catch(() => {});
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  switch (message.type) {
    case 'cancelAnnotationPipeline':
      console.log('[offscreen] Cancel requested for:', message.requestId);
      cancelledRequestIds.add(message.requestId);
      break;

    case 'runAnnotationPipeline':
      handleAnnotationPipeline(message)
        .catch((err) => {
          chrome.runtime.sendMessage({
            type: 'mlTaskError',
            requestId: message.requestId,
            error: err.message || String(err),
          }).catch(() => {});
        });
      break;

    case 'runWebLlmTask':
      handleWebLlmTask(message)
        .then((result) => {
          chrome.runtime.sendMessage({
            type: 'mlTaskResult',
            requestId: message.requestId,
            result,
          }).catch(() => {});
        })
        .catch((err) => {
          chrome.runtime.sendMessage({
            type: 'mlTaskError',
            requestId: message.requestId,
            error: err.message || String(err),
          }).catch(() => {});
        });
      break;

    case 'runTransformersTask':
      transformers.run(message)
        .then((result) => {
          chrome.runtime.sendMessage({
            type: 'mlTaskResult',
            requestId: message.requestId,
            result,
          }).catch(() => {});
        })
        .catch((err) => {
          chrome.runtime.sendMessage({
            type: 'mlTaskError',
            requestId: message.requestId,
            error: err.message || String(err),
          }).catch(() => {});
        });
      break;

    case 'getModelStatus':
      sendResponse({
        type: 'modelStatusReport',
        webllm: webllm.getStatus(),
        transformers: transformers.getStatus(),
      });
      return true;
  }
});

console.log('[offscreen] ML offscreen document ready');
