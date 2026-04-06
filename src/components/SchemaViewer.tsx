import { useState } from "react";
import { SchemaClassViewer } from "@/components/SchemaClassViewer";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PiListPlus } from "react-icons/pi";
import { Schema } from "@/lib/definitions";
import { SchemaAction } from "@/lib/schema-reducer.ts";
import { generateId, generateRandomRgbColor } from "@/lib/utils.ts";
import { ModelControls } from "@/components/ModelControls.tsx";

interface SchemaViewerProps {
  schemas: Schema[];
  dispatch: (action: SchemaAction) => void;
  llmStatus: { stage: string; progress: string; message: string };
  onActiveSchemaChange: (schemaId: string) => void;
}

export function SchemaViewer({ schemas, dispatch, llmStatus, onActiveSchemaChange }: SchemaViewerProps) {
  const [activeTabName, setActiveTabName] = useState(schemas[0]?.name ?? '');

  function handleTabChange(name: string) {
    setActiveTabName(name);
    const schema = schemas.find(s => s.name === name);
    if (schema) onActiveSchemaChange(schema.id);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto min-h-0">
        <Tabs value={activeTabName} onValueChange={handleTabChange}>
          <TabsList>
            {schemas.map((schema) => (
              <TabsTrigger key={schema.name} value={schema.name}>
                {schema.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {schemas.map((schema) => (
            <TabsContent key={schema.name} value={schema.name}>
              <Button variant="outline" className="h-6 mr-1 ml-1" onClick={() => dispatch({
                actionType: "addClass",
                schemaId: schema.id,
                classInfo: {
                  id: generateId(),
                  name: "New Class",
                  description: "",
                  color: generateRandomRgbColor(),
                  instances: []
                }
              })}>
                <PiListPlus />
                Add new class
              </Button>
              <ul className="list-none p-0 m-0">
                {schema.classes.map((sc) => (
                  <SchemaClassViewer
                    key={sc.id}
                    schemaId={schema.id}
                    schemaClass={sc}
                    dispatch={dispatch}
                  />
                ))}
              </ul>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <div className="shrink-0">
        <ModelControls status={llmStatus.stage} progress={llmStatus.progress} message={llmStatus.message} />
      </div>
    </div>
  );
}
