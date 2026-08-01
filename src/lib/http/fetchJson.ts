/**
 * fetchJson — fetch + parse JSON with HONEST failure.
 *
 * The "error dressed as no-data" class (see docs/FOUNDER-ACTION-QUEUE.md → "finance
 * read-path error handling") comes from the shape `fetch(url).then(x => x.json())`
 * with no `!res.ok` check: a 500 / network / non-JSON failure silently becomes empty
 * data, and the UI then shows a fake-empty state or an eternal spinner — telling a
 * user their data is gone when the load merely failed.
 *
 * `fetchJson` closes that off at the primitive: it THROWS a typed `FetchJsonError`
 * on every detectable failure —
 *   - a non-2xx HTTP status,
 *   - a network / transport error (no response at all),
 *   - a body that isn't valid JSON,
 *   - (default) a 2xx body carrying a string `error` field — this codebase's
 *     soft-error convention where some routes answer 200 with `{ error: "..." }`.
 * — so a caller's `catch` can reliably tell a load FAILURE from a genuinely-empty
 * result, set a distinct error state, and offer a retry.
 *
 * This is the low-level primitive intended to sit under a future `useResource`-style
 * hook for the finance read pages. It is safe to adopt incrementally: nothing changes
 * until a call site uses it. The hook shape + which pages migrate are a separate
 * (founder-scoped) decision; this file deliberately does not assume them.
 */

export class FetchJsonError extends Error {
  /** HTTP status of the failed response. 0 = network/transport error (no HTTP response). */
  readonly status: number;
  /** The parsed body, when there was one, so a caller can inspect it. `null` otherwise. */
  readonly body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "FetchJsonError";
    this.status = status;
    this.body = body ?? null;
  }
}

/** Pull a non-empty string `error` field out of a parsed body, if present. */
function extractErrorMessage(body: unknown): string | null {
  if (body && typeof body === "object" && "error" in body) {
    const e = (body as { error?: unknown }).error;
    if (typeof e === "string" && e.trim().length > 0) return e;
  }
  return null;
}

export interface FetchJsonInit extends RequestInit {
  /**
   * When true (the default), a 2xx response whose JSON body carries a non-empty
   * string `error` field is treated as a FAILURE and throws. Set false for the rare
   * route where `{ error }` on a 200 is legitimate payload the caller wants to read.
   */
  treatBodyErrorAsFailure?: boolean;
}

export async function fetchJson<T = unknown>(
  input: RequestInfo | URL,
  init?: FetchJsonInit
): Promise<T> {
  const treatBodyError = init?.treatBodyErrorAsFailure ?? true;

  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (e) {
    // No HTTP response at all — DNS failure, offline, aborted, CORS, etc.
    throw new FetchJsonError(
      0,
      e instanceof Error && e.message ? e.message : "Network request failed"
    );
  }

  const text = await res.text();
  let body: unknown = undefined;
  if (text.length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      // A non-JSON body: a server error page on a non-ok status, or a malformed 2xx.
      // Either way the caller can't use it — surface it as a failure, not empty data.
      throw new FetchJsonError(
        res.status,
        res.ok ? "Response was not valid JSON" : `Request failed (${res.status})`
      );
    }
  }

  if (!res.ok) {
    throw new FetchJsonError(
      res.status,
      extractErrorMessage(body) ?? `Request failed (${res.status})`,
      body
    );
  }

  if (treatBodyError) {
    const softError = extractErrorMessage(body);
    if (softError) throw new FetchJsonError(res.status, softError, body);
  }

  return body as T;
}
