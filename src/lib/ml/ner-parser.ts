import type { VisualBlock, MlAnnotation, PdfBox } from '@/lib/definitions';
import type { Schema } from '@/lib/definitions';
import { abbreviateClassName } from '@/lib/ml/prompting';

function extractEntities(
  content: string,
  schema: Schema,
): { text: string; className: string; classId: string }[] {
  const entities: { text: string; className: string; classId: string }[] = [];

  // Build tag-to-class lookup from schema
  const tagToClass = new Map<string, { className: string; classId: string }>();
  for (const cls of schema.classes) {
    const tag = abbreviateClassName(cls.name);
    tagToClass.set(tag.toUpperCase(), { className: cls.name, classId: cls.id });
    console.log(`[ner-parser] Registered tag <${tag}> for class "${cls.name}"`);
  }

  // Match any XML-like tags in the output, then look up against schema
  const anyTagPattern = /<([A-Z][A-Z0-9_]*)>(.*?)<\/\1>/gi;
  let match;
  while ((match = anyTagPattern.exec(content)) !== null) {
    const foundTag = match[1].toUpperCase();
    const cls = tagToClass.get(foundTag);
    if (cls) {
      entities.push({ text: match[2], className: cls.className, classId: cls.classId });
    } else {
      console.log(`[ner-parser] Unknown tag <${match[1]}> with text "${match[2]}" — not in schema`);
    }
  }

  return entities;
}

function findEntityCoords(
  entityText: string,
  block: VisualBlock,
  searchFrom: number,
): { coords: PdfBox[]; endIndex: number } | null {
  const startChar = block.text.indexOf(entityText, searchFrom);
  if (startChar === -1) return null;
  const endChar = startChar + entityText.length;

  const coords: PdfBox[] = [];
  for (let i = 0; i < block.itemOffsets.length; i++) {
    const itemStart = block.itemOffsets[i];
    const item = block.items[i];
    const itemEnd = itemStart + item.str.length;
    if (itemEnd > startChar && itemStart < endChar) {
      // Clip box to the portion of the item that overlaps the entity
      const charLen = item.str.length;
      if (charLen === 0) continue;
      const overlapStart = Math.max(startChar, itemStart) - itemStart;
      const overlapEnd = Math.min(endChar, itemEnd) - itemStart;
      const fracLeft = overlapStart / charLen;
      const fracRight = overlapEnd / charLen;
      coords.push({
        ...item.box,
        left: item.box.left + item.box.width * fracLeft,
        width: item.box.width * (fracRight - fracLeft),
      });
    }
  }

  return { coords: mergeAdjacentBoxes(coords), endIndex: endChar };
}

function mergeAdjacentBoxes(boxes: PdfBox[]): PdfBox[] {
  if (boxes.length <= 1) return boxes;

  const sorted = [...boxes].sort((a, b) => a.top - b.top || a.left - b.left);
  const merged: PdfBox[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = sorted[i];
    if (Math.abs(curr.top - prev.top) < 0.005 && curr.pageNumber === prev.pageNumber) {
      const right = Math.max(prev.left + prev.width, curr.left + curr.width);
      prev.width = right - prev.left;
      prev.height = Math.max(prev.height, curr.height);
    } else {
      merged.push(curr);
    }
  }

  return merged;
}

/**
 * Parse NER output for a single visual block.
 * The model returns the block text with entity XML tags inline.
 */
export function parseSingleBlockNerOutput(
  nerOutput: string,
  block: VisualBlock,
  schema: Schema,
  pdfUrl: string,
): MlAnnotation[] {
  const entities = extractEntities(nerOutput, schema);
  const annotations: MlAnnotation[] = [];
  let searchFrom = 0;

  console.log(`[ner-parser] Block ${block.blockId}: found ${entities.length} entities in output`);

  for (const entity of entities) {
    const result = findEntityCoords(entity.text, block, searchFrom);
    if (!result || result.coords.length === 0) {
      console.log(`[ner-parser] Could not locate "${entity.text}" in block text`);
      continue;
    }

    annotations.push({
      id: crypto.randomUUID(),
      text: entity.text,
      className: entity.className,
      classId: entity.classId,
      coords: result.coords,
      pdfUrl,
      blockId: block.blockId,
      createdAt: Date.now(),
    });

    searchFrom = result.endIndex;
  }

  return annotations;
}
