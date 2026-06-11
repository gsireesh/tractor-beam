import { type MouseEvent, useEffect, useState } from 'react';
import { Instance, SchemaClass, Signpost } from '@/lib/definitions.ts';
import { generateId, rgbaToHex } from '@/lib/utils.ts';
import { scrollToAnnotation } from '@/lib/pdf-navigation.ts';
import { useDrawerContext } from '@/contexts/DrawerContext.tsx';
import {
  InstancePopoverContent,
  useStableAccentColor,
} from '@/components/popovers/InstancePopoverContent.tsx';

/**
 * A provisional (ML-suggested) annotation. Unlike the confirmed signpost, it has
 * no instance to edit yet — so it carries its own promote state (notes, class
 * selection) and dispatches `addInstance` on Add. Same form UI as the confirmed
 * editor (InstancePopoverContent); same logic as PromoteInstancePopover, inline.
 */
export function ProvisionalHighlightSignpost({ id, classId, coords, text }: Signpost) {
  const { activeSchema, pdfUrl, dispatch, removeMlHighlight } = useDrawerContext();
  const initialClass = activeSchema.classes.find((c) => c.id === classId) ?? null;
  const [selectedClass, setSelectedClass] = useState<SchemaClass | null>(initialClass);
  const [inputValue, setInputValue] = useState<string>(initialClass?.name ?? '');
  const [notesValue, setNotesValue] = useState<string | null>(null);
  const [addButtonHovered, setAddButtonHovered] = useState<boolean>(false);

  const accentColor = useStableAccentColor(selectedClass);

  // Live color preview: track the selected class color on the PDF highlight.
  useEffect(() => {
    if (selectedClass) {
      window.TractorBeamHighlights?.setHighlightColor(id, selectedClass.color);
    }
  }, [selectedClass, id]);

  const submit = (positiveExample: boolean) => {
    if (!selectedClass) {
      return;
    }
    const instance: Instance = {
      id: generateId(),
      instanceType: 'text',
      text: text ?? '',
      coords,
      pdfUrl,
      positiveExample,
      notes: notesValue,
    };
    if (activeSchema.classes.some((c) => c.id === selectedClass.id)) {
      dispatch({
        actionType: 'addInstance',
        schemaId: activeSchema.id,
        classId: selectedClass.id,
        instance,
      });
    } else {
      dispatch({
        actionType: 'addClass',
        schemaId: activeSchema.id,
        classInfo: { ...selectedClass, instances: [instance] },
      });
    }
    // Promoted to a confirmed instance — drop the provisional copy.
    removeMlHighlight(id);
  };

  const handleCardClick = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('input, textarea, button')) {
      return;
    }
    if (coords) {
      scrollToAnnotation(coords);
      window.TractorBeamHighlights?.flashHighlight(id);
    }
  };

  const actionButtons = (
    <div
      className="flex shrink-0 w-full"
      style={{ gap: 4 }}
      onMouseEnter={() => setAddButtonHovered(true)}
      onMouseLeave={() => setAddButtonHovered(false)}
    >
      <button
        className="flex-1 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
        style={{ backgroundColor: rgbaToHex(accentColor, 1.0) }}
        onClick={() => submit(true)}
        disabled={!selectedClass?.id}
      >
        {addButtonHovered ? '+' : 'Add'}
      </button>
      {addButtonHovered && (
        <button
          className="flex-1 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
          style={{ backgroundColor: rgbaToHex(accentColor, 1.0) }}
          onClick={() => submit(false)}
          disabled={!selectedClass?.id}
        >
          −
        </button>
      )}
    </div>
  );

  return (
    <div className="mx-1 my-2 cursor-pointer" onClick={handleCardClick}>
      <div
        className="rounded-lg overflow-hidden border border-dashed bg-[var(--tb-fill)]"
        style={{ ['--tb-fill' as string]: accentColor, borderColor: rgbaToHex(accentColor, 1.0) }}
      >
        <InstancePopoverContent
          text={text ?? ''}
          notesValue={notesValue}
          onNotesChange={setNotesValue}
          selectedClass={selectedClass}
          onSelectedClassChange={setSelectedClass}
          inputValue={inputValue}
          onInputValueChange={setInputValue}
          actionButtons={actionButtons}
          actionSlotWidthPx={100}
          allowCreateClass={true}
          classes={activeSchema.classes}
          accentColor={accentColor}
          pageNumber={coords[0]?.pageNumber}
          comboboxContainer={document.getElementById('tractor-beam-popover-root')}
          comboboxPositionerClassName="z-[100001]"
          closeComboboxOnScroll={true}
        />
      </div>
    </div>
  );
}
