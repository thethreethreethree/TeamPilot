/**
 * GET a finance API route's JSON — or throw.
 *
 * Finance pages read their data with `fetch(url).then((r) => r.json())` and then `x.bills ?? []`, so an error answer
 * became an empty list on screen: "no bills", "no invoices" — as if nothing were owed (founder decision 2026-11-23:
 * fix all 14 routes and their pages). The routes now answer a failed read with a non-OK status; this treats that, or
 * an `{ error }` body, as a failure, so the page's load lands in its catch and shows "Couldn't load".
 */
// Untyped by default, exactly as the `r.json()` it replaces was — pages keep their own types downstream.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getJson<T = any>(url: string): Promise<T> {
  const r = await fetch(url);
  const body = (await r.json().catch(() => null)) as (T & { error?: unknown }) | null;
  if (!r.ok || !body || (typeof body === "object" && "error" in body && body.error)) {
    throw new Error(typeof body?.error === "string" ? body.error : `${url} answered ${r.status}`);
  }
  return body;
}
