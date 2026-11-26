"use client";

import { dealDrivers, type DriverDeal } from "@/lib/coach/remote/revenue/drivers";
import { RISK_WORDS } from "@/lib/coach/remote/dealRisk";

/**
 * Pipeline → Drivers (revenue Phase 4; Gong F20.11), for managers: per rep, their open deals and the share with each
 * warning now. The three highest in a column are marked; a warning on half or more of the deals of more than three reps
 * is a team habit — a training need, said above the table. Now only: warnings aren't recorded day by day yet.
 */
export function DealDrivers({ deals, nameOf, today }: { deals: DriverDeal[]; nameOf: (id: string) => string | null; today: string }) {
  const d = dealDrivers(deals, today);
  if (d.rows.length === 0) return <p className="rounded-xl border border-default bg-surface p-6 text-center text-xs text-secondary">No open deals in this pipeline.</p>;
  if (d.reasons.length === 0) return <p className="rounded-xl border border-default bg-surface p-6 text-center text-xs text-secondary">No open deal has a warning right now.</p>;
  return (
    <section aria-label="Deal drivers" className="space-y-2">
      {d.teamWide.length > 0 && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-primary" role="status">
          Team-wide: {d.teamWide.map((r) => RISK_WORDS[r].toLowerCase()).join("; ")} — on half or more of the open deals of more than three reps. Worth coaching the whole team on.
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border border-default bg-surface">
        <table className="w-full min-w-[40rem] text-left text-xs">
          <thead className="text-[10px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Rep</th>
              <th className="px-3 py-2 text-right font-medium">Open deals</th>
              {d.reasons.map((r) => <th key={r} className="px-3 py-2 text-right font-medium" title={RISK_WORDS[r]}>{RISK_WORDS[r]}</th>)}
            </tr>
          </thead>
          <tbody>
            {d.rows.map((row) => (
              <tr key={row.repId} className="border-t border-default">
                <td className="px-3 py-2 text-primary">{nameOf(row.repId) ?? "A rep"}</td>
                <td className="px-3 py-2 text-right tabular-nums text-secondary">{row.open}</td>
                {d.reasons.map((r) => {
                  const v = row.share[r] ?? 0;
                  const top = d.top[r]?.includes(row.repId);
                  return (
                    <td key={r} className={`px-3 py-2 text-right tabular-nums ${top ? "font-semibold text-amber-700 dark:text-amber-300" : "text-secondary"}`}>
                      {v ? `${Math.round(v * 100)}%` : "—"}{top ? <span className="sr-only"> (among the three highest)</span> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted">The share of each rep&apos;s open deals with the warning today. The three highest per column are marked. These are today&apos;s warnings; a 30- or 90-day view comes when warnings are recorded each day.</p>
    </section>
  );
}
