/**
 * Concurrency-limited parallel executor.
 *
 * Runs up to `concurrency` async tasks at once, yielding results
 * as each completes (not necessarily in input order).
 */


export interface ParallelResult<R> {
  index: number;
  result: R;
}

interface IndexedResult<R> {
  index: number;
  result: R | null;
  ok: boolean;
}

export async function indexedWrapper<T, R>(f: (item: T) => Promise<R>, item: T, index: number): Promise<IndexedResult<R>> {
  try {
    const result = await f(item);
    return { index, result, ok: true };
  } catch (err) {
    console.warn(`[parallel] Item ${index} failed, skipping:`, err);
    return { index, result: null, ok: false };
  }
}

/**
 * Process `items` through `fn` with at most `concurrency` in-flight at once.
 * Yields each {index, result} as it completes (earliest-first, not input order).
 * Skips items where fn throws. Stops launching new items if shouldCancel returns true.
 */
export async function* parallelMap<T, R>(
    items: T[],
    f: (item: T) => Promise<R>,
    concurrency: number,
    shouldCancel?: () => boolean,
): AsyncGenerator<ParallelResult<R>> {
  const active = new Map<number, Promise<IndexedResult<R>>>();

  for (let i = 0; i < Math.min(concurrency, items.length); i++) {
    active.set(i, indexedWrapper(f, items[i], i));
  }

  let nextToLaunch = concurrency;
  while (active.size > 0) {
    const completed = await Promise.race(active.values());
    active.delete(completed.index);
    if (completed.ok) yield { index: completed.index, result: completed.result as R };

    if (nextToLaunch < items.length && !shouldCancel?.()) {
      active.set(nextToLaunch, indexedWrapper(f, items[nextToLaunch], nextToLaunch))
      nextToLaunch++;
    }
  }
}
