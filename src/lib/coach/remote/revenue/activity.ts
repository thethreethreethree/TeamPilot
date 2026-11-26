/**
 * Account activity level (revenue Phase 4, 0375; Gong F21.4): High / Medium / Low / Inactive over a window, from the
 * two-way calls (the customer spoke) on the account's deals. Gong doesn't publish its formula, so ours is stated here
 * (plan R5): the window is cut into four quarters weighted 1.0, 0.8, 0.6, 0.4; within a quarter each extra call adds
 * half what the one before added (diminishing returns). One two-way call in every quarter scores exactly 50.
 */
const DAY = 86_400_000;
export type Window = 21 | 90 | 180 | 365;
export type Level = "high" | "medium" | "low" | "inactive";

export function activityScore(twoWayCallsIso: string[], todayIso: string, window: Window): number {
  const today = Date.parse(todayIso.length === 10 ? `${todayIso}T12:00:00Z` : todayIso);
  const size = window / 4;
  let score = 0;
  for (let b = 0; b < 4; b++) {
    const n = twoWayCallsIso.filter((d) => {
      const ago = (today - Date.parse(d)) / DAY;
      return ago >= b * size && ago < (b + 1) * size;
    }).length;
    score += (1 - b * 0.2) * (1 - 0.5 ** n);
  }
  return Math.round((score / 2.8) * 100);
}

export function activityLevel(score: number): Level {
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  if (score > 0) return "low";
  return "inactive";
}
