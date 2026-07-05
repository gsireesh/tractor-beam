import { Schema, VisualBlock, MlAnnotation } from '@/lib/definitions';
import type { MlStage } from '@/lib/ml/types';
import type { ModelConfig, ModelProvider } from '@/lib/ml/model-config';
import type { MlErrorClass } from '@/lib/ml/errors';

// ─── Viewer ↔ background messages ───

export interface PdfViewerReadyMessage {
  type: 'pdfViewerReady';
  url: string;
  pdfUrl: string;
}

export interface PdfPageChangedMessage {
  type: 'pdfPageChanged';
  pageNumber: number;
  pdfUrl: string;
}

export interface GetPdfViewerConfigMessage {
  type: 'getPdfViewerConfig';
}

export interface GetPdfInfoMessage {
  type: 'getPdfInfo';
}

// ─── PDF full-text extraction ───

export interface ExtractPdfTextMessage {
  type: 'extractPdfText';
}

export interface PdfTextExtractedMessage {
  type: 'pdfTextExtracted';
  pages: { pageNumber: number; text: string }[];
}

// ─── Offscreen lifecycle ───

export interface EnsureOffscreenMessage {
  type: 'ensureOffscreen';
}

// ─── Schema manager ───
// Content scripts (the drawer) can't call chrome.tabs, so opening the
// standalone Schema Manager page is delegated to the background.

export interface OpenSchemaManagerMessage {
  type: 'openSchemaManager';
  schemaId: string;
}

// ─── Annotation pipeline messages ───
// The drawer orchestrates the pipeline: extracts visual blocks locally,
// then sends the complete message (with blocks) to the offscreen document.

export interface RunAnnotationPipelineMessage {
  type: 'runAnnotationPipeline';
  requestId: string;
  schema: Schema;
  blocks?: VisualBlock[];
  // The full per-provider config travels in the message (incl. the active
  // provider's secret) because the offscreen document can't read chrome.storage.
  modelConfig?: ModelConfig;
}

export interface CancelAnnotationPipelineMessage {
  type: 'cancelAnnotationPipeline';
  requestId: string;
}

export interface AnnotationResultsMessage {
  type: 'annotationResults';
  requestId: string;
  annotations: MlAnnotation[];
}

// ─── ML task messages ───
// Messages carry intent (schema + text), not implementation details.
// Model selection and prompt construction happen in the offscreen document.

export interface RunWebLlmTaskMessage {
  type: 'runWebLlmTask';
  requestId: string;
  schema: Schema;
  pdfText: { pageNumber: number; text: string }[];
}

export interface RunTransformersTaskMessage {
  type: 'runTransformersTask';
  requestId: string;
  task: 'ner' | 'embeddings' | 'classification';
  input: string;
}

export interface MlTaskResultMessage {
  type: 'mlTaskResult';
  requestId: string;
  result: unknown;
}

export interface MlTaskErrorMessage {
  type: 'mlTaskError';
  requestId: string;
  error: string;
}

/**
 * One block failed mid-run. Emitted per failed block (previously these were
 * console.warn-swallowed), so the UI can show "N blocks failed" with detail and
 * the run can distinguish a partial success from a clean one.
 */
export interface MlBlockErrorMessage {
  type: 'mlBlockError';
  requestId: string;
  blockId: string;
  message: string;
}

// ─── Progress & status ───

export interface MlProgressMessage {
  type: 'mlProgress';
  requestId?: string;
  stage: MlStage;
  progress: number; // 0-1
  message: string;
}

export interface GetModelStatusMessage {
  type: 'getModelStatus';
}

// ─── Connection verification ───
// Sent by the panel to the offscreen document to probe whether the selected (or
// an explicitly named) provider is actually reachable and authenticated — a free
// GET /v1/models, never a completion. The offscreen replies via sendResponse with
// a ModelConnectionResult. Config travels in the message (offscreen can't read
// chrome.storage); `provider` overrides config.selected.provider so the config
// modal can test a specific tab regardless of the active selection.

export interface VerifyModelConnectionMessage {
  type: 'verifyModelConnection';
  modelConfig: ModelConfig;
  provider?: ModelProvider;
}

/** The offscreen's reply to a verify request (returned via sendResponse, not broadcast). */
export interface ModelConnectionResult {
  ok: boolean;
  classification?: MlErrorClass;
  error?: string;
}

export interface ModelStatusReportMessage {
  type: 'modelStatusReport';
  webllm: { loaded: boolean; model: string | null };
  transformers: { loaded: boolean; pipelines: string[] };
  anthropic: { loaded: boolean; model: string | null };
  openai: { loaded: boolean; model: string | null };
}

// ─── Discriminated union of all messages ───

export type ExtensionMessage =
  | PdfViewerReadyMessage
  | PdfPageChangedMessage
  | GetPdfViewerConfigMessage
  | GetPdfInfoMessage
  | ExtractPdfTextMessage
  | PdfTextExtractedMessage
  | EnsureOffscreenMessage
  | OpenSchemaManagerMessage
  | RunAnnotationPipelineMessage
  | CancelAnnotationPipelineMessage
  | AnnotationResultsMessage
  | RunWebLlmTaskMessage
  | RunTransformersTaskMessage
  | MlTaskResultMessage
  | MlTaskErrorMessage
  | MlBlockErrorMessage
  | MlProgressMessage
  | GetModelStatusMessage
  | ModelStatusReportMessage
  | VerifyModelConnectionMessage;

// Type-safe message type string
export type MessageType = ExtensionMessage['type'];
