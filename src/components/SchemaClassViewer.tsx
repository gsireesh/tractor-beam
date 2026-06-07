import { SchemaAction, SchemaClass } from '@/lib/definitions';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu.tsx';
import { MoreVertical, Palette, PencilLine, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { rgbaToHex } from '@/lib/utils.ts';
import { HIGHLIGHT_PALETTE } from '@/lib/highlight-palette.ts';
import { HueColorPicker } from '@/components/HueColorPicker.tsx';
import { IconButton } from '@/components/IconButton.tsx';
import { ConfirmedInstanceViewer } from '@/components/ConfirmedInstanceViewer.tsx';
import { useDrawerContext } from '@/contexts/DrawerContext.tsx';

function useClickOutside<T extends HTMLElement>(callback: () => void) {
  const ref = useRef<T>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [callback]);

  return ref;
}

export function SchemaClassViewer({
  schemaId,
  schemaClass,
  dispatch,
}: {
  schemaId: string;
  schemaClass: SchemaClass;
  dispatch: (action: SchemaAction) => void;
}) {
  const [titleEditable, setTitleEditable] = useState<boolean>(false);
  const titleRef = useClickOutside<HTMLHeadingElement>(() => {
    setTitleEditable(false);
  });
  const { pdfUrl } = useDrawerContext();
  const currentPDFInstances = useMemo(
    () => schemaClass.instances.filter((instance) => instance.pdfUrl === pdfUrl),
    [schemaClass, pdfUrl],
  );

  function toggleTitleEditable() {
    if (!titleEditable) {
      setTitleEditable(true);
    }
  }

  const bodyColor = rgbaToHex(schemaClass.color);
  const borderColor = rgbaToHex(schemaClass.color, 1.0);

  return (
    <div
      className="border-1 rounded-lg mx-1 my-2 p-2 shadow-sm"
      style={{ backgroundColor: bodyColor, borderColor: borderColor }}
    >
      <div className="flex flex-row justify-between align-baseline">
        <h1 ref={titleRef} className="size-6 mb-4 w-fit text-base" onClick={toggleTitleEditable}>
          {titleEditable ? (
            <input
              autoFocus
              className="border-2 bg-white"
              value={schemaClass.name}
              onChange={(e) =>
                dispatch({
                  actionType: 'updateClass',
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
            <div className="flex flex-row group">
              <span>{schemaClass.name}</span>
              <PencilLine strokeWidth={1} size={'16px'} className="invisible group-hover:visible" />
            </div>
          )}
        </h1>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <IconButton title="Class Actions" icon={MoreVertical} size={'icon'} />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Palette strokeWidth={1} size={'1em'} />
                  Change Color
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <div className="grid grid-cols-4 gap-1.5 p-1">
                    {HIGHLIGHT_PALETTE.map((color) => (
                      <button
                        key={color}
                        type="button"
                        title={color}
                        onClick={() =>
                          dispatch({
                            actionType: 'updateClass',
                            schemaId: schemaId,
                            classId: schemaClass.id,
                            classInfo: { ...schemaClass, color: color },
                          })
                        }
                        className={`h-6 w-6 rounded-full border border-black/10 transition-transform hover:scale-110 ${schemaClass.color === color ? 'ring-2 ring-offset-1 ring-black/60' : ''}`}
                        style={{ backgroundColor: rgbaToHex(color, 1.0) }}
                      />
                    ))}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs font-normal text-black/60">
                    Custom hue
                  </DropdownMenuLabel>
                  <HueColorPicker
                    value={schemaClass.color}
                    onChange={(color) =>
                      dispatch({
                        actionType: 'updateClass',
                        schemaId: schemaId,
                        classId: schemaClass.id,
                        classInfo: { ...schemaClass, color: color },
                      })
                    }
                  />
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem
                variant="destructive"
                onClick={() =>
                  dispatch({
                    actionType: 'deleteClass',
                    schemaId: schemaId,
                    classId: schemaClass.id,
                  })
                }
              >
                <Trash2 strokeWidth={1} size={'1em'} />
                Delete Class
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <label className="block text-sm">
        Class Description:
        <textarea
          className="block p-0.5 w-4/5 border-1 rounded-lg bg-white"
          style={{ borderColor: borderColor }}
          autoFocus={false}
          rows={4}
          value={schemaClass.description}
          onChange={(event) => {
            dispatch({
              actionType: 'updateClass',
              schemaId: schemaId,
              classId: schemaClass.id,
              classInfo: {
                ...schemaClass,
                ...{ description: event.target.value },
              },
            });
          }}
        />
      </label>
      <Accordion type="single" collapsible>
        <AccordionItem value="instances">
          <AccordionTrigger>Instances</AccordionTrigger>
          <AccordionContent>
            {currentPDFInstances.length ? (
              currentPDFInstances.map((instance) => (
                <ConfirmedInstanceViewer
                  key={instance.id}
                  schemaId={schemaId}
                  classId={schemaClass.id}
                  instanceId={instance.id}
                  coords={instance.coords}
                />
              ))
            ) : (
              <p>No instances annotated on the current PDF.</p>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
