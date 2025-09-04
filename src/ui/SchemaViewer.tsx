import { useImmerReducer } from "use-immer";

import { SchemaClassViewer } from "@/ui/SchemaClassViewer";

import { Button, TabItem, Tabs } from "flowbite-react";
import { PiListPlus } from "react-icons/pi";
import { Schema } from "@/lib/definitions";
import { schemasReducer } from "@/lib/schema-reducer.ts";

export function SchemaViewer({
  schemas: initialSchemas,
}: {
  schemas: Schema[];
}) {
  const [schemas, dispatch] = useImmerReducer(schemasReducer, initialSchemas);

  return (
    <Tabs>
      {schemas.map((schema) => (
        <TabItem key={schema.name} title={schema.name}>
          <Button outline className="h-6 mr-1, ml-1">
            <PiListPlus />
            Add new class
          </Button>
          <ul>
            {schema.classes.map((sc) => (
              <SchemaClassViewer
                key={sc.id}
                schemaClass={sc}
                dispatch={dispatch}
              />
            ))}
          </ul>
        </TabItem>
      ))}
    </Tabs>
  );
}
