import { describe, it, expect } from 'vitest';
import { runName, schemaName } from '@/lib/friendly-name.ts';

// The scheme's whole point: part of speech encodes the type. A run is an event
// (adverb + past-tense verb); a schema version is a thing (adjective + noun). We
// assert that structural contract over many samples rather than exact strings.
describe('friendly-name', () => {
  it('runName is adverb-<past-tense-verb>', () => {
    for (let i = 0; i < 100; i++) {
      const parts = runName().split('-');
      expect(parts).toHaveLength(2);
      expect(parts[0]).toMatch(/^[a-z]+$/); // adverb
      expect(parts[1]).toMatch(/^[a-z]+$/);
      expect(parts[1].endsWith('ed')).toBe(true); // verb, past tense
    }
  });

  it('schemaName is adjective-noun (noun is not a past-tense verb)', () => {
    for (let i = 0; i < 100; i++) {
      const parts = schemaName().split('-');
      expect(parts).toHaveLength(2);
      expect(parts[0]).toMatch(/^[a-z]+$/); // adjective
      expect(parts[1]).toMatch(/^[a-z]+$/); // noun
      expect(parts[1].endsWith('ed')).toBe(false);
    }
  });
});
