/**
 * Pure summary of pilot-code redemption status — the founder-facing numbers behind /founder/pilot-codes.
 * Extracted + tested because a wrong filter or off-by-one here silently misreports how many codes are spent
 * vs available during a live pilot. Takes only the two fields the counts depend on, so it's trivially testable.
 */

export type PilotCodeStatus = {
  module: string;
  /** ISO timestamp when redeemed, or null if still available. */
  redeemed_at: string | null;
};

export type PilotModuleSummary = {
  module: string;
  total: number;
  redeemed: number;
  available: number;
};

export type PilotSummary = {
  total: number;
  redeemed: number;
  available: number;
  /** Per-module breakdown, in `moduleOrder` first then any others, EXCLUDING modules with zero codes. */
  byModule: PilotModuleSummary[];
};

export const DEFAULT_MODULE_ORDER = ["elostate", "sales_coach", "care"];

export function summarizePilotCodes(
  codes: PilotCodeStatus[],
  moduleOrder: string[] = DEFAULT_MODULE_ORDER
): PilotSummary {
  const total = codes.length;
  const redeemed = codes.filter((c) => c.redeemed_at).length;
  // Preserve the caller's preferred order, then append any module seen in the data but not listed, so a
  // future module can't silently vanish from the breakdown.
  const modules = [...new Set([...moduleOrder, ...codes.map((c) => c.module)])];
  const byModule = modules
    .map((m) => {
      const forM = codes.filter((c) => c.module === m);
      const r = forM.filter((c) => c.redeemed_at).length;
      return { module: m, total: forM.length, redeemed: r, available: forM.length - r };
    })
    .filter((s) => s.total > 0);
  return { total, redeemed, available: total - redeemed, byModule };
}
