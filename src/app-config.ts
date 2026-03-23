export interface IndexedDBConfig {
    dbSchemaName: string,
    schemaVersion: number
    schemaObjectStoreName: string
}

export interface TractorBeamConfig {
    indexedDBConfig: IndexedDBConfig
}


export const ML_ANNOTATIONS_STORE = 'ml-annotations';

export const APP_CONFIG: TractorBeamConfig = {
    indexedDBConfig: {
        dbSchemaName: 'tractor-beam',
        schemaVersion: 2,
        schemaObjectStoreName: 'schemas'
    },
}