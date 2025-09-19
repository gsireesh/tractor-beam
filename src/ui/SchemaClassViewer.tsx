import { SchemaClass } from "@/lib/definitions";
import { SchemaAction } from "@/lib/schema-reducer.ts";
import { Button } from "flowbite-react";
import {PiCrop, PiHighlighterCircle, PiPencilSimple} from "react-icons/pi";
import { useEffect, useRef, useState } from "react";

function useClickOutside<T extends HTMLElement>(callback: () => void) {
  const ref = useRef<T>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [callback]);

  return ref;
}

export function SchemaClassViewer({
  schemaClass,
  dispatch,
}: {
  schemaClass: SchemaClass;
  dispatch: (action: SchemaAction) => void;
}) {
  const [titleEditable, setTitleEditable] = useState<boolean>(false);
  const titleRef = useClickOutside<HTMLHeadingElement>(() => {
    setTitleEditable(false);
  });

  function toggleTitleEditable() {
    if (!titleEditable) {
      setTitleEditable(true);
    }
  }

  return (
    <div className="border-2 border-blue-500 rounded-lg m-4 p-4">
      <h1
        ref={titleRef}
        className="size-6 mb-4 overflow-scroll w-fit"
        onClick={toggleTitleEditable}
      >
        {titleEditable ? (
          <input
            autoFocus
            className="border-2"
            value={schemaClass.name}
            onChange={(e) =>
              dispatch({
                actionType: "updateClass",
                schemaId: "0",
                classId: schemaClass.id,
                classInfo: {
                  ...schemaClass,
                  ...{ name: e.target.value },
                },
              })
            }
          />
        ) : (
          <div className="flex flex-row group"><span>{schemaClass.name}</span><PiPencilSimple className="invisible group-hover:visible"/></div>
        )}
      </h1>
      <label className="block text-sm">
        Class Description:
        <textarea
          className="block p-0.5 w-4/5 border-2 border-blue-500 rounded-lg"
          autoFocus={false}
          rows={4}
          value={schemaClass.description}
          onChange={(event) => {dispatch({
            actionType: "updateClass",
            schemaId: "0",
            classId: schemaClass.id,
            classInfo: {
              ...schemaClass,
              ...{description: event.target.value}
            }
          })}}
        />
      </label>
      <div className=" mt-2 flex justify-end">
        <p className="pr-1">Annotate: </p>
        <Button outline className="h-6 mr-1, ml-1">
          <PiCrop />
        </Button>
        <Button outline className="h-6 mr-1 ml-1">
          <PiHighlighterCircle />
        </Button>
      </div>
    </div>
  );
}
