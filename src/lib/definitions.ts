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

// ─── PDF embedded table of contents (outline) ───

/**
 * One entry of the PDF's embedded outline, flattened depth-first from the nested
 * tree pdf.js returns. `level` is the nesting depth (0 = top-level), used both to
 * indent the menu and to derive a section's page window (a section runs until the
 * next entry at the same or a shallower level). `pageNumber` is 1-based.
 */
export interface OutlineEntry {
  title: string;
  pageNumber: number;
  level: number;
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

/**
 * The document region a run covered. Absent = whole-document run (the default,
 * and every run recorded before scoping existed). All three scope kinds reduce to
 * an inclusive 1-based `[startPage, endPage]` page window; `label` is the display
 * string ("Page 7" | "Pages 3–5" | a TOC section title).
 */
export interface MlRunScope {
  kind: 'page' | 'range' | 'toc';
  startPage: number;
  endPage: number;
  label: string;
}

export interface MlAnnotationRun {
  id: string; // requestId
  pdfUrl: string;
  schemaId: string;
  annotations: MlAnnotation[];
  createdAt: number;
  /** Model used for this run; absent on runs recorded before this was captured. */
  model?: MlRunModel;
  /** Document region covered; absent = whole document (see MlRunScope). */
  scope?: MlRunScope;
  /** Friendly `adverb-verb` nickname; absent on runs recorded before naming. */
  name?: string;
  /**
   * References the mlRun SchemaSnapshot this run was based on (doc 02: run →
   * snapshot). The version's display label is derived from that snapshot, not
   * stored here. Absent on runs recorded before this link existed.
   */
  snapshotIndex?: SchemaActionRef;
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

/** Why a snapshot (schema version) was recorded — see docs/architecture/02. */
export type SnapshotKind = 'manual' | 'export' | 'mlRun';

/**
 * A reference to a point in a schema's op-log — a snapshotIndex or updateIndex.
 * Doc 06 calls this `OpRef`: a swappable *sequencing* value, kept out of domain
 * identity so the eventual monotonic-int → replica-safe-id swap stays mechanical.
 */
export type SchemaActionRef = number;

export interface SchemaSnapshot {
  snapshotIndex: number;
  schemaId: string;
  schema: Schema;
  createdAt: number;
  lastAppliedUpdateIndex: SchemaActionRef;
  /** Absent on legacy/seed snapshots — treat as 'manual' on read. */
  kind?: SnapshotKind;
  /** Friendly `adjective-noun` version nickname; absent on legacy snapshots. */
  label?: string;
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

/**
 * Restore the schema to an earlier version. A forward-appended op (doc 06), NOT a
 * rewind — `schema` is the materialized target state and `restoredFrom` records
 * the version it descends from (the one lineage edge not derivable from ordering).
 */
interface Restore {
  actionType: 'restore';
  schemaId: string;
  restoredFrom: SchemaActionRef;
  schema: Schema;
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
  | UpdateInstance
  | Restore;
