import {placeholderSchemas} from "@/lib/placeholder-schemas.ts";
import {IndexedDBConfig} from "@/app-config.ts";

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDB({dbSchemaName, schemaVersion, schemaObjectStoreName}: IndexedDBConfig) {
    dbPromise ??= new Promise((resolve, reject) => {
            const request = window.indexedDB.open(dbSchemaName, schemaVersion);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                const objectStore = db.createObjectStore(schemaObjectStoreName, {keyPath: 'id'});
                objectStore.createIndex('name', 'name', {unique: false});

                objectStore.transaction.oncomplete = () => {
                    const schemaObjectStore = db.transaction(schemaObjectStoreName, 'readwrite').objectStore(schemaObjectStoreName);
                    placeholderSchemas.forEach((schema) => {
                        schemaObjectStore.add(schema)
                    })
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