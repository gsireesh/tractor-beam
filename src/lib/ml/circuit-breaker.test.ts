import { describe, it, expect } from 'vitest';
import { shouldAbortRun, FAILURE_THRESHOLD } from './circuit-breaker';

describe('shouldAbortRun', () => {
  it('fails fast on an auth error from the first block', () => {
    const d = shouldAbortRun({ consecutiveFailures: 1, classification: 'auth', isFirstBlock: true });
    expect(d.abort).toBe(true);
    expect(d.reason).toMatch(/api key/i);
  });

  it('does NOT fail fast on a non-auth first-block failure (could be a blip)', () => {
    expect(
      shouldAbortRun({ consecutiveFailures: 1, classification: 'connection', isFirstBlock: true }),
    ).toEqual({ abort: false });
  });

  it('trips the breaker at the consecutive-failure threshold', () => {
    // Below threshold: keep going.
    expect(
      shouldAbortRun({
        consecutiveFailures: FAILURE_THRESHOLD - 1,
        classification: 'connection',
        isFirstBlock: false,
      }),
    ).toEqual({ abort: false });

    // At threshold: abort, reason names the cause.
    const d = shouldAbortRun({
      consecutiveFailures: FAILURE_THRESHOLD,
      classification: 'connection',
      isFirstBlock: false,
    });
    expect(d.abort).toBe(true);
    expect(d.reason).toMatch(/consecutive failures/i);
    expect(d.reason).toMatch(/connection|endpoint/i);
  });

  it('respects a custom threshold', () => {
    expect(
      shouldAbortRun({
        consecutiveFailures: 2,
        classification: 'server',
        isFirstBlock: false,
        threshold: 5,
      }),
    ).toEqual({ abort: false });
    expect(
      shouldAbortRun({
        consecutiveFailures: 5,
        classification: 'server',
        isFirstBlock: false,
        threshold: 5,
      }).abort,
    ).toBe(true);
  });
});
