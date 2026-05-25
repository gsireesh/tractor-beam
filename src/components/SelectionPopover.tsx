import { useState, useLayoutEffect, useRef, useEffect } from 'react';
import {Instance, PdfBox, SchemaClass} from "@/lib/definitions.ts";
import {createNewClass, generateId, rgbaToHex} from "@/lib/utils.ts";
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import {Textarea} from "@/components/ui/textarea.tsx";

interface SelectionPopoverProps {
  text: string;
  pdfUrl: string;
  position: { top: number; left: number; bottom: number };
  coords?: PdfBox[] | null;
  onClose: () => void;
  onAddInstance: (schemaId: string, classId: string, instance: Instance) => void;
  onAddClass: (schemaId: string, schemaClass: SchemaClass) => void;
}

const accentColorFallback = "rgba(0,0,0,0)";
const CREATE_ITEM_PREFIX = "__create__:";

// Action button slot — kept constant across hover state to prevent layout jitter.
// Children use flex-1, so flexbox handles the half-vs-full geometry implicitly.
const ACTION_SLOT_WIDTH_PX = 100;
const ACTION_GAP_PX = 4;

// Popover envelope. Must be wide enough that the action slot above + combobox +
// padding + gap all fit comfortably; bumping the slot width requires bumping these.
const POPOVER_MIN_WIDTH_PX = 320;
const POPOVER_MAX_WIDTH_PX = 400;

export function SelectionPopover({
  text,
  pdfUrl,
  position,
  coords,
  onClose,
  onAddInstance,
  onAddClass,
}: SelectionPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState<{ top: number; left: number; showAbove: boolean } | null>(null);
  const activeSchema = window.TractorBeamDrawer?.getActiveSchema() ?? null;
  const [selectedClass, setSelectedClass] = useState<SchemaClass | null>(
    () => activeSchema?.classes?.[0] ?? null,
  );
  const lastValidClassRef = useRef<SchemaClass | null>(
    activeSchema?.classes?.[0] ?? null,
  );
  if (selectedClass) lastValidClassRef.current = selectedClass;
  const [inputValue, setInputValue] = useState<string>(
    activeSchema?.classes?.[0]?.name ?? "",
  );
  const [addButtonHovered, setAddButtonHovered] = useState<boolean>(false);
  const [notesValue, setNotesValue] = useState<string|null>(null);

  const trimmedInput = inputValue.trim();
  const hasExactMatch =
    (activeSchema?.classes.some((c) => c.name.toLowerCase() === trimmedInput.toLowerCase()) ?? false) ||
    selectedClass?.name.toLowerCase() === trimmedInput.toLowerCase();
  const showCreateOption = trimmedInput.length > 0 && !hasExactMatch;

  const comboboxItems = (() => {
    const names = activeSchema?.classes.map((c) => c.name) ?? [];
    return showCreateOption ? [...names, CREATE_ITEM_PREFIX + trimmedInput] : names;
  })();

  const comboboxFilter = (itemValue: string, query: string) => {
    if (itemValue.startsWith(CREATE_ITEM_PREFIX)) return true;
    return itemValue.toLowerCase().includes(query.toLowerCase());
  };

  // the instance to be added
  const currentInstance: Instance = {
      id: generateId(),
      instanceType: "text",
      text: text,
      range: null,
      coords: coords ?? null,
      pdfUrl: pdfUrl,
      positiveExample: true,
      notes: null,
  };

  const submitInstance = (positiveExample: boolean) => {
    if (!activeSchema || !selectedClass) return;
    const instance: Instance = { ...currentInstance, positiveExample, notes: notesValue };
    if (activeSchema.classes.some((c) => c.id === selectedClass.id)) {
      onAddInstance(activeSchema.id, selectedClass.id, instance);
    } else {
      onAddClass(activeSchema.id, { ...selectedClass, instances: [instance] });
    }
  };


  useLayoutEffect(() => {
    if (!popoverRef.current) return;

    const popoverWidth = 280;
    const popoverHeight = 180;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = position.bottom + 10;
    let left = position.left;
    let showAbove = false;

    // Keep within horizontal bounds
    if (left + popoverWidth > viewportWidth - 20) {
      left = viewportWidth - popoverWidth - 20;
    }
    if (left < 20) {
      left = 20;
    }

    // Show above if would overflow bottom
    if (top + popoverHeight > viewportHeight) {
      top = position.top - popoverHeight - 10;
      showAbove = true;
    }

    setAdjustedPosition({ top, left, showAbove });
  }, [position]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDocMouseDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onDocMouseDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onDocMouseDown);
    };
  }, [onClose]);

  const accentColor = lastValidClassRef.current?.color ?? accentColorFallback;

  return (
    <div
      ref={popoverRef}
      className={`absolute z-[100000] font-sans text-sm ${adjustedPosition?.showAbove ? 'popover-above' : ''}`}
      style={{
        top: adjustedPosition?.top ?? 0,
        left: adjustedPosition?.left ?? 0,
        visibility: adjustedPosition ? 'visible' : 'hidden',
      }}
    >
      {/* Arrow */}
      <div
        className={`absolute left-5 w-0 h-0 border-l-8 border-r-8 border-l-transparent border-r-transparent ${
          adjustedPosition?.showAbove
            ? 'bottom-[-8px] border-t-8 border-t-white dark:border-t-gray-800'
            : 'top-[-8px] border-b-8'
        }`}
        style={!adjustedPosition?.showAbove ? { borderBottomColor: accentColor } : undefined}
      />

      {/* Content */}
      <div className="bg-white">
      <div className="dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700"
      style={{
        backgroundColor: accentColor,
        minWidth: POPOVER_MIN_WIDTH_PX,
        maxWidth: POPOVER_MAX_WIDTH_PX,
      }}
      >

        {/* Body */}
        <div className="p-3">
          <div
            className="bg-gray-100 dark:bg-gray-700 rounded px-2.5 py-2 mb-3 text-sm text-gray-700 dark:text-gray-200 max-h-20 overflow-y-auto break-words border-l-3 italic"
            style={{ borderLeftColor: accentColor }}
          >
            {text}
          </div>
          <Textarea className="bg-white rounded px-2.5 py-2 mb-3 text-sm " placeholder={"Notes..."} onChange={(e) => {setNotesValue(e.target.value)}}/>
          <div className="flex gap-2">
            <Combobox
              items={comboboxItems}
              value={selectedClass?.name ?? ""}
              onInputValueChange={(v: string) => setInputValue(v)}
              filter={comboboxFilter}
              onValueChange={(name: string | null) => {
                if (typeof name === "string" && name.startsWith(CREATE_ITEM_PREFIX)) {
                  const newClassName = name.slice(CREATE_ITEM_PREFIX.length);
                  const schemaClass = createNewClass(newClassName, "", []);
                  setSelectedClass(schemaClass);
                } else {
                  setSelectedClass(activeSchema?.classes.find((c) => c.name === name) ?? null);
                }
              }}
            >
              <ComboboxInput
                className="flex-1 bg-white"
                onClick={() => setSelectedClass(null)}
              />
              <ComboboxContent
                container={document.getElementById('tractor-beam-popover-root')}
                positionerClassName="z-[100001]"
              >
                <ComboboxList>
                  {(name: string) => (
                    <ComboboxItem key={name} value={name}>
                      {name.startsWith(CREATE_ITEM_PREFIX)
                        ? `Create new class "${name.slice(CREATE_ITEM_PREFIX.length)}"`
                        : name}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
            <div
              className="flex shrink-0"
              style={{ width: ACTION_SLOT_WIDTH_PX, gap: ACTION_GAP_PX }}
              onMouseEnter={() => setAddButtonHovered(true)}
              onMouseLeave={() => setAddButtonHovered(false)}
            >
              <button
                className="flex-1 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                style={{ backgroundColor: rgbaToHex(accentColor, 1.0) }}
                onClick={() => submitInstance(true)}
                disabled={!selectedClass?.id || !activeSchema}
              >
                {addButtonHovered ? "+" : "Add"}
              </button>
              {addButtonHovered && (
                <button
                  className="flex-1 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                  style={{ backgroundColor: rgbaToHex(accentColor, 1.0) }}
                  onClick={() => submitInstance(false)}
                  disabled={!selectedClass?.id || !activeSchema}
                >
                  −
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}