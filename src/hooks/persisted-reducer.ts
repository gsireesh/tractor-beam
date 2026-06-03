import {useCallback} from 'react';
import {createSnapshot, createUpdate} from "@/lib/schema-storage.ts";
import {IndexedDBConfig} from "@/app-config.ts";
import {ImmerReducer, useImmerReducer} from "use-immer";
import {Schema, SchemaAction} from "@/lib/definitions.ts";

export function usePersistedSchemaReducer(
    reducer: ImmerReducer<Schema[], SchemaAction>,
    initialValues: Schema[],
    indexedDBConfig: IndexedDBConfig,
){
    const storeAction = useCallback((action: SchemaAction) => {
        if (action.actionType == "addSchema") {
            createSnapshot(indexedDBConfig, action.schema).then().catch(() => {
                console.log("Failed to store event", action);
            });
        } else {
            createUpdate(indexedDBConfig, action.schemaId, action).then().catch(() => {
                console.log("Failed to store event", action);
            });
        }
    }, [indexedDBConfig]);
    return usePersistedReducer(reducer, initialValues, storeAction);
}


export function usePersistedReducer<S extends unknown[], A>(
    reducer: ImmerReducer<S, A>,
    initialValues: S,
    storeAction: (action: A) => void,
    ) {
    const [state, originalDispatch] = useImmerReducer(reducer, initialValues);

    const dispatch = useCallback((action: A) => {
        console.log(action);
        originalDispatch(action);
        storeAction(action);
    }, [originalDispatch, storeAction]);

    return [state, dispatch] as const;

}