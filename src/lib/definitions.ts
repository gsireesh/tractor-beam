export interface PdfBox {
  pageNumber: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Instance {
  id: string;
  instanceType: "text" | "box";
  text: string;
  range: Range | null;
  coords: PdfBox[] | null;
  pdfUrl: string;
}

// ─── Visual block extraction (PDF text segmented by spatial proximity) ───

export interface VisualBlockItem {
  str: string;
  box: PdfBox;  // normalized 0-1 coords
}

export interface VisualBlock {
  blockId: string;        // e.g. "p1_b0" (page 1, block 0)
  pageNumber: number;
  text: string;           // concatenated item strings
  items: VisualBlockItem[];
  itemOffsets: number[];   // char offset in `text` where each item starts
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

export interface MlAnnotationRun {
  id: string;              // requestId
  pdfUrl: string;
  schemaId: string;
  annotations: MlAnnotation[];
  createdAt: number;
}

export interface SchemaClass {
  id: string;
  name: string;
  description: string;
  instances: Instance[];
}
export interface Schema {
  id: string;
  name: string;
  classes: SchemaClass[];
}

export interface BackgroundState {
  activeSchema: Schema | null;
}
