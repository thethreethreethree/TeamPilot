import { applyCorrections, type Correction } from "./vocabulary";

/**
 * Re-applying the company's "heard as" corrections to past calls (2026-11-26; F8.9; founder picker: "On request, with a
 * count"). Pure: given each call's CURRENT lines, which lines would change — by the same applyCorrections rule new lines
 * go through, so a past call ends up exactly as if it had been heard today.
 */
export const APPLY_BATCH = 50;

export type Line = { session_id: string; seq: number; text: string };
export type CallChange = { sessionId: string; texts: Record<string, string> };

export function planReapply(lines: Line[], corrections: Correction[]): CallChange[] {
  if (!corrections.length) return [];
  const by = new Map<string, Record<string, string>>();
  for (const l of lines) {
    const next = applyCorrections(l.text, corrections);
    if (next === l.text) continue;
    const k = String(l.session_id);
    by.set(k, { ...(by.get(k) ?? {}), [String(l.seq)]: next });
  }
  return [...by].map(([sessionId, texts]) => ({ sessionId, texts }));
}
