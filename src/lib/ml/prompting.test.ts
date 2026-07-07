import { describe, it, expect } from 'vitest';
import { constructSchemaNERPrompt, DEFAULT_NER_SYSTEM_PROMPT } from './prompting';
import type { Schema } from '@/lib/definitions.ts';

const baseSchema: Schema = {
  id: 's1',
  name: 'Invoices',
  classes: [{ id: 'c1', name: 'Vendor', description: 'The company being paid', color: '#000', instances: [] }],
};

describe('constructSchemaNERPrompt — task-global instructions', () => {
  it('omits the instructions block when instructions are absent', () => {
    const prompt = constructSchemaNERPrompt(baseSchema);
    expect(prompt).toContain(DEFAULT_NER_SYSTEM_PROMPT);
    expect(prompt).not.toContain('Context for this project');
  });

  it('omits the instructions block when instructions are blank/whitespace', () => {
    const prompt = constructSchemaNERPrompt({ ...baseSchema, instructions: '   \n  ' });
    expect(prompt).not.toContain('Context for this project');
  });

  it('injects instructions ahead of the schema when present', () => {
    const prompt = constructSchemaNERPrompt({
      ...baseSchema,
      instructions: 'These are invoices. Dates are DD/MM/YYYY.',
    });
    expect(prompt).toContain('Context for this project:\n\nThese are invoices. Dates are DD/MM/YYYY.');
    // Instructions land between the fixed system prompt and the schema listing.
    expect(prompt.indexOf('Context for this project')).toBeGreaterThan(
      prompt.indexOf(DEFAULT_NER_SYSTEM_PROMPT),
    );
    expect(prompt.indexOf('Context for this project')).toBeLessThan(
      prompt.indexOf('The schema is as follows'),
    );
  });
});
