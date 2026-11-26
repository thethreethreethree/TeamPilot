/**
 * A contact's rank from their job title (revenue Phase 1; Gong F20.5 "no power" needs it: Director / VP / C-level).
 * Words only; a title it doesn't recognise is "unknown", never guessed. Deal WARNINGS are not here: dealRisk.ts is their
 * one authority (§2.2), and Phase 3 adds Gong's kinds there (docs/ELOSTATE-REVENUE-BUILD-PLAN/docs/04-REVENUE-RULES.md).
 */
export type Rank = "c_level" | "vp" | "director" | "manager" | "individual" | "unknown";
export const POWER: Rank[] = ["c_level", "vp", "director"];

export function rankOf(title: string | null | undefined): Rank {
  const t = (title ?? "").toLowerCase();
  if (!t.trim()) return "unknown";
  if (/\b(ceo|cfo|coo|cto|cro|cmo|cio|chief|founder|owner|president)\b/.test(t)) return "c_level";
  if (/\b(vp|vice president|svp|evp)\b/.test(t)) return "vp";
  if (/\b(director|head of)\b/.test(t)) return "director";
  if (/\b(manager|lead|supervisor)\b/.test(t)) return "manager";
  if (/\b(rep|representative|associate|specialist|analyst|coordinator|assistant|engineer|agent)\b/.test(t)) return "individual";
  return "unknown";
}
