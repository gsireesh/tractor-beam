import { Instance, Schema, VisualBlock } from '@/lib/definitions.ts';

export const DEFAULT_NER_SYSTEM_PROMPT = `You are performing NER on text that will be given to you in chat messages. The schema will be given to you later in this message.

For each chat message received, return the original text of the chat message, but surround named entities with XML tags, where the tag name indicates the class of the named entity. For instance, if the schema contains person and date classes, your input/output pair would be:
Input: "Pierre Vinken, 61 years old, will join the board as a nonexecutive director Nov. 29."
Output: "<PER>Pierre Vinken</PER>, 61 years old, will join the board as a nonexecutive director <DATE>Nov. 29</DATE>"

Return ONLY the annotated text. Do not add any explanation or commentary.
`;

export function selectExamples<T>(instances: T[]) {
  if (instances.length > 0) {
    return instances.slice(0, 3);
  } else {
    return [];
  }
}

export function abbreviateClassName(className: string) {
  const abbreviated_parts = className.split(' ').map((part) => part.slice(0, 3).toUpperCase());
  return abbreviated_parts.join('_');
}

export function constructSchemaNERPrompt(schema: Schema) {
  const schemaStrings = schema.classes.map((schemaClass) => {
    const positiveExamples = selectExamples(
      schemaClass.instances
        .filter((instance: Instance) => instance.positiveExample)
        .map((instance) => instance.text),
    );
    const negativeExamples = selectExamples(
      schemaClass.instances
        .filter((instance: Instance) => !instance.positiveExample)
        .map((instance) => instance.text),
    );

    const abbreviatedClassName = abbreviateClassName(schemaClass.name);

    return `${schemaClass.name} (${abbreviatedClassName}): ${schemaClass.description}\nPositive examples: ${positiveExamples.join(', ')}\nNegative examples: ${negativeExamples.join(', ')}`;
  });

  // Task-global instructions (document type, domain conventions, ...) are
  // schema-scoped freetext. Inject only when non-empty so a blank field adds
  // nothing to the prompt. Sits between the fixed system prompt and the schema
  // so it stays inside the cached system-prompt prefix.
  const instructions = schema.instructions?.trim();
  const instructionsBlock = instructions ? `\n\nContext for this project:\n\n${instructions}` : '';

  const schemaNERPrompt = `${DEFAULT_NER_SYSTEM_PROMPT}${instructionsBlock}\n\nThe schema is as follows:\n\n${schemaStrings.join('\n\n')}`;
  console.log('[prompting] Constructed Schema NER Prompt:', schemaNERPrompt);
  return schemaNERPrompt;
}

export function formatBlocksForNer(blocks: VisualBlock[]): string {
  return blocks
    .map((block) => `[BLOCK:${block.blockId}]\n${block.text}\n[/BLOCK:${block.blockId}]`)
    .join('\n\n');
}
