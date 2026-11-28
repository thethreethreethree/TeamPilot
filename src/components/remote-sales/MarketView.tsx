"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { TopicGroups } from "./TopicGroups";
import { CitedAnswer, citedPlainText, type Citation } from "@/components/sales-coach/CitedAnswer";
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
  // Engage plan E14 (Gong F13.11): a battlecard for one competitor, written on request from its calls; not saved.
  const [card, setCard] = useState<{ competitor: string; busy: boolean; text?: string; citations?: Citation[]; calls?: number; error?: string; copied?: boolean; labels?: Record<string, string> } | null>(null);
  const battlecard = async (competitor: string) => {
    setCard({ competitor, busy: true });
    try {
      const r = await fetch("/api/coach/remote/market/battlecard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ competitor, module, days }) });
      const j = (await r.json().catch(() => ({}))) as { answer?: string | null; citations?: Citation[]; calls?: number; error?: string; suppressed?: boolean; labels?: Record<string, string> };
      if (!r.ok) return setCard({ competitor, busy: false, error: j.error ?? "Couldn't write the battlecard." });
      if (j.suppressed || !j.answer) return setCard({ competitor, busy: false, error: "The coach isn't answering on this account right now." });
      setCard({ competitor, busy: false, text: j.answer, citations: j.citations ?? [], calls: j.calls, labels: j.labels ?? {} });
    } catch {
      setCard({ competitor, busy: false, error: "Couldn't reach the server." });
    }
  };
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
                      <th className="py-1 font-medium"><span className="sr-only">Battlecard</span></th>
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
                        <td className="py-1.5 pl-2 text-right">
                          <button type="button" disabled={card?.busy} onClick={() => void battlecard(c.name)} className="whitespace-nowrap text-[11px] text-secondary underline-offset-2 hover:text-primary hover:underline disabled:opacity-50">Battlecard</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {card && (
                  <div role="region" aria-label={`Battlecard: ${card.competitor}`} className="mt-2 rounded-lg border border-default bg-base/40 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-primary">Battlecard: {card.competitor}</p>
                      <span className="flex items-center gap-3">
                        {/* E14 residual R2: the card isn't saved, so it can be copied out (citations as call times). */}
                        {card.text && (
                          <button type="button" onClick={() => void navigator.clipboard.writeText(`Battlecard: ${card.competitor}\n\n${citedPlainText(card.text ?? "", card.citations ?? [], (c) => card.labels?.[c.sessionId])}`).then(() => setCard((c) => (c ? { ...c, copied: true } : c))).catch(() => setCard((c) => (c ? { ...c, error: "Couldn't copy — select the text instead." } : c)))} className="text-[11px] text-secondary hover:text-primary">
                            {card.copied ? "Copied" : "Copy"}
                          </button>
                        )}
                        <button type="button" onClick={() => setCard(null)} className="text-[11px] text-muted hover:text-primary">Close</button>
                      </span>
                    </div>
                    {card.busy ? (
                      <p className="mt-1 flex items-center gap-2 text-xs text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Reading the calls that named {card.competitor}…</p>
                    ) : card.error ? (
                      <p role="alert" className="mt-1 text-xs text-amber-700 dark:text-amber-300">{card.error}</p>
                    ) : (
                      <>
                        <p className="mt-0.5 text-[10px] text-muted">From the {card.calls} newest call{card.calls === 1 ? "" : "s"} that named it · written now, not saved</p>
                        <div className="mt-1"><CitedAnswer text={card.text ?? ""} citations={card.citations ?? []} labelFor={(c) => card.labels?.[c.sessionId] ?? "call"} /></div>
                      </>
                    )}
                  </div>
                )}
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
