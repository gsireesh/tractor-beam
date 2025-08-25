export type SchemaClass = {
    name: string
    description: string
    instances: object[]
}
export type Schema = {
    name: string;
    classes: SchemaClass[];
}