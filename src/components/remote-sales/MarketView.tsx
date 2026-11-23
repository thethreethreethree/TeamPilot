"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { TopicGroups } from "./TopicGroups";
import { useIsSalesCoachManager } from "@/lib/hooks/useCurrentUserRole";

/**
 * Market (2026-11-23, market.ts): which competitors come up on calls, how often and how deals go when they do, and the
 * topics customers raise most — added up from each call's own intel. Win rates appear only with enough closed calls.
 */
type Comp = { name: string; calls: number; share: number; closed: number; winRate: number | null; weeks: Array<{ weekStart: string; calls: number }> };
type Res = { calls: number; withIntel: number; closed: number; winRate: number | null; competitors: Comp[]; topics: Array<{ name: string; calls: number; variants?: string[] }> };
const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);

export function MarketView({ module }: { module: "remote_sales" | "sales_coach" }) {
  const [days, setDays] = useState<30 | 90>(90);
  const [res, setRes] = useState<Res | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0); // a topic group accepted or ungrouped → count again
  // Turn a topic into a keyword tracker (2026-11-23; ledger F14.4): a manager tracks the topic's wordings on the
  // customer's side from now on. Uses the trackers route as it is, then scans recent calls so the tracker isn't empty.
  const isManager = useIsSalesCoachManager();
  const [tracked, setTracked] = useState<Record<string, "saving" | "done" | string>>({});
  const track = async (t: { name: string; variants?: string[] }) => {
    setTracked((x) => ({ ...x, [t.name]: "saving" }));
    try {
      const r = await fetch("/api/coach/remote/trackers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: t.name.slice(0, 60), phrases: [t.name, ...(t.variants ?? [])].slice(0, 200), side: "customer" }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Couldn't create the tracker.");
      void fetch("/api/coach/remote/trackers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "scan" }) }).catch(() => {});
      setTracked((x) => ({ ...x, [t.name]: "done" }));
    } catch (e) {
      setTracked((x) => ({ ...x, [t.name]: e instanceof Error ? e.message : "Couldn't create the tracker." }));
    }
  };

  useEffect(() => {
    let live = true;
    setRes(null);
    setFailed(false);
    fetch(`/api/coach/remote/market?module=${module}&days=${days}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: Res) => live && setRes(j))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [module, days, version]);

  const maxWeek = res ? Math.max(1, ...res.competitors.flatMap((c) => c.weeks.map((w) => w.calls))) : 1;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-primary">Market</h2>
          <p className="text-xs text-secondary">Competitors and topics customers bring up, added up across your calls.</p>
        </div>
        <div role="group" aria-label="Period" className="inline-flex overflow-hidden rounded-lg border border-default text-xs">
          {([30, 90] as const).map((d) => (
            <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)} className={`px-2.5 py-1 ${days === d ? "bg-brand/15 font-semibold text-primary" : "text-secondary"}`}>
              {d} days
            </button>
          ))}
        </div>
      </div>

      {failed ? (
        <p className="rounded-xl border border-default bg-surface p-6 text-center text-xs text-muted">Couldn&apos;t build the market view. Refresh to try again.</p>
      ) : !res ? (
        <p className="flex items-center justify-center gap-2 p-6 text-xs text-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Adding up your calls…</p>
      ) : res.withIntel === 0 ? (
        <p className="rounded-xl border border-default bg-surface p-6 text-center text-xs text-secondary">No analyzed sales calls in the last {days} days yet.</p>
      ) : (
        <>
          <p className="text-xs text-secondary">
            {res.withIntel} analyzed sales {res.withIntel === 1 ? "call" : "calls"} · {res.closed} closed · overall win rate{" "}
            <span className="font-semibold text-primary">{pct(res.winRate)}</span>
          </p>

          <section aria-label="Competitors" className="rounded-xl border border-default bg-surface p-3">
            <h3 className="text-sm font-semibold text-primary">Competitors named</h3>
            {res.competitors.length === 0 ? (
              <p className="mt-2 text-xs text-secondary">No competitor was named on these calls.</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] uppercase tracking-wide text-muted">
                    <tr>
                      <th className="py-1 pr-2 font-medium">Competitor</th>
                      <th className="py-1 pr-2 text-right font-medium">Calls</th>
                      <th className="py-1 pr-2 text-right font-medium">Share</th>
                      <th className="py-1 pr-2 text-right font-medium">Win rate when named</th>
                      <th className="py-1 font-medium">By week</th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.competitors.map((c) => (
                      <tr key={c.name} className="border-t border-default">
                        <td className="py-1.5 pr-2 font-medium text-primary">{c.name}</td>
                        <td className="py-1.5 pr-2 text-right tabular-nums text-secondary">{c.calls}</td>
                        <td className="py-1.5 pr-2 text-right tabular-nums text-secondary">{pct(c.share)}</td>
                        <td className="py-1.5 pr-2 text-right tabular-nums text-primary">
                          {pct(c.winRate)}
                          {c.winRate !== null && res.winRate !== null && (
                            <span className={`ml-1 text-[10px] ${c.winRate < res.winRate ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>
                              {c.winRate < res.winRate ? "below" : "at or above"} overall
                            </span>
                          )}
                        </td>
                        <td className="py-1.5">
                          <span className="flex h-5 items-end gap-0.5" aria-label={c.weeks.map((w) => `${w.weekStart}: ${w.calls}`).join(", ")}>
                            {c.weeks.map((w) => (
                              <span key={w.weekStart} className="w-1.5 rounded-sm bg-brand/70" style={{ height: `${Math.max(15, Math.round((w.calls / maxWeek) * 100))}%` }} title={`Week of ${w.weekStart}: ${w.calls}`} />
                            ))}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-1 text-[10px] text-muted">Win rate = sold ÷ (sold + no sale). Shown only with at least 5 closed calls; “—” means too few to judge.</p>
              </div>
            )}
          </section>

          <section aria-label="Topics" className="rounded-xl border border-default bg-surface p-3">
            <h3 className="text-sm font-semibold text-primary">Topics customers raised most</h3>
            {res.topics.length === 0 ? (
              <p className="mt-2 text-xs text-secondary">No topics recorded on these calls.</p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {res.topics.map((t) => (
                  <li key={t.name} className="rounded-full border border-default px-2.5 py-1 text-xs text-primary" title={t.variants?.length ? `Also said as: ${t.variants.join(", ")}` : undefined}>
                    {t.name} <span className="tabular-nums text-muted">· {t.calls}</span>
                    {t.variants && t.variants.length > 0 && <span className="ml-1 text-[10px] text-muted">(+{t.variants.length} {t.variants.length === 1 ? "wording" : "wordings"})</span>}
                    {isManager && module === "remote_sales" && (
                      tracked[t.name] === "done" ? (
                        <a href="/dashboard/remote-sales/trackers" className="ml-1.5 text-[10px] font-medium text-brand hover:underline">Tracking ✓</a>
                      ) : tracked[t.name] === "saving" ? (
                        <span className="ml-1.5 text-[10px] text-muted">Saving…</span>
                      ) : (
                        <>
                          <button type="button" onClick={() => void track(t)} title="Track this topic on every call from now on" aria-label={`Track ${t.name}`} className="ml-1.5 text-[10px] text-secondary hover:text-primary hover:underline">
                            {tracked[t.name] ? "Try again" : "Track"}
                          </button>
                          {tracked[t.name] && <span role="alert" className="ml-1 text-[10px] text-amber-700 dark:text-amber-300">{tracked[t.name]}</span>}
                        </>
                      )
                    )}
                  </li>
                ))}
              </ul>
            )}
            {res.topics.length > 0 && <p className="mt-2 text-[10px] text-muted">The same topic in different wording (word order, plurals) is counted once, and so are topics a manager grouped; hover a topic to see how else it was said.</p>}
          </section>
        </>
      )}

      {/* Outside the counted view: recounting after an accept must not drop the suggestions still on screen. */}
      <TopicGroups module={module} onChanged={() => setVersion((v) => v + 1)} />
    </div>
  );
}
