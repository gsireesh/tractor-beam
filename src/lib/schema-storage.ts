import {placeholderSchemas} from "@/lib/placeholder-schemas.ts";
import {IndexedDBConfig} from "@/app-config.ts";
import type {
    MlAnnotationRun,
    Schema,
    SchemaAction,
    SchemaSnapshot,
    SchemaUpdate
} from "@/lib/definitions.ts";
import {schemasReducer} from "@/lib/schema-reducer.ts";
import {produce} from 'immer';

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDB({dbSchemaName, schemaVersion, schemaObjectStoreName, snapshotObjectStoreName, updatesObjectStoreName, mlAnnotationsObjectStore}: IndexedDBConfig) {
    dbPromise ??= new Promise((resolve, reject) => {
            const request = window.indexedDB.open(dbSchemaName, schemaVersion);
            request.onerror = () => reject(request.error as Error);
            request.onsuccess = () => resolve(request.result);

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                const oldVersion = event.oldVersion;

                if (oldVersion < 2) {
                    const annotationStore = db.createObjectStore(mlAnnotationsObjectStore, {keyPath: 'id'});
                    annotationStore.createIndex("pdfUrl", "pdfUrl", {unique: false})
                }

                if (oldVersion < 3) {
                    const snapshotStore = db.createObjectStore(snapshotObjectStoreName, {keyPath: 'snapshotIndex', autoIncrement: true});
                    snapshotStore.createIndex("schemaId", "schemaId", {unique:false});
                    snapshotStore.createIndex("createdAt", "createdAt", {unique: false});
                    if (db.objectStoreNames.contains(schemaObjectStoreName)){
                        const existingSchemasRequest: IDBRequest<Schema[]>  =  (event.target as IDBOpenDBRequest).transaction!.objectStore(schemaObjectStoreName).getAll() as IDBRequest<Schema[]>;
                        existingSchemasRequest.onsuccess = () => {
                            const existingSchemas =  existingSchemasRequest.result;
                            for (const schema of existingSchemas) {
                                const schemaSnapshot: Omit<SchemaSnapshot, 'snapshotIndex'> = {schemaId: schema.id, schema: schema, createdAt:Date.now(), lastAppliedUpdateIndex: 0};
                                snapshotStore.put(schemaSnapshot)
                            }
                            // remove this comment after testing migration.
                            // db.deleteObjectStore('schemas');
                        }
                    } else {
                        for (const schema of placeholderSchemas) {
                            const snapshot: Omit<SchemaSnapshot, 'snapshotIndex'> = {schemaId: schema.id, schema: schema, createdAt:Date.now(), lastAppliedUpdateIndex: 0};
                            snapshotStore.put(snapshot)
                        }
                    }
                    const updateStore = db.createObjectStore(updatesObjectStoreName, {keyPath: "updateIndex", autoIncrement: true});
                    updateStore.createIndex("schemaId", "schemaId", {unique: false})
                }
            }
        });
    return dbPromise;
}

export async function getLatestSnapshotBySchema(indexedDBConfig: IndexedDBConfig): Promise<Record<string, SchemaSnapshot>> {
    const db = await getDB(indexedDBConfig);
    const snapshotStore = db.transaction(indexedDBConfig.snapshotObjectStoreName, 'readonly').objectStore(indexedDBConfig.snapshotObjectStoreName);

    return new Promise((resolve, reject) => {
        const snapshotsBySchemaId: Record<string, SchemaSnapshot> = {};
        // 'prev' here orders backwards on the primary key - so will pull the most recent snapshots
        // first.
        const snapshotCursorRequest = snapshotStore.openCursor(null, 'prev');
        snapshotCursorRequest.onsuccess = () => {
            const cursor = snapshotCursorRequest.result;
            if (cursor) {
                const schemaSnapshot = cursor.value as SchemaSnapshot;
                if (!(schemaSnapshot.schemaId in snapshotsBySchemaId)) {
                    snapshotsBySchemaId[schemaSnapshot.schemaId] = schemaSnapshot;
                }
                cursor.continue()
            } else {
                resolve(snapshotsBySchemaId);
            }
        };
        snapshotCursorRequest.onerror = () => {
            reject(snapshotCursorRequest.error as Error)
        }
    });
}

export async function createSnapshot(indexedDBConfig: IndexedDBConfig, schema: Schema): Promise<void> {
    const db = await getDB(indexedDBConfig);
    const tx = db.transaction([indexedDBConfig.snapshotObjectStoreName, indexedDBConfig.updatesObjectStoreName], 'readwrite');
    const maxReq = tx.objectStore(indexedDBConfig.updatesObjectStoreName).openKeyCursor(null, 'prev'); // first hit = highest updateIndex
    maxReq.onsuccess = () => {
        const lastAppliedUpdateIndex = maxReq.result ? Number(maxReq.result.key) : 0;
        const snapshot: Omit<SchemaSnapshot, 'snapshotIndex'> = {schemaId: schema.id, schema, createdAt: Date.now(), lastAppliedUpdateIndex: lastAppliedUpdateIndex};
        tx.objectStore(indexedDBConfig.snapshotObjectStoreName).add(snapshot);
    };

    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error as Error);
    });

}

export async function getUpdates(indexedDBConfig: IndexedDBConfig, schemaId: string, afterUpdateIndex: number): Promise<SchemaUpdate[]> {
    const db = await getDB(indexedDBConfig);
    const updateStore = db.transaction(indexedDBConfig.updatesObjectStoreName, 'readonly').objectStore(indexedDBConfig.updatesObjectStoreName);

    return new Promise<SchemaUpdate[]>((resolve, reject) => {
        const updateRequest = updateStore.index("schemaId").getAll(schemaId);

        updateRequest.onsuccess = () => {
            resolve((updateRequest.result as SchemaUpdate[]).filter(u => u.updateIndex > afterUpdateIndex));
        };

        updateRequest.onerror = () => {
            reject(updateRequest.error as Error)
        }
    });
}

export async function createUpdate(indexedDBConfig: IndexedDBConfig, schemaId: string, schemaAction: SchemaAction): Promise<void> {
    const update: Omit<SchemaUpdate, 'updateIndex'> = {schemaId, action:schemaAction, createdAt: Date.now()};
    const db = await getDB(indexedDBConfig);
    const tx = db.transaction(indexedDBConfig.updatesObjectStoreName, 'readwrite');
    const updateStore = tx.objectStore(indexedDBConfig.updatesObjectStoreName);
    updateStore.add(update);

    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error as Error);
    });
}

export async function rebuildState(indexedDBConfig: IndexedDBConfig): Promise<Schema[]> {
    const snapshotsById= await getLatestSnapshotBySchema(indexedDBConfig);
    let allSchemas = Object.values(snapshotsById).map(s => s.schema);
    for (const [schemaId, snapshot] of Object.entries(snapshotsById)) {
        const updates = await getUpdates(indexedDBConfig, schemaId, snapshot.lastAppliedUpdateIndex);
        allSchemas = updates.reduce(
            (schemas, update) => produce(schemas, draft => schemasReducer(draft, update.action)),
            allSchemas)
    }
    return allSchemas;
}

export async function storeMlAnnotationRun(indexedDBConfig: IndexedDBConfig, run: MlAnnotationRun): Promise<void> {
    const db = await getDB(indexedDBConfig);
    const store = db.transaction(indexedDBConfig.mlAnnotationsObjectStore, 'readwrite').objectStore(indexedDBConfig.mlAnnotationsObjectStore);
    const getRequest = store.get(run.id);
    getRequest.onsuccess = () => {
        const existing = getRequest.result as MlAnnotationRun | undefined;
        if (existing) {
            run = { ...run, annotations: [...existing.annotations, ...run.annotations] };
        }
        store.put(run);
    };
}

export async function getMlAnnotationRuns(indexedDBConfig: IndexedDBConfig, schemaId: string, pdfUrl: string): Promise<MlAnnotationRun[]> {
    const db = await getDB(indexedDBConfig);
    const store = db.transaction(indexedDBConfig.mlAnnotationsObjectStore, 'readonly').objectStore(indexedDBConfig.mlAnnotationsObjectStore);
    const index = store.index("pdfUrl");
    return new Promise((resolve, reject) => {
        const request = index.getAll(pdfUrl);
        request.onsuccess = () => resolve(request.result.filter((result: MlAnnotationRun) => result.schemaId === schemaId) as MlAnnotationRun[]);
        request.onerror = () => reject(request.error as Error);
    });
}

export async function deleteMlAnnotationRun(indexedDBConfig: IndexedDBConfig, id: string): Promise<void> {
    const db = await getDB(indexedDBConfig);
    const store = db.transaction(indexedDBConfig.mlAnnotationsObjectStore, 'readwrite').objectStore(indexedDBConfig.mlAnnotationsObjectStore);
    store.delete(id);
}