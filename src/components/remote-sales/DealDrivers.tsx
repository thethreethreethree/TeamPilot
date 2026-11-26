"use client";

import { useEffect, useState } from "react";
import { dealDrivers, driversFromSnapshots, type DriverDeal, type Drivers } from "@/lib/coach/remote/revenue/drivers";
import { RISK_WORDS } from "@/lib/coach/remote/dealRisk";

/**
 * Pipeline → Drivers (revenue Phase 4; Gong F20.11), for managers: per rep, their open deals and the share with each
 * warning now. The three highest in a column are marked; a warning on half or more of the deals of more than three reps
 * is a team habit — a training need, said above the table. Now, or 30 / 90 days ago from the nightly record (0382); a
 * day with no record says so (the nightly job wasn't running), never "no warnings".
 */
type When = "now" | 30 | 90;
export function DealDrivers({ deals, nameOf, today, whose = "team" }: { deals: DriverDeal[]; nameOf: (id: string) => string | null; today: string; whose?: string }) {
  const [when, setWhen] = useState<When>("now");
  const [past, setPast] = useState<{ day: string; drivers: Drivers | null } | "loading" | "failed" | null>(null);
  useEffect(() => {
    if (when === "now") return;
    let live = true;
    setPast("loading");
    fetch(`/api/coach/remote/deal-drivers?daysAgo=${when}${whose === "mine" ? "" : `&repId=${encodeURIComponent(whose)}`}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as { day?: string; recorded?: boolean; rows?: Array<{ rep_id: string; reasons: string[] }> };
        if (typeof j.day !== "string" || !Array.isArray(j.rows)) throw new Error("shape");
        return { day: j.day, drivers: j.recorded ? driversFromSnapshots(j.rows) : null };
      })
      .then((x) => live && setPast(x))
      .catch(() => live && setPast("failed"));
    return () => {
      live = false;
    };
  }, [when, whose]);
  const picker = (
    <div role="group" aria-label="When" className="inline-flex overflow-hidden rounded-lg border border-default text-[11px]">
      {(["now", 30, 90] as const).map((w) => (
        <button key={w} type="button" aria-pressed={when === w} onClick={() => setWhen(w)} className={`px-2 py-1 ${when === w ? "bg-brand/15 font-semibold text-primary" : "text-secondary hover:text-primary"}`}>
          {w === "now" ? "Now" : `${w} days ago`}
        </button>
      ))}
    </div>
  );
  const box = (text: string) => <div className="space-y-2">{picker}<p className="rounded-xl border border-default bg-surface p-6 text-center text-xs text-secondary">{text}</p></div>;
  if (when !== "now") {
    if (past === "loading" || past === null) return box("Loading the warnings recorded that day…");
    if (past === "failed") return box("Couldn't load the warnings recorded that day. Try again.");
    if (!past.drivers) return box(`Nothing was recorded on ${past.day}: warnings are recorded each night once the nightly job runs.`);
  }
  const d = when === "now" ? dealDrivers(deals, today) : (past as { drivers: Drivers }).drivers;
  if (d.rows.length === 0) return box("No open deals in this pipeline.");
  if (d.reasons.length === 0) return box(when === "now" ? "No open deal has a warning right now." : "No open deal had a warning that day.");
  return (
    <section aria-label="Deal drivers" className="space-y-2">
      {picker}
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
      <p className="text-[11px] text-muted">The share of each rep&apos;s open deals with the warning {when === "now" ? "today" : `on ${(past as { day: string }).day}, as recorded that night`}. The three highest per column are marked.</p>
    </section>
  );
}
