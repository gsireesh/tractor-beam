import { Schema, VisualBlock, MlAnnotation } from '@/lib/definitions';
import type { MlStage } from '@/lib/ml/types';
import type { ModelConfig } from '@/lib/ml/model-config';

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
  | MlProgressMessage
  | GetModelStatusMessage
  | ModelStatusReportMessage;

// Type-safe message type string
export type MessageType = ExtensionMessage['type'];
