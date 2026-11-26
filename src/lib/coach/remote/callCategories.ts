/**
 * Call categories (2026-11-26; Gong ledger F10.10 / F10.9; migration 0367). A company admin keeps a short list; a rep
 * picks one for each phone/video call at close (founder picker: no AI guess). A call's category is its LATEST pick
 * (null = cleared or never picked) — one rule for the call page and every filter (§2.2). Pure.
 */
export const MAX_CATEGORIES = 20;
export const NAME_MAX = 40;

export type Pick = { id: number; session_id: string; category_id: string | null };

/** Per call: the latest pick's category (null when cleared). Calls never picked are absent. */
export function currentCategories(picks: Pick[]): Map<string, string | null> {
  const latest = new Map<string, Pick>();
  for (const p of picks) {
    const k = String(p.session_id);
    const had = latest.get(k);
    if (!had || p.id > had.id) latest.set(k, p);
  }
  return new Map([...latest].map(([k, p]) => [k, p.category_id ? String(p.category_id) : null]));
}

/** A new category name: 1–NAME_MAX characters, not already a live category (any case). Error sentence or the name. */
export function checkName(raw: unknown, live: string[]): { ok: true; name: string } | { ok: false; error: string } {
  const name = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (!name || name.length > NAME_MAX) return { ok: false, error: `Give the category a name of up to ${NAME_MAX} characters.` };
  if (live.some((n) => n.trim().toLowerCase() === name.toLowerCase())) return { ok: false, error: `There is already a category called ${name}.` };
  if (live.length >= MAX_CATEGORIES) return { ok: false, error: `Keep the list to ${MAX_CATEGORIES} categories — retire one first.` };
  return { ok: true, name };
}
