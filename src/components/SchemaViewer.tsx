import { SchemaClassViewer } from "@/components/SchemaClassViewer";
import {APP_CONFIG} from "@/app-config.ts";
import {storeMlAnnotationRun} from "@/lib/schema-storage.ts";

import { Button, TabItem, Tabs } from "flowbite-react";
import { PiListPlus } from "react-icons/pi";
import { Schema } from "@/lib/definitions";
import { schemasReducer, SchemaAction} from "@/lib/schema-reducer.ts";
import {usePersistedReducer} from "@/hooks/persisted-reducer.ts";
import {generateId} from "@/lib/utils.ts";
import {PdfBox} from "@/lib/definitions.ts";
import {ModelControls} from "@/components/ModelControls.tsx";

export function SchemaViewer({
  schemas: initialSchemas,
}: {
  schemas: Schema[];
}) {
  const [schemas, dispatch] = usePersistedReducer<Schema[], SchemaAction>(schemasReducer, initialSchemas, APP_CONFIG.indexedDBConfig);
  const [llmLoaded, setLlmLoaded] = useState({stage: "unloaded", progress: "", message: ""});

  const activeSchema = schemas[0]

  useEffect(() => {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'pdfTextSelected': {
        console.log('[background] PDF text selected:', message.text);
        break;
      }
      case 'addInstance': {
        console.log("Instance added", message);
        dispatch({
          actionType: "addInstance",
          schemaId: message.schemaId,
          classId: message.classId,
          instance: {
            id: generateId(),
            instanceType: "text",
            text: (message.text as string),
            range: null,
            coords: (message.coords as PdfBox[]) || null,
            pdfUrl: (message.pdfUrl as string) || '',
          },
        });
        break;
      }
      case 'deleteInstance': {
        console.log("Instance deleted", message);
        dispatch({
          actionType: "deleteInstance",
          classId: message.classId,
          instanceId: message.highlightId,
        });
        break;
      }
      case "mlProgress": {
        console.log("[sidebar] MLProgress Event!", message);
        setLlmLoaded({stage: message.stage, progress: message.progress, message: message.message});
        break
      }
      case "annotationResults": {
        console.log("[sidebar] Received annotation results:", message.annotations?.length);
        if (message.annotations && message.requestId) {
          storeMlAnnotationRun(APP_CONFIG.indexedDBConfig, {
            id: message.requestId,
            pdfUrl: '',
            schemaId: activeSchema?.id || '',
            annotations: message.annotations,
            createdAt: Date.now(),
          }).catch(err => console.error('[sidebar] Failed to store ML annotations:', err));
        }
        break;
      }

      default: {
        console.log("Unhandled message", message);
      }

    }
  });

  }, []);

  // post activeSchema to background script
  useEffect(() => {
    chrome.runtime.sendMessage({
      type: "setActiveSchema",
      schema: activeSchema,
    })
  });



  return (
      <>
        <ModelControls status={llmLoaded.stage} progress={llmLoaded.progress} message={llmLoaded.message} activeSchema={activeSchema}/>
    <Tabs>
      {schemas.map((schema) => (
        <TabItem key={schema.name} title={schema.name}>
          <Button outline className="h-6 mr-1, ml-1" onClick={() => dispatch({
            actionType: "addClass",
            schemaId: schema.id,
            classInfo: {
              id: generateId(),
              name: "New Class",
              description: "",
              instances: []
            }
          })}>
            <PiListPlus />
            Add new class
          </Button>
          <ul>
            {schema.classes.map((sc) => (
              <SchemaClassViewer
                key={sc.id}
                schemaId={schema.id}
                schemaClass={sc}
                dispatch={dispatch}
              />
            ))}
          </ul>
        </TabItem>
      ))}
    </Tabs>
      </>
  );
}
