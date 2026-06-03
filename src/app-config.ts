export interface IndexedDBConfig {
    dbSchemaName: string,
    schemaVersion: number
    schemaObjectStoreName: string // deprecated
    snapshotObjectStoreName: string,
    updatesObjectStoreName: string,
    mlAnnotationsObjectStore: string
}

export interface TractorBeamConfig {
    indexedDBConfig: IndexedDBConfig
}

export const APP_CONFIG: TractorBeamConfig = {
    indexedDBConfig: {
        dbSchemaName: 'tractor-beam',
        schemaVersion: 3,
        schemaObjectStoreName: 'schemas', // deprecated
        snapshotObjectStoreName: 'snapshots',
        updatesObjectStoreName: 'updates',
        mlAnnotationsObjectStore: 'ml-annotations',
    },
}