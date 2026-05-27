import { SchemaClassViewer } from "@/components/SchemaClassViewer";

import { Button } from "@/components/ui/button";
import { PiListPlus } from "react-icons/pi";
import { Schema } from "@/lib/definitions";
import { SchemaAction } from "@/lib/schema-reducer.ts";
import {createNewClass} from "@/lib/utils.ts";

interface SchemaViewerProps {
  schema: Schema;
  dispatch: (action: SchemaAction) => void;
}

export function SchemaViewer({ schema, dispatch}: SchemaViewerProps) {

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto min-h-0">
            <Button variant="outline" className="h-6 mr-1 ml-1" onClick={() => dispatch({
              actionType: "addClass",
              schemaId: schema.id,
              classInfo: createNewClass("New Class", "This text describes what this class is.", [])
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
      </div>
    </div>
  );
}
