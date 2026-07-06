/**
 * Classifying inference failures into a small, decision-relevant taxonomy.
 *
 * Both runners' SDKs (@anthropic-ai/sdk, openai) are Stainless-generated, so a
 * thrown error carries a numeric `status` for any HTTP response and none for a
 * transport failure (offline, DNS, CORS, APIConnectionError). We classify on
 * that shape alone — no `instanceof` against SDK classes — so this stays pure
 * and unit-testable without importing either SDK.
 *
 * The classification drives two behaviors: the connection-probe verdict shown in
 * the panel, and the circuit-breaker's fail-fast decision (an `auth` error on the
 * first block means every block will fail, so stop immediately).
 */

export type MlErrorClass = 'auth' | 'rateLimit' | 'connection' | 'server' | 'unknown';

/** Narrow an unknown thrown value to `{ status?, name?, message? }` without asserting types. */
function errorShape(err: unknown): { status?: number; name?: string; message?: string } {
  if (typeof err !== 'object' || err === null) return {};
  const e = err as Record<string, unknown>;
  return {
    status: typeof e.status === 'number' ? e.status : undefined,
    name: typeof e.name === 'string' ? e.name : undefined,
    message: typeof e.message === 'string' ? e.message : undefined,
  };
}

export function classifyMlError(err: unknown): MlErrorClass {
  const { status, name, message } = errorShape(err);

  if (status !== undefined) {
    if (status === 401 || status === 403) return 'auth';
    if (status === 429) return 'rateLimit';
    if (status >= 500) return 'server';
    return 'unknown'; // some other 4xx (400 bad request, 404 model not found, …)
  }

  // No HTTP status → the request never got a response. Treat network/transport
  // failures as `connection` so the UI can say "check your connection / base URL".
  const haystack = `${name ?? ''} ${message ?? ''}`.toLowerCase();
  if (/connection|network|fetch failed|failed to fetch|offline|enotfound|econnrefused|timeout|dns/.test(haystack)) {
    return 'connection';
  }
  return 'unknown';
}

/**
 * A short, user-facing sentence for a classified failure — what the panel shows
 * next to the model, and what the circuit-breaker reports when it aborts a run.
 * Falls back to the raw error text for `unknown`, so nothing is silently opaque.
 */
export function describeMlError(classification: MlErrorClass, rawMessage?: string): string {
  switch (classification) {
    case 'auth':
      return 'Authentication failed — check the API key in Model Configuration.';
    case 'rateLimit':
      return 'Rate limited by the provider. Try again in a moment.';
    case 'connection':
      return "Couldn't reach the model endpoint — check your internet connection or base URL.";
    case 'server':
      return 'The provider returned a server error. Try again shortly.';
    case 'unknown':
      return rawMessage?.trim() ? rawMessage.trim() : 'Connection check failed.';
  }
}
