"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, BookOpen, Bookmark, Plus, Settings2, Trash2, X } from "lucide-react";
import { parseElements, type Element } from "@/lib/coach/remote/revenue/playbook";
import { byStage, filterDeals, rollUp, type BoardDeal, type BoardFilters, type ClosePeriod, type Stage } from "@/lib/coach/remote/revenue/dealBoard";
import { dealRisk, RISK_WORDS } from "@/lib/coach/remote/dealRisk";

/**
 * Pipeline → Board (revenue Phase 2, 0371; Gong F20.1 deal boards, F20.13 saved views). The deals in view, filtered by
 * status, stage, close period, account, risk and words; rolled up per stage in the company's order; one row per deal
 * with its account, stage, amount, close date, last and next call, contacts, risk and next to-do. A row opens the deal
 * in the list. Saved views are yours alone. A manager or admin sets the company's stages here.
 */
const CLOSE_WORDS: Record<ClosePeriod, string> = {
  overdue: "Close date passed", this_month: "Closing this month", next_month: "Closing next month",
  this_quarter: "Closing this quarter", next_quarter: "Closing next quarter", none: "No close date",
};
const money = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });
const short = (s: string | null | undefined) => (s ? new Date(s.length === 10 ? `${s}T12:00:00Z` : s).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—");
const field = "rounded-lg border border-default bg-surface px-2 py-1 text-xs text-primary";

export function DealBoard({
  deals,
  stages,
  canEditStages,
  onStagesSaved,
  onOpen,
  repName,
  today,
}: {
  deals: BoardDeal[];
  stages: Stage[] | null;
  canEditStages: boolean;
  onStagesSaved: () => void;
  onOpen: (id: string) => void;
  repName: ((id: string) => string | null) | null;
  today: string;
}) {
  const [f, setF] = useState<BoardFilters>({ status: "open" });
  const [views, setViews] = useState<Array<{ name: string; filters: BoardFilters }> | null>(null);
  const [viewsFailed, setViewsFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewName, setViewName] = useState("");
  const [editStages, setEditStages] = useState(false);
  const [editPlaybook, setEditPlaybook] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const loadViews = async () => {
    try {
      const r = await fetch("/api/coach/remote/deal-views", { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      setViews(((await r.json()) as { views: Array<{ name: string; filters: BoardFilters }> }).views);
      setViewsFailed(false);
    } catch {
      setViewsFailed(true);
    }
  };
  useEffect(() => {
    void loadViews();
  }, []);

  const shown = useMemo(() => filterDeals(deals, f, today), [deals, f, today]);
  const withPlaybook = deals.some((d) => d.playbook?.length);
  const cols = withPlaybook ? 10 : 9;
  const total = rollUp(shown);
  const groups = f.status === "open" || !f.status ? byStage(shown, stages) : [{ name: f.status === "won" ? "Closed Won" : "Closed Lost", listed: false, deals: shown }];
  const stageNames = useMemo(() => {
    const names = new Set<string>((stages ?? []).filter((s) => s.kind === "open").map((s) => s.name));
    for (const d of deals) if (d.stageLabel?.trim()) names.add(d.stageLabel.trim());
    return [...names];
  }, [deals, stages]);
  const accounts = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of deals) if (d.accountId) m.set(d.accountId, d.accountName ?? "(no name)");
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [deals]);

  const set = (k: keyof BoardFilters, v: string) => setF((cur) => ({ ...cur, [k]: v || undefined }));
  const saveView = async (removed?: string) => {
    setSaving(true);
    setMsg(null);
    try {
      const body = removed ? { name: removed, removed: true } : { name: viewName.trim(), filters: Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== "")) };
      const r = await fetch("/api/coach/remote/deal-views", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Couldn't save that view.");
      setViewName("");
      await loadViews();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't save that view.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-label="Deal board" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-default bg-surface p-2">
        <select aria-label="Status" value={f.status ?? ""} onChange={(e) => set("status", e.currentTarget.value)} className={field}>
          <option value="open">Open</option>
          <option value="won">Closed Won</option>
          <option value="lost">Closed Lost</option>
          <option value="">All</option>
        </select>
        <select aria-label="Stage" value={f.stage ?? ""} onChange={(e) => set("stage", e.currentTarget.value)} className={field}>
          <option value="">Any stage</option>
          {stageNames.map((s) => <option key={s} value={s}>{s}</option>)}
          <option value="(none)">No stage</option>
        </select>
        <select aria-label="Close date" value={f.close ?? ""} onChange={(e) => set("close", e.currentTarget.value)} className={field}>
          <option value="">Any close date</option>
          {(Object.keys(CLOSE_WORDS) as ClosePeriod[]).map((k) => <option key={k} value={k}>{CLOSE_WORDS[k]}</option>)}
        </select>
        <select aria-label="Account" value={f.accountId ?? ""} onChange={(e) => set("accountId", e.currentTarget.value)} className={field}>
          <option value="">Any account</option>
          {accounts.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </select>
        <select aria-label="Risk" value={f.risk ?? ""} onChange={(e) => set("risk", e.currentTarget.value)} className={field}>
          <option value="">Any risk</option>
          <option value="at_risk">At risk</option>
          <option value="watch">Watch</option>
          <option value="flagged">At risk or watch</option>
          <option value="ok">No flags</option>
        </select>
        <input aria-label="Search deals" value={f.q ?? ""} onChange={(e) => set("q", e.currentTarget.value)} placeholder="Search deals or accounts" className={`${field} min-w-0 flex-1`} />
        <button type="button" onClick={() => setF({ status: "open" })} className="px-1 text-[11px] text-muted hover:text-primary">Clear</button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Bookmark className="h-3.5 w-3.5 text-muted" aria-hidden />
        {viewsFailed ? <span className="text-amber-700 dark:text-amber-300">Couldn&apos;t load your saved views.</span> : (views ?? []).length === 0 ? <span className="text-muted">No saved views yet.</span> : null}
        {(views ?? []).map((v) => (
          <span key={v.name} className="inline-flex items-center gap-1 rounded-full border border-default px-2 py-0.5">
            <button type="button" onClick={() => setF(v.filters)} className="text-primary hover:underline">{v.name}</button>
            <button type="button" disabled={saving} onClick={() => void saveView(v.name)} aria-label={`Remove the view ${v.name}`} className="text-muted hover:text-primary"><X className="h-3 w-3" aria-hidden /></button>
          </span>
        ))}
        <input value={viewName} onChange={(e) => setViewName(e.currentTarget.value)} maxLength={40} placeholder="Name this view" aria-label="View name" className={`${field} w-36`} />
        <button type="button" disabled={saving || !viewName.trim()} onClick={() => void saveView()} title="Saves the filters; the search box isn't kept (a search is often someone's name)" className="rounded-lg border border-default px-2 py-1 text-primary disabled:opacity-50">Save view</button>
        {f.q?.trim() ? <span className="text-[11px] text-muted">The search isn&apos;t saved with a view.</span> : null}
        {canEditStages && (
          <span className="ml-auto inline-flex items-center gap-3">
            <button type="button" onClick={() => setEditPlaybook((v) => !v)} className="inline-flex items-center gap-1 text-secondary hover:text-primary">
              <BookOpen className="h-3.5 w-3.5" aria-hidden /> Playbook
            </button>
            <button type="button" onClick={() => setEditStages((v) => !v)} className="inline-flex items-center gap-1 text-secondary hover:text-primary">
              <Settings2 className="h-3.5 w-3.5" aria-hidden /> Stages
            </button>
          </span>
        )}
      </div>
      {msg && <p className="text-xs text-amber-700 dark:text-amber-300">{msg}</p>}
      {editPlaybook && canEditStages && <PlaybookPicker onSaved={() => { setEditPlaybook(false); onStagesSaved(); }} />}
      {editStages && canEditStages && <StagesEditor stages={stages} onSaved={() => { setEditStages(false); onStagesSaved(); }} />}

      <p className="text-xs text-secondary">
        <span className="font-semibold tabular-nums text-primary">{total.count}</span> {total.count === 1 ? "deal" : "deals"} ·{" "}
        <span className="font-semibold tabular-nums text-primary">{money(total.amount)}</span>
        {total.unpriced ? ` · ${total.unpriced} with no amount (not counted)` : ""}
      </p>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-default bg-surface p-6 text-center text-xs text-secondary">No deals match these filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-default bg-surface">
          <table className="w-full min-w-[56rem] text-left text-xs">
            <thead>
              <tr className="border-b border-default text-[10px] uppercase tracking-wide text-muted">
                <th className="px-3 py-2 font-medium">Deal</th>
                <th className="px-3 py-2 font-medium">Account</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Close</th>
                <th className="px-3 py-2 font-medium">Last call</th>
                <th className="px-3 py-2 font-medium">Next call</th>
                <th className="px-3 py-2 text-right font-medium">Contacts</th>
                <th className="px-3 py-2 font-medium">Risk</th>
                {withPlaybook && <th className="px-3 py-2 font-medium">Playbook</th>}
                <th className="px-3 py-2 font-medium">To do</th>
              </tr>
            </thead>
            {groups.map((g) => {
              const r = rollUp(g.deals);
              return (
                <tbody key={g.name}>
                  <tr className="border-b border-default bg-base/60">
                    <th colSpan={cols} className="px-3 py-1.5 text-left text-[11px] font-semibold text-primary">
                      {g.name}{g.listed || f.status !== "open" ? "" : " (not on the stage list)"}
                      <span className="ml-2 font-normal text-muted">{r.count} · {money(r.amount)}{r.unpriced ? ` · ${r.unpriced} unpriced` : ""}</span>
                    </th>
                  </tr>
                  {g.deals.length === 0 && (
                    <tr className="border-b border-default"><td colSpan={cols} className="px-3 py-1.5 text-[11px] text-muted">None.</td></tr>
                  )}
                  {g.deals.map((d) => {
                    const risk = dealRisk(d, today);
                    const overdueClose = !!d.closeDate && d.closeDate < today && d.status === "open";
                    return (
                      <tr key={d.id} onClick={() => onOpen(d.id)} className="cursor-pointer border-b border-default last:border-0 hover:bg-base/60">
                        <td className="px-3 py-2">
                          <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(d.id); }} className="text-left font-medium text-primary hover:underline">{d.name ?? "Unnamed deal"}</button>
                          {repName && <span className="block text-[11px] text-muted">{repName(d.repId) ?? ""}</span>}
                        </td>
                        <td className="px-3 py-2">
                          {d.accountId ? <Link onClick={(e) => e.stopPropagation()} href={`/dashboard/remote-sales/accounts/${d.accountId}`} className="text-primary hover:underline">{d.accountName}</Link> : <span className="text-muted">—</span>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-primary">{d.amount !== null ? money(d.amount) : "—"}</td>
                        <td className={`px-3 py-2 ${overdueClose ? "text-amber-700 dark:text-amber-300" : "text-secondary"}`}>{short(d.closeDate)}</td>
                        <td className="px-3 py-2 text-secondary">{short(d.lastCallAt)}</td>
                        <td className="px-3 py-2 text-secondary">{short(d.nextCallDate)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-secondary">{d.contacts ?? 0}</td>
                        <td className="px-3 py-2">
                          {risk.level === "ok" ? <span className="text-muted">—</span> : (
                            <span title={risk.reasons.map((x) => RISK_WORDS[x]).join(" · ")} className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${risk.level === "at_risk" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-base text-secondary"}`}>
                              <AlertCircle className="h-3 w-3" aria-hidden /> {risk.level === "at_risk" ? "At risk" : "Watch"}
                            </span>
                          )}
                        </td>
                        {withPlaybook && (
                          <td className="px-3 py-2">
                            <span className="inline-flex gap-0.5" aria-label={(d.playbook ?? []).map((x) => `${x.name}: ${x.state.replace("_", " ")}`).join(", ")}>
                              {(d.playbook ?? []).map((x, k) => (
                                <span key={k} className={`rounded px-1 text-[10px] font-semibold ${x.state === "validated" ? "bg-brand text-black" : x.state === "noted" ? "bg-brand/20 text-primary" : x.state === "ai_found" ? "border border-brand/60 text-primary" : "border border-default text-muted"}`}>{x.letter}</span>
                              ))}
                            </span>
                          </td>
                        )}
                        <td className="px-3 py-2 text-secondary">{d.nextTodo?.title ? `${d.nextTodo.title}${d.nextTodo.due ? ` (${short(d.nextTodo.due)})` : ""}` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              );
            })}
          </table>
        </div>
      )}
    </section>
  );
}

/** The company's stages, in order, each open / won / lost (0371). The database's check is the rule; errors come back from it. */
function StagesEditor({ stages, onSaved }: { stages: Stage[] | null; onSaved: () => void }) {
  const [rows, setRows] = useState<Stage[]>(stages?.length ? stages : [{ name: "Discovery", kind: "open" }, { name: "Proposal", kind: "open" }, { name: "Closed Won", kind: "won" }, { name: "Closed Lost", kind: "lost" }]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/coach/remote/deal-stages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stages: rows.map((x) => ({ name: x.name.trim(), kind: x.kind, ...(x.kind === "open" && x.stall_days ? { stall_days: x.stall_days } : {}) })) }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Couldn't save the stages.");
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save the stages.");
    } finally {
      setBusy(false);
    }
  };
  const move = (i: number, by: -1 | 1) => setRows((cur) => {
    const next = [...cur];
    const j = i + by;
    if (j < 0 || j >= next.length) return cur;
    [next[i], next[j]] = [next[j]!, next[i]!];
    return next;
  });
  return (
    <div className="space-y-2 rounded-xl border border-default bg-surface p-3 text-xs">
      <p className="font-semibold text-primary">Your company&apos;s deal stages</p>
      <p className="text-secondary">In the order a deal moves through them. Everyone picks from this list on a deal; names already on deals that aren&apos;t on it are kept as they are. A limit on an open stage flags a deal that sits there longer (leave it empty for no limit).</p>
      <ol className="space-y-1">
        {rows.map((s, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2">
            <span className="w-5 text-right tabular-nums text-muted">{i + 1}</span>
            <input value={s.name} maxLength={60} aria-label={`Stage ${i + 1} name`} onChange={(e) => { const v = e.currentTarget.value; setRows((cur) => cur.map((x, k) => (k === i ? { ...x, name: v } : x))); }} className={`${field} min-w-0 flex-1`} />
            <select value={s.kind} aria-label={`Stage ${i + 1} kind`} onChange={(e) => { const v = e.currentTarget.value as Stage["kind"]; setRows((cur) => cur.map((x, k) => (k === i ? { ...x, kind: v } : x))); }} className={field}>
              <option value="open">Open</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
            {s.kind === "open" && (
              <label className="flex items-center gap-1 text-[11px] text-secondary">
                stalls after
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={s.stall_days ?? ""}
                  aria-label={`Days before a deal stalls in stage ${i + 1}`}
                  onChange={(e) => { const v = e.currentTarget.value ? Math.min(365, Math.max(1, Math.round(Number(e.currentTarget.value)))) : null; setRows((cur) => cur.map((x, k) => (k === i ? { ...x, stall_days: v } : x))); }}
                  className={`${field} w-16`}
                />
                days
              </label>
            )}
            <button type="button" onClick={() => move(i, -1)} aria-label={`Move stage ${i + 1} up`} className="px-1 text-muted hover:text-primary">↑</button>
            <button type="button" onClick={() => move(i, 1)} aria-label={`Move stage ${i + 1} down`} className="px-1 text-muted hover:text-primary">↓</button>
            <button type="button" onClick={() => setRows((cur) => cur.filter((_, k) => k !== i))} aria-label={`Remove stage ${i + 1}`} className="px-1 text-muted hover:text-primary"><Trash2 className="h-3.5 w-3.5" aria-hidden /></button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={rows.length >= 20} onClick={() => setRows((cur) => [...cur, { name: "", kind: "open" }])} className="inline-flex items-center gap-1 rounded-lg border border-default px-2 py-1 text-primary disabled:opacity-50"><Plus className="h-3.5 w-3.5" aria-hidden /> Add a stage</button>
        <button type="button" disabled={busy || rows.some((x) => !x.name.trim())} onClick={() => void save()} className="rounded-lg bg-brand px-3 py-1 font-semibold text-black disabled:opacity-50">{busy ? "Saving…" : "Save stages"}</button>
      </div>
      {err && <p className="text-amber-700 dark:text-amber-300">{err}</p>}
    </div>
  );
}

/**
 * The company's playbook (0373; Gong F20.6): MEDDICC, BANT, SPICED or your own. Changing it starts every deal's letters
 * fresh under the new one; notes written under the old one stay on record with it.
 */
function PlaybookPicker({ onSaved }: { onSaved: () => void }) {
  const [current, setCurrent] = useState<{ key: string; name: string; elements: Element[] } | null | undefined>(undefined);
  const [builtIns, setBuiltIns] = useState<Record<string, { name: string; elements: Element[] }>>({});
  const [custom, setCustom] = useState<Element[]>([{ letter: "", name: "", question: "" }]);
  const [customName, setCustomName] = useState("Our playbook");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/coach/remote/playbooks", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as { playbook: { key: string; name: string; elements: Element[] } | null; builtIns: Record<string, { name: string; elements: Element[] }> };
        setCurrent(j.playbook);
        setBuiltIns(j.builtIns);
        if (j.playbook?.key === "custom") {
          setCustom(j.playbook.elements);
          setCustomName(j.playbook.name);
        }
      })
      .catch(() => setErr("Couldn't load the playbook."));
  }, []);
  const save = async (body: Record<string, unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/coach/remote/playbooks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Couldn't save the playbook.");
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save the playbook.");
    } finally {
      setBusy(false);
    }
  };
  const customCheck = parseElements(custom);
  return (
    <div className="space-y-2 rounded-xl border border-default bg-surface p-3 text-xs">
      <p className="font-semibold text-primary">Your company&apos;s deal playbook</p>
      <p className="text-secondary">
        {current === undefined ? "Loading…" : current ? `Now: ${current.name} (${current.elements.map((e) => e.letter).join(" ")}).` : "None chosen yet."} Every deal
        shows one letter per element; the AI reviewer looks for each in the deal&apos;s calls. Changing it starts the letters fresh;
        notes written under the old one stay on record.
      </p>
      <div className="flex flex-wrap gap-2">
        {Object.entries(builtIns).map(([key, b]) => (
          <button key={key} type="button" disabled={busy || current?.key === key} onClick={() => void save({ key })} className="rounded-lg border border-default px-2 py-1 text-primary disabled:opacity-50" title={b.elements.map((e) => `${e.letter} — ${e.name}`).join("\n")}>
            {current?.key === key ? `${b.name} (in use)` : `Use ${b.name}`}
          </button>
        ))}
      </div>
      <details className="rounded-lg border border-default p-2">
        <summary className="cursor-pointer text-primary">Or write your own</summary>
        <div className="mt-2 space-y-1.5">
          <input value={customName} onChange={(e) => setCustomName(e.currentTarget.value)} maxLength={40} aria-label="Playbook name" className={`${field} w-full`} />
          {custom.map((el, i) => (
            <div key={i} className="flex flex-wrap gap-1.5">
              <input value={el.letter} maxLength={3} placeholder="B" aria-label={`Element ${i + 1} label`} onChange={(e) => { const v = e.currentTarget.value; setCustom((c) => c.map((x, k) => (k === i ? { ...x, letter: v } : x))); }} className={`${field} w-12`} />
              <input value={el.name} maxLength={40} placeholder="Budget" aria-label={`Element ${i + 1} name`} onChange={(e) => { const v = e.currentTarget.value; setCustom((c) => c.map((x, k) => (k === i ? { ...x, name: v } : x))); }} className={`${field} w-32`} />
              <input value={el.question} maxLength={200} placeholder="Is there money for this?" aria-label={`Element ${i + 1} question`} onChange={(e) => { const v = e.currentTarget.value; setCustom((c) => c.map((x, k) => (k === i ? { ...x, question: v } : x))); }} className={`${field} min-w-0 flex-1`} />
              <button type="button" onClick={() => setCustom((c) => c.filter((_, k) => k !== i))} aria-label={`Remove element ${i + 1}`} className="px-1 text-muted hover:text-primary"><Trash2 className="h-3.5 w-3.5" aria-hidden /></button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={custom.length >= 10} onClick={() => setCustom((c) => [...c, { letter: "", name: "", question: "" }])} className="inline-flex items-center gap-1 rounded-lg border border-default px-2 py-1 text-primary disabled:opacity-50"><Plus className="h-3.5 w-3.5" aria-hidden /> Add an element</button>
            <button type="button" disabled={busy || !customCheck.ok || !customName.trim()} onClick={() => void save({ key: "custom", name: customName.trim(), elements: custom })} className="rounded-lg bg-brand px-3 py-1 font-semibold text-black disabled:opacity-50">Use this playbook</button>
          </div>
          {!customCheck.ok && custom.some((x) => x.letter || x.name || x.question) && <p className="text-[11px] text-muted">{customCheck.error}</p>}
        </div>
      </details>
      {err && <p className="text-amber-700 dark:text-amber-300">{err}</p>}
    </div>
  );
}
