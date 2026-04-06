import {placeholderSchemas} from "@/lib/placeholder-schemas.ts";
import {IndexedDBConfig} from "@/app-config.ts";
import type {MlAnnotationRun} from "@/lib/definitions.ts";

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDB({dbSchemaName, schemaVersion, schemaObjectStoreName, mlAnnotationsObjectStore}: IndexedDBConfig) {
    dbPromise ??= new Promise((resolve, reject) => {
            const request = window.indexedDB.open(dbSchemaName, schemaVersion);
            request.onerror = () => reject(request.error as Error);
            request.onsuccess = () => resolve(request.result);

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                const oldVersion = event.oldVersion;

                if (oldVersion < 1) {
                    const objectStore = db.createObjectStore(schemaObjectStoreName, {keyPath: 'id'});
                    objectStore.createIndex('name', 'name', {unique: false});

                    objectStore.transaction.oncomplete = () => {
                        const schemaObjectStore = db.transaction(schemaObjectStoreName, 'readwrite').objectStore(schemaObjectStoreName);
                        placeholderSchemas.forEach((schema) => {
                            schemaObjectStore.add(schema)
                        })
                    }
                }

                if (oldVersion < 2) {
                    const annotationStore = db.createObjectStore(mlAnnotationsObjectStore, {keyPath: 'id'});
                    annotationStore.createIndex("pdfUrl", "pdfUrl", {unique: false})
                }
            }
        });
    return dbPromise;
}

export async function getStates(indexedDBConfig: IndexedDBConfig) {
    const db = await getDB(indexedDBConfig);
    const schemaObjectStore = db.transaction(indexedDBConfig.schemaObjectStoreName, 'readwrite').objectStore(indexedDBConfig.schemaObjectStoreName);
    return schemaObjectStore.getAll()
}

export async function storeStates<S>(indexedDBConfig: IndexedDBConfig, updatedState: S[]) {
    const db = await getDB(indexedDBConfig);
    const schemaObjectStore = db.transaction(indexedDBConfig.schemaObjectStoreName, 'readwrite').objectStore(indexedDBConfig.schemaObjectStoreName);
    updatedState.forEach((schema: S) => {
        schemaObjectStore.put(schema)
    })
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