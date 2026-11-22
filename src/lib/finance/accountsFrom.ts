/**
 * The Chart of Accounts out of an /api/finance/accounts response — or a throw.
 *
 * Finance pages decide "Finance isn't set up yet" from an EMPTY Chart of Accounts, so a response that is not an actual
 * list (an error body, a 500, an HTML page) must never become `[]`. Before 2026-11-23 ten pages wrote
 * `a.accounts ?? []`, which turned every failed read into "not set up". Throwing sends the page to its catch, which now
 * shows "Couldn't load".
 */
export function accountsFrom<T = never>(res: { accounts?: unknown; error?: unknown } | null | undefined): T[] {
  if (!res || res.error || !Array.isArray(res.accounts)) {
    throw new Error(typeof res?.error === "string" ? res.error : "Could not load the Chart of Accounts.");
  }
  return res.accounts as T[];
}
