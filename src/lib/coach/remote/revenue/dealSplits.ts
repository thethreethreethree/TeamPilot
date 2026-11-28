import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Deal splits (revenue plan phase 10, 0394; Gong F20.12; decides R9). A deal's revenue shared between people of the
 * company in whole percents; the latest split is the deal's (deal_splits_current). No split = the rep's 100%. The
 * database checks every split (rss_check_deal_split): this file only reads it and says each person's share.
 */
export type Share = { userId: string; pct: number };

/** A person's share of a deal, 0–1: their split percent, or the whole deal when it's theirs and has no split. Pure. */
export function shareOf(deal: { repId: string; split?: Share[] | null }, userId: string): number {
  if (deal.split && deal.split.length) return (deal.split.find((s) => s.userId === userId)?.pct ?? 0) / 100;
  return deal.repId === userId ? 1 : 0;
}

/** Everyone with a share in any of the deals (for the board's rows). Pure. */
export function owners(deals: Array<{ repId: string; split?: Share[] | null }>): string[] {
  const out = new Set<string>();
  for (const d of deals) {
    out.add(d.repId);
    for (const s of d.split ?? []) out.add(s.userId);
  }
  return [...out];
}

/** The shares as stored ([{user_id, pct}]) → Share[]; a split of the rep alone at 100 reads as no split. Pure. */
export function readShares(raw: unknown, repId: string): Share[] | null {
  if (!Array.isArray(raw)) return null;
  const shares = raw
    .map((x) => ({ userId: String((x as { user_id?: unknown }).user_id ?? ""), pct: Number((x as { pct?: unknown }).pct) }))
    .filter((s) => s.userId && Number.isFinite(s.pct));
  if (shares.length === 1 && shares[0]!.userId === repId) return null;
  return shares.length ? shares : null;
}

/**
 * Each deal's current split, through the caller's client (only deals they can see). Returns null on a failed read —
 * the caller says so; amounts by person would be wrong without it.
 */
export async function splitsFor(db: SupabaseClient, deals: Array<{ id: string; repId: string }>): Promise<Map<string, Share[]> | null> {
  const out = new Map<string, Share[]>();
  const rep = new Map(deals.map((d) => [d.id, d.repId]));
  const ids = deals.map((d) => d.id);
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await db.from("deal_splits_current").select("prospect_id, shares").in("prospect_id", ids.slice(i, i + 150)).limit(1000);
    if (error) {
      // Before 0394 there's no split anywhere: every deal is its rep's. By code (review 2026-11-28: PostgREST's message
      // for a missing table doesn't say "does not exist", and that phrase also matches unrelated errors).
      if (["PGRST205", "42P01"].includes(String((error as { code?: string }).code))) return out;
      return null;
    }
    for (const r of (data ?? []) as Array<{ prospect_id: string; shares: unknown }>) {
      const s = readShares(r.shares, rep.get(String(r.prospect_id)) ?? "");
      if (s) out.set(String(r.prospect_id), s);
    }
  }
  return out;
}

/**
 * The deals a person co-owns — named in a deal's CURRENT split without being its rep (0395 rss_co_owned_deals; their
 * own company only). Service role: this is the explicit check that lets a co-owner read those deals; null on a failed
 * read.
 */
export async function coOwnedDealIds(admin: SupabaseClient, userId: string): Promise<string[] | null> {
  const { data, error } = await admin.rpc("rss_co_owned_deals", { p_user: userId });
  if (error) return ["PGRST202", "42883"].includes(String((error as { code?: string }).code)) ? [] : null;
  return ((data ?? []) as Array<string | { rss_co_owned_deals?: string }>).map((x) => (typeof x === "string" ? x : String(x.rss_co_owned_deals ?? ""))).filter(Boolean);
}

/**
 * A person's pipeline totals by share (revenue phase 10b): each deal's amount times their share, counted when they have
 * one; `split` says whether any deal here is split, so the screen can say "your share". Pure.
 */
export function shareTotals(deals: Array<{ repId: string; status: string; amount: number | string | null; split?: Share[] | null }>, userId: string) {
  const t = { open: { count: 0, amount: 0 }, won: { count: 0, amount: 0 }, lost: { count: 0, amount: 0 } };
  let split = false;
  for (const d of deals) {
    const s = shareOf(d, userId);
    if (s <= 0) continue;
    if (d.split && d.split.length) split = true;
    const k = d.status === "won" || d.status === "lost" ? d.status : "open";
    t[k].count += 1;
    const a = Number(d.amount);
    if (d.amount !== null && Number.isFinite(a)) t[k].amount += Math.round(a * s * 100) / 100;
  }
  return { totals: t, split };
}
