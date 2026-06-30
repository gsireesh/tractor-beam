export interface PdfBox {
  pageNumber: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Instance {
  id: string;
  instanceType: 'text' | 'box';
  text: string;
  positiveExample: boolean;
  coords: PdfBox[] | null;
  pdfUrl: string;
  notes?: string | null;
}

export interface Highlight {
  id: string;
  classId: string;
  schemaId: string;
  coords: PdfBox[];
  source: 'manual' | 'ml';
  text?: string;
  color: string;
  positiveExample: boolean;
}

export interface Signpost extends Highlight {
  className: string;
}

// ─── Visual block extraction (PDF text segmented by spatial proximity) ───

export interface VisualBlockItem {
  str: string;
  box: PdfBox; // normalized 0-1 coords
}

export interface VisualBlock {
  blockId: string; // e.g. "p1_b0" (page 1, block 0)
  pageNumber: number;
  text: string; // concatenated item strings
  items: VisualBlockItem[];
  itemOffsets: number[]; // char offset in `text` where each item starts
}

// ─── ML annotation pipeline results ───

export interface MlAnnotation {
  id: string;
  text: string;
  className: string;
  classId: string;
  coords: PdfBox[];
  pdfUrl: string;
  blockId: string;
  createdAt: number;
}

/**
 * Secret-stripped snapshot of the model config a run was produced with, recorded
 * at run time for provenance/display. Deliberately omits credentials (the
 * provider apiKey) — this is persisted to IndexedDB. `params` is provider-shaped
 * (e.g. effort/maxTokens), kept generic so it survives provider changes.
 */
export interface MlRunModel {
  provider: string;
  model: string;
  baseUrl?: string;
  params?: Record<string, number | string | undefined>;
}

export interface MlAnnotationRun {
  id: string; // requestId
  pdfUrl: string;
  schemaId: string;
  annotations: MlAnnotation[];
  createdAt: number;
  /** Model used for this run; absent on runs recorded before this was captured. */
  model?: MlRunModel;
}

export interface SchemaClass {
  id: string;
  name: string;
  description: string;
  color: string;
  instances: Instance[];
}
export interface Schema {
  id: string;
  name: string;
  classes: SchemaClass[];
}

export interface SchemaSnapshot {
  snapshotIndex: number;
  schemaId: string;
  schema: Schema;
  createdAt: number;
  lastAppliedUpdateIndex: number;
}

export interface SchemaUpdate {
  updateIndex: number;
  schemaId: string;
  action: SchemaAction;
  createdAt: number;
}

interface AddSchema {
  actionType: 'addSchema';
  schema: Schema;
}

interface UpdateSchema {
  actionType: 'updateSchema';
  schemaId: string;
  schemaInfo: Schema;
}

interface DeleteSchema {
  actionType: 'deleteSchema';
  schemaId: string;
}

interface AddClass {
  actionType: 'addClass';
  schemaId: string;
  classInfo: SchemaClass;
}

interface UpdateClass {
  actionType: 'updateClass';
  schemaId: string;
  classId: string;
  classInfo: SchemaClass;
}

interface DeleteClass {
  actionType: 'deleteClass';
  schemaId: string;
  classId: string;
}

interface AddInstance {
  actionType: 'addInstance';
  schemaId: string;
  classId: string;
  instance: Instance;
}

interface DeleteInstance {
  actionType: 'deleteInstance';
  schemaId: string;
  classId: string;
  instanceId: string;
}

interface UpdateInstance {
  actionType: 'updateInstance';
  schemaId: string;
  classId: string;
  instanceId: string;
  updates: {
    notes?: string | null;
    positiveExample?: boolean;
    newClassId?: string;
  };
}

export type SchemaAction =
  | AddSchema
  | UpdateSchema
  | DeleteSchema
  | AddClass
  | UpdateClass
  | DeleteClass
  | AddInstance
  | DeleteInstance
  | UpdateInstance;
