import { dealRisk, type RiskReason } from "../dealRisk";

/**
 * Deal drivers (revenue Phase 4; Gong F20.11): for each rep, how many open deals they have and the share with each
 * warning now. The three highest shares in a column are marked; when more than three reps have a warning on at least
 * half their open deals, it is a team habit, not one rep's — a training need. Live only: there is no daily record of
 * warnings yet (Phase 3a residual R1), so Gong's 30 / 90-day view isn't offered. dealRisk is the one verdict (§2.2).
 */
export type DriverDeal = Parameters<typeof dealRisk>[0] & { repId: string };
export type DriverRow = { repId: string; open: number; share: Partial<Record<RiskReason, number>> };
export type Drivers = { rows: DriverRow[]; reasons: RiskReason[]; top: Partial<Record<RiskReason, string[]>>; teamWide: RiskReason[] };

export const TEAM_WIDE_SHARE = 0.5;
export const TEAM_WIDE_REPS = 3;

export function dealDrivers(deals: DriverDeal[], today: string): Drivers {
  const byRep = new Map<string, DriverDeal[]>();
  for (const d of deals) if (d.status === "open") byRep.set(d.repId, [...(byRep.get(d.repId) ?? []), d]);
  const seen = new Set<RiskReason>();
  const rows: DriverRow[] = [...byRep.entries()].map(([repId, ds]) => {
    const counts = new Map<RiskReason, number>();
    for (const d of ds) for (const r of new Set(dealRisk(d, today).reasons)) {
      if (r === "no_amount") continue; // a data gap, not a warning (dealRisk's own rule)
      counts.set(r, (counts.get(r) ?? 0) + 1);
      seen.add(r);
    }
    return { repId, open: ds.length, share: Object.fromEntries([...counts].map(([r, n]) => [r, n / ds.length])) };
  });
  rows.sort((a, b) => b.open - a.open || a.repId.localeCompare(b.repId));
  const reasons = [...seen].sort();
  const top: Drivers["top"] = {};
  const teamWide: RiskReason[] = [];
  for (const r of reasons) {
    top[r] = rows.filter((x) => (x.share[r] ?? 0) > 0).sort((a, b) => (b.share[r] ?? 0) - (a.share[r] ?? 0)).slice(0, 3).map((x) => x.repId);
    if (rows.filter((x) => (x.share[r] ?? 0) >= TEAM_WIDE_SHARE).length > TEAM_WIDE_REPS) teamWide.push(r);
  }
  return { rows, reasons, top, teamWide };
}
