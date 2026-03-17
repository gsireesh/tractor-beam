/**
 * Offscreen document entry point.
 *
 * Hosts ML model inference (web-llm, transformers.js) in a persistent page
 * context with access to WebGPU, WASM, and Web Workers.
 *
 * This is the prompt-building layer: it converts schema + PDF text into
 * model-specific prompts and calls the runners.
 */

import type { ExtensionMessage, RunWebLlmTaskMessage } from '@/lib/messaging/message_definitions';
import type { Schema } from '@/lib/definitions';
import { constructSchemaNERPrompt} from "@/lib/ml/prompting.ts";
import { WebLlmRunner, type ChatMessage } from '@/lib/ml/webllm-runner';
import { TransformersRunner } from '@/lib/ml/transformers-runner';


const webllm = new WebLlmRunner(broadcastProgress);
const transformers = new TransformersRunner(broadcastProgress);

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

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  switch (message.type) {
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
