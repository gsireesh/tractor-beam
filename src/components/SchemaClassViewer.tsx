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
  // Local drafts so name/description can commit on blur instead of dispatching
  // every keystroke. A controlled input pinned to the prop with no onChange would
  // revert each keystroke; the draft is where the in-progress text lives.
  const [nameDraft, setNameDraft] = useState<string>(schemaClass.name);
  const [descriptionDraft, setDescriptionDraft] = useState<string>(schemaClass.description);

  // The description textarea is always mounted, so useState would pin it to the
  // mount-time value — adopt external changes the same way the instance notes do.
  useEffect(() => {
    setDescriptionDraft(schemaClass.description);
  }, [schemaClass.description]);

  const commitName = () => {
    if (nameDraft !== schemaClass.name) {
      dispatch({
        actionType: 'updateClass',
        schemaId,
        classId: schemaClass.id,
        classInfo: { ...schemaClass, name: nameDraft },
      });
    }
  };

  // Close + commit the title editor on an outside click. blur is unreliable here:
  // the input is transient and relies on autoFocus, and an outside click that
  // doesn't move focus never fires it. A document mousedown is focus-independent —
  // same pattern as the SchemaHeader title editor. Only armed while editing.
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!titleEditable) return;
    const handleOutside = (e: MouseEvent) => {
      if (titleRef.current && !titleRef.current.contains(e.target as Node)) {
        commitName();
        setTitleEditable(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleEditable, nameDraft, schemaClass, schemaId, dispatch]);

  const commitDescription = () => {
    if (descriptionDraft !== schemaClass.description) {
      dispatch({
        actionType: 'updateClass',
        schemaId,
        classId: schemaClass.id,
        classInfo: { ...schemaClass, description: descriptionDraft },
      });
    }
  };

  const { pdfUrl } = useDrawerContext();
  const currentPDFInstances = useMemo(
    () => schemaClass.instances.filter((instance) => instance.pdfUrl === pdfUrl),
    [schemaClass, pdfUrl],
  );

  function toggleTitleEditable() {
    if (!titleEditable) {
      // Reseed the draft from the live name for this edit session.
      setNameDraft(schemaClass.name);
      setTitleEditable(true);
    }
  }

  const bodyColor = rgbaToHex(schemaClass.color);
  const borderColor = rgbaToHex(schemaClass.color, 1.0);

  return (
    <div
      className="border-1 rounded-lg mx-1 my-2 p-2 shadow-sm bg-[var(--tb-fill)]"
      style={{ ['--tb-fill' as string]: bodyColor, borderColor: borderColor }}
    >
      <div className="flex flex-row justify-between align-baseline">
        <h1 ref={titleRef} className="size-6 mb-4 w-fit text-base" onClick={toggleTitleEditable}>
          {titleEditable ? (
            <input
              autoFocus
              className="border-2 bg-card rounded-lg"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
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
                        className={`h-6 w-6 rounded-full border border-border transition-transform hover:scale-110 ${schemaClass.color === color ? 'ring-2 ring-offset-1 ring-ring' : ''}`}
                        style={{ backgroundColor: rgbaToHex(color, 1.0) }}
                      />
                    ))}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
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
          className="block p-0.5 w-4/5 border-1 rounded-lg bg-card"
          style={{ borderColor: borderColor }}
          autoFocus={false}
          rows={4}
          value={descriptionDraft}
          onChange={(e) => setDescriptionDraft(e.target.value)}
          onBlur={commitDescription}
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
