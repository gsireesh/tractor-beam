import {SchemaViewer} from "@/components/SchemaViewer";
import {getStates} from "@/lib/schema-storage.ts";
import {APP_CONFIG} from "@/app-config.ts";

export default function Page() {
  const [initialState, setInitialState] = useState(null);

  useEffect(() => {
    const fetchInitialState = async () => {
      const initialStateRequest = await getStates(APP_CONFIG.indexedDBConfig);
      const result = await new Promise((resolve, reject) => {
        initialStateRequest.onsuccess = () => {
          resolve(initialStateRequest.result);
        };
      });

      console.log(result);
      setInitialState(Object.values(result));
    };

    fetchInitialState();
  }, []);

  if (!initialState) {
    return <div>Loading...</div>;
  }
  else {
    return <SchemaViewer schemas={initialState}></SchemaViewer>;
  }

}
