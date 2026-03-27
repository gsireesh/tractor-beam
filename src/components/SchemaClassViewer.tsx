import { SchemaClass } from "@/lib/definitions";
import { SchemaAction } from "@/lib/schema-reducer.ts";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu.tsx";
import {Settings, PencilLine, Palette, Trash2} from 'lucide-react';
import { useEffect, useRef, useState } from "react";
import {cn, rgbaToHex} from '@/lib/utils.ts';

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
  schemaId,
  schemaClass,
  dispatch,
}: {
  schemaId: string,
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

  const bodyColor = rgbaToHex(schemaClass.color);
  const borderColor = rgbaToHex(schemaClass.color, 1.0);

  return (
    <div className="border-2 rounded-lg mx-1 my-2 p-2 shadow-sm" style={{ backgroundColor: bodyColor,  borderColor: borderColor}}>
    <div className="flex flex-row justify-between">
      <h1
        ref={titleRef}
        className="size-6 mb-4 w-fit"
        onClick={toggleTitleEditable}
      >
        {titleEditable ? (
          <input
            autoFocus
            className="border-2 bg-white"
            value={schemaClass.name}
            onChange={(e) =>
              dispatch({
                actionType: "updateClass",
                schemaId: schemaId,
                classId: schemaClass.id,
                classInfo: {
                  ...schemaClass,
                  ...{ name: e.target.value },
                },
              })
            }
          />
        ) : (
          <div className="flex flex-row group"><span>{schemaClass.name}</span><PencilLine strokeWidth={1} size={"16px"} className="invisible group-hover:visible"/></div>

        )}
      </h1>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost"><Settings strokeWidth={1} size='24px'/></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent >
          <DropdownMenuGroup>
            {/*<DropdownMenuItem><Palette strokeWidth={1} size={'1em'}/>Change Color</DropdownMenuItem>*/}
            <DropdownMenuItem variant="destructive" onClick={() =>
              dispatch({
                actionType: "deleteClass",
                schemaId: schemaId,
                classId: schemaClass.id
              })
            }>
              <Trash2 strokeWidth={1} size={'1em'}/>Delete Class
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>

      </DropdownMenu>


    </div>
      <label className="block text-sm">
        Class Description:
        <textarea
          className="block p-0.5 w-4/5 border-2 rounded-lg bg-white"
          style={{borderColor: borderColor}}
          autoFocus={false}
          rows={4}
          value={schemaClass.description}
          onChange={(event) => {dispatch({
            actionType: "updateClass",
            schemaId: schemaId,
            classId: schemaClass.id,
            classInfo: {
              ...schemaClass,
              ...{description: event.target.value}
            }
          })}}
        />
      </label>
        <Accordion type="single" collapsible>
            <AccordionItem value="instances">
                <AccordionTrigger>Instances</AccordionTrigger>
                <AccordionContent>
                    {
                        schemaClass.instances.length ? (schemaClass.instances.map((instance) => <p key={instance.text}>{instance.text}</p>)) : <p>Empty.</p>
                    }
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    </div>
  );
}
