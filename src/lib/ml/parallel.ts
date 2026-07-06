/**
 * Concurrency-limited parallel executor.
 *
 * Runs up to `concurrency` async tasks at once, yielding each outcome as it
 * settles (not necessarily in input order). Failures are *surfaced*, not
 * swallowed: a throwing task yields `{ ok: false, error }` rather than being
 * silently dropped, so the caller can report it (per-block error) and count it
 * (circuit-breaker). Each outcome carries the item's `index`, so the caller can
 * map a failure back to the input that produced it.
 */

/** One settled task: success carries its result, failure carries the thrown error. */
export type ParallelOutcome<R> =
  | { index: number; ok: true; result: R }
  | { index: number; ok: false; error: unknown };

interface IndexedResult<R> {
  index: number;
  result: R | null;
  ok: boolean;
  error?: unknown;
}

export async function indexedWrapper<T, R>(
  f: (item: T) => Promise<R>,
  item: T,
  index: number,
): Promise<IndexedResult<R>> {
  try {
    const result = await f(item);
    return { index, result, ok: true };
  } catch (err) {
    return { index, result: null, ok: false, error: err };
  }
}

/**
 * Process `items` through `fn` with at most `concurrency` in-flight at once.
 * Yields each outcome as it settles (earliest-first, not input order), including
 * failures. Stops launching new items once `shouldCancel` returns true (in-flight
 * items still settle and are yielded).
 */
export async function* parallelMap<T, R>(
  items: T[],
  f: (item: T) => Promise<R>,
  concurrency: number,
  shouldCancel?: () => boolean,
): AsyncGenerator<ParallelOutcome<R>> {
  const active = new Map<number, Promise<IndexedResult<R>>>();

  for (let i = 0; i < Math.min(concurrency, items.length); i++) {
    active.set(i, indexedWrapper(f, items[i], i));
  }

  let nextToLaunch = concurrency;
  while (active.size > 0) {
    const completed = await Promise.race(active.values());
    active.delete(completed.index);
    yield completed.ok
      ? { index: completed.index, ok: true, result: completed.result as R }
      : { index: completed.index, ok: false, error: completed.error };

    if (nextToLaunch < items.length && !shouldCancel?.()) {
      active.set(nextToLaunch, indexedWrapper(f, items[nextToLaunch], nextToLaunch));
      nextToLaunch++;
    }
  }
}
