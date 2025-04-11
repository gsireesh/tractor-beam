export type SchemaClass = {
    name: string
    description: string
    instances: Array<any>
}
export type Schema = {
    name: string;
    classes: Array<SchemaClass>;
}