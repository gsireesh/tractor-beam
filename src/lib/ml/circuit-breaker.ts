/**
 * When to abandon a run rather than keep firing doomed requests.
 *
 * Two triggers, both keyed off the per-block failures Slice 4 surfaces:
 *  - Fail-fast: a bad key can't recover, so an `auth` failure on the very first
 *    block aborts immediately instead of failing all N blocks identically.
 *  - Circuit-breaker: N consecutive failures (reset by any success) — this is
 *    what a mid-run network drop looks like — aborts and reports the cause.
 *
 * Pure and network-free so the policy is unit-testable without the offscreen.
 */
import { describeMlError, type MlErrorClass } from './errors';

/** Consecutive per-block failures that trip the breaker. */
export const FAILURE_THRESHOLD = 3;

export function shouldAbortRun(params: {
  /** Consecutive failures so far, including the one just recorded. */
  consecutiveFailures: number;
  /** Classification of the most recent failure. */
  classification: MlErrorClass;
  /** Was the most recent failure the very first block processed? */
  isFirstBlock: boolean;
  threshold?: number;
}): { abort: boolean; reason?: string } {
  const {
    consecutiveFailures,
    classification,
    isFirstBlock,
    threshold = FAILURE_THRESHOLD,
  } = params;

  // Bad credentials never recover — one failed first block is proof enough.
  if (isFirstBlock && classification === 'auth') {
    return { abort: true, reason: describeMlError('auth') };
  }

  if (consecutiveFailures >= threshold) {
    return {
      abort: true,
      reason: `Stopped after ${consecutiveFailures} consecutive failures — ${describeMlError(
        classification,
      )}`,
    };
  }

  return { abort: false };
}
