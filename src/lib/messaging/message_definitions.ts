import { Schema, PdfBox, VisualBlock, MlAnnotation } from '@/lib/definitions';

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

export type HighlightSource = 'manual' | 'ml';

export interface HighlightInstance {
  id: string;
  classId: string;
  coords: PdfBox[];
  source?: HighlightSource;
  text?: string;
}

export interface RenderHighlightsMessage {
  type: 'renderHighlights';
  instances: HighlightInstance[];
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

export interface PromoteMlAnnotationMessage {
  type: 'promoteMlAnnotation';
  highlightId: string;
}

// ─── PDF full-text extraction ───

export interface ExtractPdfTextMessage {
  type: 'extractPdfText';
}

export interface PdfTextExtractedMessage {
  type: 'pdfTextExtracted';
  pages: { pageNumber: number; text: string }[];
}

// ─── Annotation pipeline messages ───

export type AnnotationBackend = 'webllm' | 'claude';

export interface RunAnnotationPipelineMessage {
  type: 'runAnnotationPipeline';
  requestId: string;
  schema: Schema;
  backend: AnnotationBackend;
  blocks?: VisualBlock[];  // populated by background before forwarding to offscreen
}

export interface CancelAnnotationPipelineMessage {
  type: 'cancelAnnotationPipeline';
  requestId: string;
}

export interface SetClaudeApiKeyMessage {
  type: 'setClaudeApiKey';
  apiKey: string;
}

export interface RequestVisualBlocksMessage {
  type: 'requestVisualBlocks';
  requestId: string;
}

export interface VisualBlocksResponseMessage {
  type: 'visualBlocksResponse';
  requestId: string;
  blocks: VisualBlock[];
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
  | PromoteMlAnnotationMessage
  | ExtractPdfTextMessage
  | PdfTextExtractedMessage
  | RunAnnotationPipelineMessage
  | CancelAnnotationPipelineMessage
  | SetClaudeApiKeyMessage
  | RequestVisualBlocksMessage
  | VisualBlocksResponseMessage
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
