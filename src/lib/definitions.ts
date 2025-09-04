export interface SchemaClass {
  id: string;
  name: string;
  description: string;
  instances: object[];
}
export interface Schema {
  id: string;
  name: string;
  classes: SchemaClass[];
}
