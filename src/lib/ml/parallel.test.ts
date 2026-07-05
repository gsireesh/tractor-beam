import { describe, it, expect } from 'vitest';
import { parallelMap, type ParallelOutcome } from './parallel';

async function collect<R>(gen: AsyncGenerator<ParallelOutcome<R>>): Promise<ParallelOutcome<R>[]> {
  const out: ParallelOutcome<R>[] = [];
  for await (const o of gen) out.push(o);
  // Settle order isn't input order — sort by index for deterministic assertions.
  return out.sort((a, b) => a.index - b.index);
}

describe('parallelMap', () => {
  it('yields a success outcome per item, carrying the result and index', async () => {
    const outcomes = await collect(parallelMap([1, 2, 3], async (n) => n * 10, 2));
    expect(outcomes).toEqual([
      { index: 0, ok: true, result: 10 },
      { index: 1, ok: true, result: 20 },
      { index: 2, ok: true, result: 30 },
    ]);
  });

  it('surfaces failures instead of dropping them, mapped to the failing index', async () => {
    const outcomes = await collect(
      parallelMap([0, 1, 2, 3], async (n) => {
        if (n % 2 === 0) throw new Error(`boom ${n}`);
        return n * 10;
      }, 2),
    );
    // Every item produces exactly one outcome — none are silently skipped.
    expect(outcomes).toHaveLength(4);
    expect(outcomes[0]).toEqual({ index: 0, ok: false, error: expect.any(Error) });
    expect(outcomes[1]).toEqual({ index: 1, ok: true, result: 10 });
    expect(outcomes[2]).toEqual({ index: 2, ok: false, error: expect.any(Error) });
    expect(outcomes[3]).toEqual({ index: 3, ok: true, result: 30 });
    if (!outcomes[0].ok) expect((outcomes[0].error as Error).message).toBe('boom 0');
  });

  it('stops launching new items once shouldCancel returns true', async () => {
    let started = 0;
    const outcomes = await collect(
      parallelMap(
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        async (n) => {
          started++;
          return n;
        },
        2,
        () => true, // cancel immediately — only the initial `concurrency` items run
      ),
    );
    // The first two (concurrency=2) were launched before the cancel check; no more.
    expect(started).toBe(2);
    expect(outcomes).toHaveLength(2);
  });
});
