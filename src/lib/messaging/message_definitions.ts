import { Schema, PdfBox } from '@/lib/definitions';

// ─── Existing messages (viewer ↔ background ↔ sidepanel) ───

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

export interface PdfTextSelectedMessage {
  type: 'pdfTextSelected';
  text: string;
  pdfUrl: string;
}

export interface GetPdfViewerConfigMessage {
  type: 'getPdfViewerConfig';
}

export interface SetActiveSchemaMessage {
  type: 'setActiveSchema';
  schema: Schema;
}

export interface GetActiveSchemaMessage {
  type: 'getActiveSchema';
}

export interface RenderHighlightsMessage {
  type: 'renderHighlights';
  instances: { id: string; classId: string; coords: PdfBox[] }[];
}

export interface GetPdfInfoMessage {
  type: 'getPdfInfo';
}

export interface AddInstanceMessage {
  type: 'addInstance';
  text: string;
  schemaId: string;
  classId: string;
  coords: PdfBox[] | null;
  pdfUrl: string;
}

export interface DeleteInstanceMessage {
  type: 'deleteInstance';
  highlightId: string;
  classId: string;
}

// ─── PDF full-text extraction ───

export interface ExtractPdfTextMessage {
  type: 'extractPdfText';
}

export interface PdfTextExtractedMessage {
  type: 'pdfTextExtracted';
  pages: { pageNumber: number; text: string }[];
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
  stage: 'downloading' | 'loading' | 'running';
  progress: number; // 0-1
  message?: string;
}

export interface GetModelStatusMessage {
  type: 'getModelStatus';
}

export interface ModelStatusReportMessage {
  type: 'modelStatusReport';
  webllm: { loaded: boolean; model: string | null };
  transformers: { loaded: boolean; pipelines: string[] };
}

// ─── Discriminated union of all messages ───

export type ExtensionMessage =
  | PdfViewerReadyMessage
  | PdfPageChangedMessage
  | PdfTextSelectedMessage
  | GetPdfViewerConfigMessage
  | SetActiveSchemaMessage
  | GetActiveSchemaMessage
  | RenderHighlightsMessage
  | GetPdfInfoMessage
  | AddInstanceMessage
  | DeleteInstanceMessage
  | ExtractPdfTextMessage
  | PdfTextExtractedMessage
  | RunWebLlmTaskMessage
  | RunTransformersTaskMessage
  | MlTaskResultMessage
  | MlTaskErrorMessage
  | MlProgressMessage
  | GetModelStatusMessage
  | ModelStatusReportMessage;

// Type-safe message type string
export type MessageType = ExtensionMessage['type'];
