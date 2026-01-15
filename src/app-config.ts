export interface IndexedDBConfig {
    dbSchemaName: string,
    schemaVersion: number
    schemaObjectStoreName: string
}

export interface TractorBeamConfig {
    indexedDBConfig: IndexedDBConfig
}


export const APP_CONFIG: TractorBeamConfig = {
    indexedDBConfig: {
        dbSchemaName: 'tractor-beam',
        schemaVersion: 1,
        schemaObjectStoreName: 'schemas'
    },
}