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
  range: Range;
  coords: PdfBox[] | null;
  pdfUrl: string;
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
