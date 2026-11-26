/**
 * The other revenue rules, as code: account activity level (Gong F21.4), playbook element notes (F20.7), win/loss
 * (F20.10) and matching an organisation name to an account (backfill of remote_prospect_events 'organization').
 */
import { daysBetween } from "./warnings.ts";

// ── Activity level (F21.4). Gong: High / Medium / Low / Inactive per window; recency-weighted with diminishing returns;
// only two-way engagement counts. Its formula and cut-offs aren't published, so ours is stated here [ASSUMED, R5].
export type Window = 21 | 90 | 180 | 365;
export type Level = "high" | "medium" | "low" | "inactive";

export function activityScore(twoWayCallDays: string[], today: string, window: Window): number {
  const buckets = 4;
  const size = window / buckets;
  let score = 0;
  for (let b = 0; b < buckets; b++) {
    const n = twoWayCallDays.filter((d) => {
      const ago = daysBetween(d, today);
      return ago >= b * size && ago < (b + 1) * size;
    }).length;
    const weight = 1 - b * 0.2; // newest quarter counts 1.0, oldest 0.4
    score += weight * (1 - 0.5 ** n); // each extra call in a bucket adds half of what the last one did
  }
  return Math.round((score / 2.8) * 100); // 2.8 = the most four buckets can add up to
}

/** One two-way call in every quarter of the window scores exactly 50: steady contact all through it is "high". */
export function activityLevel(score: number): Level {
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  if (score > 0) return "low";
  return "inactive";
}

// ── Playbook element notes (F20.7). Gong's colours: nothing → AI found evidence → manual note → validated.
export type NoteState = "empty" | "ai_found" | "noted" | "validated";
export type NoteAction = "ai_suggest" | "write" | "validate" | "clear";
export class PlaybookError extends Error {}

const NEXT: Record<NoteState, Partial<Record<NoteAction, NoteState>>> = {
  empty: { ai_suggest: "ai_found", write: "noted" },
  ai_found: { ai_suggest: "ai_found", write: "noted", clear: "empty" },
  noted: { write: "noted", validate: "validated", clear: "empty" },
  validated: { write: "noted", clear: "empty" }, // editing a validated note un-validates it
};

/** Validation needs a written note: an AI suggestion must be accepted (written) by a person before anyone validates. */
export function transition(state: NoteState, action: NoteAction, by: { isOwner: boolean; isManager: boolean }): NoteState {
  if (action === "validate" && !(by.isOwner || by.isManager)) throw new PlaybookError("Only the deal's owner or their manager can validate.");
  const to = NEXT[state][action];
  if (!to) throw new PlaybookError(`Can't ${action} a note that is ${state}.`);
  return to;
}

// ── Win/loss (F20.10). Gong needs at least 100 qualifying closed deals; below that it shows nothing (§3.2).
export const MIN_CLOSED_DEALS = 100; // [OBSERVED Gong] stand-in until decided (R6)

export type ClosedDeal = { won: boolean; tags: string[] };
export type WinRow = { tag: string; with: number; withWon: number; rateWith: number | null; rateWithout: number | null };

export function winLoss(deals: ClosedDeal[], minClosed = MIN_CLOSED_DEALS, minPerSide = 10):
  | { enough: false; closed: number; needed: number }
  | { enough: true; closed: number; rate: number; rows: WinRow[] } {
  if (deals.length < minClosed) return { enough: false, closed: deals.length, needed: minClosed };
  const rate = deals.filter((d) => d.won).length / deals.length;
  const tags = [...new Set(deals.flatMap((d) => d.tags))].sort();
  const rows = tags.map((tag) => {
    const w = deals.filter((d) => d.tags.includes(tag));
    const wo = deals.filter((d) => !d.tags.includes(tag));
    const r = (xs: ClosedDeal[]) => (xs.length >= minPerSide ? xs.filter((d) => d.won).length / xs.length : null);
    return { tag, with: w.length, withWon: w.filter((d) => d.won).length, rateWith: r(w), rateWithout: r(wo) };
  });
  return { enough: true, closed: deals.length, rate, rows };
}

// ── Account matching. Backfill links a prospect's free-text organisation to an account only on an exact match after
// case, space and punctuation are ignored. Legal suffixes are NOT stripped ("Acme" and "Acme Inc" can be two companies):
// those become suggestions a person confirms.
export function accountKey(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

const SUFFIX = /\s(inc|llc|ltd|limited|corp|corporation|co|company|gmbh|plc|pty|sa|bv)$/;
export function looseKey(name: string): string {
  return accountKey(name).replace(SUFFIX, "").trim();
}
