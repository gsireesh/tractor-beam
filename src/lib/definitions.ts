export interface PdfBox {
  pageNumber: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Instance {
  instanceType: "text" | "box";
  range: Range;
  coords: PdfBox;
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
