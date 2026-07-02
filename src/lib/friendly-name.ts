/**
 * Docker-style `word-word` nicknames for runs and schema versions. The part of
 * speech encodes the type so a name alone tells you which it is:
 *   - schema versions  → adjective-noun  (a thing you crafted): `amber-ledger`
 *   - ML runs          → adverb-verb     (a messy pass that happened): `warily-poked`
 *
 * These are display labels over the real keys (requestId / snapshotIndex), so a
 * collision is just two records sharing a nickname — never a data problem.
 */

// Runs: mostly-sensible adverbs with a few loose ones for whimsy, paired with
// "loose riffle-through-the-pages" verbs.
const RUN_ADVERBS = [
  'boldly', 'briskly', 'candidly', 'coolly', 'darkly', 'dreamily', 'exactly', 'fervently',
  'finitely', 'formally', 'gently', 'gleefully', 'heartily', 'horizontally', 'icily', 'instantly',
  'jauntily', 'jovially', 'keenly', 'kindly', 'loosely', 'loyally', 'neatly', 'nosily', 'openly',
  'physically', 'plainly', 'primly', 'quietly', 'richly', 'roughly', 'rudely', 'shyly', 'slightly',
  'slyly', 'specially', 'sternly', 'swiftly', 'tensely', 'upwardly', 'vaguely', 'vastly', 'visibly',
  'warily', 'willfully', 'zestily',
] as const;

const RUN_VERBS = [
  'rummaged', 'riffled', 'thumbed', 'squinted', 'scoured', 'doodled', 'scribbled', 'fumbled',
  'shuffled', 'muddled', 'wrangled', 'poked', 'prodded', 'noodled', 'wandered',
] as const;

// Schema versions: humble, grounded adjective-noun.
const SCHEMA_ADJECTIVES = [
  'amber', 'ashen', 'brass', 'dusty', 'faded', 'little', 'lone', 'mild', 'muted', 'pale', 'plain',
  'quiet', 'rusty', 'sepia', 'slate', 'snug', 'soft', 'spare', 'still', 'tidy', 'umber', 'warm',
  'worn', 'wry',
] as const;

const SCHEMA_NOUNS = [
  'ledger', 'thicket', 'satchel', 'lantern', 'meadow', 'harbor', 'kettle', 'basket', 'drawer',
  'almanac', 'hedge', 'cove', 'loft', 'pantry', 'cellar', 'atlas', 'orchard', 'burrow', 'alcove',
  'mantle', 'trellis', 'cairn', 'willow', 'brook',
] as const;

const pick = <T>(pool: readonly T[]): T => pool[Math.floor(Math.random() * pool.length)];

/** A run nickname, e.g. `warily-poked`. */
export function runName(): string {
  return `${pick(RUN_ADVERBS)}-${pick(RUN_VERBS)}`;
}

/** A schema-version nickname, e.g. `amber-ledger`. */
export function schemaName(): string {
  return `${pick(SCHEMA_ADJECTIVES)}-${pick(SCHEMA_NOUNS)}`;
}
