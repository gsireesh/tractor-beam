import { SchemaClassViewer } from "@/components/SchemaClassViewer";

import { Button } from "@/components/ui/button";
import { PiListPlus, PiTable } from "react-icons/pi";
import {Schema, SchemaAction} from "@/lib/definitions";
import {createNewClass} from "@/lib/utils.ts";

interface SchemaViewerProps {
  schema: Schema;
  dispatch: (action: SchemaAction) => void;
}

export function SchemaViewer({ schema, dispatch}: SchemaViewerProps) {
  // activeSchema can be undefined for a beat before schemas load (or if the store
  // is empty); render nothing rather than dereferencing schema.classes.
  if (!schema) return null;

  return (
      <div className="flex-1 overflow-y-auto min-h-0">
            <Button variant="outline" className="h-6 mr-1 ml-1" onClick={() => dispatch({
              actionType: "addClass",
              schemaId: schema.id,
              classInfo: createNewClass("New Class", "This text describes what this class is.", [], schema.classes.map(c => c.color))
            })}>
              <PiListPlus />
              Add new class
            </Button>
            <Button variant="outline" className="h-6 mr-1 ml-1" onClick={() =>
              browser.runtime.sendMessage({ type: "openSchemaManager", schemaId: schema.id })
            }>
              <PiTable />
              Open Schema Manager
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
  );
}
