import {storeStates} from "@/lib/schema-storage.ts";
import {IndexedDBConfig} from "@/app-config.ts";
import {ImmerReducer, useImmerReducer} from "use-immer";


export function usePersistedReducer<S extends unknown[], A>(reducer: ImmerReducer<S, A>, initialValues: S, indexedDBConfig: IndexedDBConfig) {
    const [state, originalDispatch] = useImmerReducer(reducer, initialValues);

    const dispatch = useCallback((action: A) => {
        console.log(action);
        originalDispatch(action);
    }, [originalDispatch]);
    // const dbPromise = getDB(indexedDBConfig);

    useEffect(() => {
    const timeoutId = setTimeout(() => {
        console.log("Storing schemas!", state);
        storeStates(indexedDBConfig, state)
            .then()
            .catch(() => console.error("Schema write failed!"));
    }, 500); // Adjust debounce time as needed

    return () => clearTimeout(timeoutId);
  }, [state, indexedDBConfig]);


    return [state, dispatch] as const;

}