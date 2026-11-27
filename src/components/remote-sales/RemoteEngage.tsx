"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, ListChecks, Loader2, Mail, Pause, Phone, Play, Plus, SkipForward, Trash2, X } from "lucide-react";
import { useIsSalesCoachManager } from "@/lib/hooks/useCurrentUserRole";
import type { Outcome, Step } from "@/lib/coach/remote/engage/flows";

/**
 * Remote Sales → Engage (plan E1, 0377; Gong M24 flows, F26.3 to-dos, M25 outcomes). Today: every step due across your
 * deals, oldest first — an email step opens in your own mail app (nothing is sent from here, plan E1), a call step
 * dials from your phone and asks how it went, a task is ticked off. Flows: the company's and your own, and an editor.
 */
type Item = {
  enrolmentId: string; flowName: string; prospectId: string; dealName: string | null; contactName: string | null; contactTitle: string | null;
  contactEmail?: string | null; contactPhone?: string | null;
  state: "active" | "paused" | "finished" | "removed"; stepIndex: number; stepCount: number;
  step: (Step & { text: string; subject: string }) | null; dueAt: string | null; overdue: boolean;
};
type Flow = { id: string; name: string; isCompany: boolean; steps: Step[]; mine: boolean };

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
const field = "rounded-lg border border-default bg-base px-2 py-1 text-xs text-primary";

export function RemoteEngage() {
  const isLead = useIsSalesCoachManager();
  const [tab, setTab] = useState<"today" | "flows" | "analytics" | "agents">("today");
  return (
    <section aria-label="Engage" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-primary"><ListChecks className="h-4 w-4 text-brand" aria-hidden /> Engage</h2>
        <div role="tablist" aria-label="Engage" className="inline-flex overflow-hidden rounded-lg border border-default">
          {(isLead ? (["today", "flows", "analytics", "agents"] as const) : (["today", "flows", "analytics"] as const)).map((t) => (
            <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)} className={`px-2.5 py-1 text-xs ${tab === t ? "bg-brand/15 font-semibold text-primary" : "text-secondary hover:text-primary"}`}>
              {t === "today" ? "Today" : t === "flows" ? "Flows" : t === "agents" ? "Agents" : "Analytics"}
            </button>
          ))}
        </div>
      </div>
      {tab === "today" ? <Today /> : tab === "flows" ? <Flows /> : tab === "agents" ? <Agents /> : <Analytics />}
    </section>
  );
}

function Today() {
  const isManager = useIsSalesCoachManager();
  const [scope, setScope] = useState<"mine" | "team">("mine");
  const [data, setData] = useState<{ items: Item[]; outcomes: Outcome[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    setFailed(false);
    try {
      const r = await fetch(`/api/coach/remote/engage/enrolments?scope=${scope}`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      setData(await r.json());
    } catch {
      setFailed(true);
    }
  }, [scope]);
  useEffect(() => {
    setData(null);
    void load();
  }, [load]);
  const live = useMemo(() => (data?.items ?? []).filter((i) => i.state === "active" || i.state === "paused").sort((a, b) => (a.dueAt ?? "9").localeCompare(b.dueAt ?? "9")), [data]);
  const due = live.filter((i) => i.state === "active" && i.dueAt && Date.parse(i.dueAt) <= Date.now() + 86_400_000);
  const later = live.filter((i) => !due.includes(i));
  if (failed) return <p className="text-xs text-secondary">Couldn&apos;t load your steps. Refresh to try again.</p>;
  if (!data) return <p className="flex items-center gap-2 text-xs text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading…</p>;
  return (
    <div className="space-y-3">
      {isManager && (
        <div role="group" aria-label="Whose steps" className="inline-flex overflow-hidden rounded-lg border border-default">
          {(["mine", "team"] as const).map((s) => (
            <button key={s} type="button" aria-pressed={scope === s} onClick={() => setScope(s)} className={`px-2.5 py-1 text-xs ${scope === s ? "bg-brand/15 font-semibold text-primary" : "text-secondary hover:text-primary"}`}>{s === "mine" ? "Mine" : "Team"}</button>
          ))}
        </div>
      )}
      {live.length === 0 ? (
        <div className="rounded-xl border border-default bg-surface p-4 text-xs text-secondary">
          Nothing to do yet. Make a flow under Flows, then open a deal in <Link href="/dashboard/remote-sales/pipeline" className="text-primary underline-offset-2 hover:underline">Pipeline</Link> and choose “Add to a flow”.
        </div>
      ) : (
        <>
          <p className="text-xs font-semibold text-primary">Due now and today ({due.length})</p>
          <ul className="space-y-2">{due.map((i) => <StepCard key={i.enrolmentId} item={i} outcomes={data.outcomes} onDone={load} />)}</ul>
          {later.length > 0 && (
            <>
              <p className="pt-2 text-xs font-semibold text-primary">Coming up and paused ({later.length})</p>
              <ul className="space-y-2">{later.map((i) => <StepCard key={i.enrolmentId} item={i} outcomes={data.outcomes} onDone={load} />)}</ul>
            </>
          )}
        </>
      )}
    </div>
  );
}

function StepCard({ item, outcomes, onDone }: { item: Item; outcomes: Outcome[]; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const s = item.step;
  const act = async (kind: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/coach/remote/engage/enrolments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "step", enrolmentId: item.enrolmentId, kind, ...(note.trim() ? { note: note.trim() } : {}), ...extra }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Couldn't save that.");
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  };
  const mailto = s?.kind === "email" && item.contactEmail ? `mailto:${encodeURIComponent(item.contactEmail)}?subject=${encodeURIComponent(s.subject)}&body=${encodeURIComponent(s.text)}` : null;
  return (
    <li className={`rounded-xl border bg-surface p-3 text-xs ${item.overdue && item.state === "active" ? "border-amber-500/50" : "border-default"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="min-w-0">
          <span className="inline-flex items-center gap-1 font-semibold text-primary">
            {s?.kind === "email" ? <Mail className="h-3.5 w-3.5 text-brand" aria-hidden /> : s?.kind === "call" ? <Phone className="h-3.5 w-3.5 text-brand" aria-hidden /> : <Check className="h-3.5 w-3.5 text-brand" aria-hidden />}
            {s?.subject ?? "—"}
          </span>
          <span className="block text-[11px] text-muted">
            {item.contactName ?? "Someone"}{item.contactTitle ? ` · ${item.contactTitle}` : ""} · <Link href={`/dashboard/remote-sales/pipeline?p=${item.prospectId}`} className="hover:underline">{item.dealName ?? "a deal"}</Link> · {item.flowName}, step {item.stepIndex + 1} of {item.stepCount}
          </span>
        </span>
        <span className={`text-[11px] ${item.overdue && item.state === "active" ? "text-amber-700 dark:text-amber-300" : "text-secondary"}`}>{item.state === "paused" ? "Paused" : `Due ${when(item.dueAt)}`}</span>
      </div>
      {s?.text && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-base p-2 text-secondary">{s.text}</p>}
      {item.state === "active" && s && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {s.kind === "email" && (
            <>
              {mailto ? <a href={mailto} className="inline-flex items-center gap-1 rounded-lg border border-default px-2 py-1 text-primary"><Mail className="h-3.5 w-3.5" aria-hidden /> Open in email</a> : <span className="text-[11px] text-muted">No email address on this contact — add one on the deal.</span>}
              <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(`${s.subject}\n\n${s.text}`); setCopied(true); } catch { setErr("Couldn't copy — select the text above instead."); } }} className="inline-flex items-center gap-1 rounded-lg border border-default px-2 py-1 text-primary"><Copy className="h-3.5 w-3.5" aria-hidden /> {copied ? "Copied" : "Copy"}</button>
              <button type="button" disabled={busy} onClick={() => void act("complete_step")} className="rounded-lg bg-brand px-2 py-1 font-semibold text-black disabled:opacity-50">Mark sent</button>
            </>
          )}
          {s.kind === "call" && (
            <>
              {item.contactPhone ? <a href={`tel:${item.contactPhone.replace(/[^0-9+]/g, "")}`} className="inline-flex items-center gap-1 rounded-lg border border-default px-2 py-1 text-primary"><Phone className="h-3.5 w-3.5" aria-hidden /> {item.contactPhone}</a> : <span className="text-[11px] text-muted">No phone number on this contact — add one on the deal.</span>}
              <select value={outcome} onChange={(e) => setOutcome(e.currentTarget.value)} aria-label="How the call went" className={field}>
                <option value="">How did it go?</option>
                {outcomes.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
              <button type="button" disabled={busy || !outcome} onClick={() => void act("complete_step", { outcome })} className="rounded-lg bg-brand px-2 py-1 font-semibold text-black disabled:opacity-50">Log the call</button>
            </>
          )}
          {s.kind === "task" && <button type="button" disabled={busy} onClick={() => void act("complete_step")} className="rounded-lg bg-brand px-2 py-1 font-semibold text-black disabled:opacity-50">Done</button>}
          <input value={note} onChange={(e) => setNote(e.currentTarget.value)} maxLength={1000} placeholder="Note (optional)" aria-label="Note" className={`${field} min-w-0 flex-1`} />
          <button type="button" disabled={busy} onClick={() => void act("skip_step")} title="Skip this step" aria-label="Skip this step" className="text-muted hover:text-primary"><SkipForward className="h-3.5 w-3.5" aria-hidden /></button>
          <button type="button" disabled={busy} onClick={() => void act("replied")} className="text-[11px] text-secondary hover:text-primary hover:underline">They replied</button>
          <button type="button" disabled={busy} onClick={() => void act("pause")} title="Pause" aria-label="Pause" className="text-muted hover:text-primary"><Pause className="h-3.5 w-3.5" aria-hidden /></button>
          <button type="button" disabled={busy} onClick={() => void act("remove")} title="Take them out of this flow" aria-label="Take them out of this flow" className="text-muted hover:text-primary"><X className="h-3.5 w-3.5" aria-hidden /></button>
        </div>
      )}
      {item.state === "paused" && <button type="button" disabled={busy} onClick={() => void act("resume")} className="mt-2 inline-flex items-center gap-1 text-[11px] text-secondary hover:text-primary"><Play className="h-3.5 w-3.5" aria-hidden /> Resume</button>}
      {err && <p className="mt-1 text-amber-700 dark:text-amber-300">{err}</p>}
    </li>
  );
}

function Flows() {
  const isManager = useIsSalesCoachManager();
  const [flows, setFlows] = useState<Flow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const load = useCallback(async () => {
    setFailed(false);
    try {
      const r = await fetch("/api/coach/remote/engage/flows", { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      setFlows(((await r.json()) as { flows: Flow[] }).flows);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const retire = async (id: string) => {
    const r = await fetch("/api/coach/remote/engage/flows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ retire: id }) });
    if (r.ok) void load();
  };
  if (failed) return <p className="text-xs text-secondary">Couldn&apos;t load flows. Refresh to try again.</p>;
  if (!flows) return <p className="flex items-center gap-2 text-xs text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading…</p>;
  return (
    <div className="space-y-3">
      {editing ? <FlowEditor canCompany={isManager} onSaved={() => { setEditing(false); void load(); }} onCancel={() => setEditing(false)} /> : (
        <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-black"><Plus className="h-3.5 w-3.5" aria-hidden /> New flow</button>
      )}
      {flows.length === 0 ? <p className="text-xs text-secondary">No flows yet.</p> : (
        <ul className="space-y-2">
          {flows.map((f) => (
            <li key={f.id} className="rounded-xl border border-default bg-surface p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-primary">{f.name} <span className="font-normal text-muted">· {f.isCompany ? "company" : "yours"} · {f.steps.length} step{f.steps.length === 1 ? "" : "s"}</span></span>
                {(f.mine || (f.isCompany && isManager)) && <button type="button" onClick={() => void retire(f.id)} className="text-[11px] text-muted hover:text-primary">Retire</button>}
              </div>
              <ol className="mt-1 space-y-0.5 text-secondary">
                {f.steps.map((s, i) => <li key={i}>{i + 1}. {s.kind === "email" ? "Email" : s.kind === "call" ? "Call" : "Task"}: {s.title} <span className="text-muted">— {s.delay.amount === 0 ? (i === 0 ? "right away" : "same day") : `after ${s.delay.amount} ${s.delay.unit === "hours" ? "hour" : "business day"}${s.delay.amount === 1 ? "" : "s"}`}</span></li>)}
              </ol>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FlowEditor({ canCompany, onSaved, onCancel }: { canCompany: boolean; onSaved: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [isCompany, setIsCompany] = useState(false);
  const [steps, setSteps] = useState<Step[]>([{ kind: "email", delay: { amount: 0, unit: "business_days" }, title: "Following up on our call, {first_name}", body: "Hi {first_name},\n\n" }]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (i: number, patch: Partial<Step>) => setSteps((cur) => cur.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/coach/remote/engage/flows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), isCompany, steps }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Couldn't save the flow.");
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save the flow.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2 rounded-xl border border-default bg-surface p-3 text-xs">
      <div className="flex flex-wrap gap-2">
        <input value={name} onChange={(e) => setName(e.currentTarget.value)} maxLength={80} placeholder="Flow name, e.g. After the first call" aria-label="Flow name" className={`${field} min-w-0 flex-1`} />
        {canCompany && <label className="flex items-center gap-1 text-secondary"><input type="checkbox" checked={isCompany} onChange={(e) => setIsCompany(e.currentTarget.checked)} /> For the whole company</label>}
      </div>
      <p className="text-[11px] text-muted">Use {"{first_name}"}, {"{company}"} and {"{deal}"} in a step; a blank one shows as [company] so you see it before sending.</p>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={i} className="space-y-1 rounded-lg border border-default p-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-5 text-right tabular-nums text-muted">{i + 1}</span>
              <select value={s.kind} onChange={(e) => set(i, { kind: e.currentTarget.value as Step["kind"] })} aria-label={`Step ${i + 1} kind`} className={field}>
                <option value="email">Email</option>
                <option value="call">Call</option>
                <option value="task">Task</option>
              </select>
              <span className="text-secondary">after</span>
              <input type="number" min={0} max={s.delay.unit === "hours" ? 720 : 30} value={s.delay.amount} aria-label={`Step ${i + 1} delay`} onChange={(e) => set(i, { delay: { ...s.delay, amount: Math.max(0, Math.round(Number(e.currentTarget.value) || 0)) } })} className={`${field} w-16`} />
              <select value={s.delay.unit} onChange={(e) => set(i, { delay: { ...s.delay, unit: e.currentTarget.value as "hours" | "business_days" } })} aria-label={`Step ${i + 1} delay unit`} className={field}>
                <option value="business_days">business days</option>
                <option value="hours">hours</option>
              </select>
              <button type="button" onClick={() => setSteps((cur) => cur.filter((_, k) => k !== i))} aria-label={`Remove step ${i + 1}`} className="ml-auto text-muted hover:text-primary"><Trash2 className="h-3.5 w-3.5" aria-hidden /></button>
            </div>
            <input value={s.title} onChange={(e) => set(i, { title: e.currentTarget.value })} maxLength={120} placeholder={s.kind === "email" ? "Subject" : "What to do"} aria-label={`Step ${i + 1} title`} className={`${field} w-full`} />
            {s.kind !== "task" && <textarea value={s.body ?? ""} onChange={(e) => set(i, { body: e.currentTarget.value })} maxLength={4000} rows={s.kind === "email" ? 4 : 2} placeholder={s.kind === "email" ? "Email text" : "Talking points"} aria-label={`Step ${i + 1} text`} className={`${field} w-full`} />}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={steps.length >= 15} onClick={() => setSteps((cur) => [...cur, { kind: "call", delay: { amount: 2, unit: "business_days" }, title: "Call {first_name}", body: "" }])} className="inline-flex items-center gap-1 rounded-lg border border-default px-2 py-1 text-primary disabled:opacity-50"><Plus className="h-3.5 w-3.5" aria-hidden /> Add a step</button>
        <button type="button" disabled={busy || !name.trim() || steps.length === 0 || steps.some((s) => !s.title.trim())} onClick={() => void save()} className="rounded-lg bg-brand px-3 py-1 font-semibold text-black disabled:opacity-50">{busy ? "Saving…" : "Save flow"}</button>
        <button type="button" onClick={onCancel} className="px-2 text-muted hover:text-primary">Cancel</button>
      </div>
      {err && <p className="text-amber-700 dark:text-amber-300">{err}</p>}
    </div>
  );
}

type StatRow = { key: string; name?: string; people: number; stepsDone: number; emails: number; calls: number; connectRate: number | null; meetings: number; replies: number; optOuts: number };
/** Engage → Analytics (plan E2; Gong F26.7–F26.9): per flow and per rep, over 30 or 90 days. */
function Analytics() {
  const [days, setDays] = useState<30 | 90>(30);
  const [data, setData] = useState<{ byFlow: StatRow[]; byRep: StatRow[]; viewerId: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    let live = true;
    setData(null);
    setFailed(false);
    fetch(`/api/coach/remote/engage/stats?days=${days}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        const j = await r.json();
        if (live) setData(j);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [days]);
  useEffect(() => {
    fetch("/api/team")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { members?: Array<{ id: string; full_name?: string | null }> }) => setNames(new Map((d.members ?? []).map((m) => [m.id, m.full_name ?? "A rep"]))))
      .catch(() => setNames(new Map())); // names are labels only; ids still show as "A rep"
  }, []);
  const table = (title: string, rows: StatRow[], label: (r: StatRow) => string) => (
    <div className="overflow-x-auto rounded-xl border border-default bg-surface">
      <table className="w-full min-w-[40rem] text-left text-xs">
        <thead className="text-[10px] uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">{title}</th>
            <th className="px-3 py-2 text-right font-medium">People</th>
            <th className="px-3 py-2 text-right font-medium">Steps done</th>
            <th className="px-3 py-2 text-right font-medium">Emails</th>
            <th className="px-3 py-2 text-right font-medium">Calls</th>
            <th className="px-3 py-2 text-right font-medium" title="Connected outcomes ÷ calls with an outcome">Connect rate</th>
            <th className="px-3 py-2 text-right font-medium">Meetings</th>
            <th className="px-3 py-2 text-right font-medium">Replies</th>
            <th className="px-3 py-2 text-right font-medium">Opt-outs</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-default">
              <td className="px-3 py-2 text-primary">{label(r)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-secondary">{r.people}</td>
              <td className="px-3 py-2 text-right tabular-nums text-secondary">{r.stepsDone}</td>
              <td className="px-3 py-2 text-right tabular-nums text-secondary">{r.emails}</td>
              <td className="px-3 py-2 text-right tabular-nums text-secondary">{r.calls}</td>
              <td className="px-3 py-2 text-right tabular-nums text-primary">{r.connectRate === null ? "—" : `${Math.round(r.connectRate * 100)}%`}</td>
              <td className="px-3 py-2 text-right tabular-nums text-primary">{r.meetings}</td>
              <td className="px-3 py-2 text-right tabular-nums text-secondary">{r.replies}</td>
              <td className="px-3 py-2 text-right tabular-nums text-secondary">{r.optOuts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="space-y-3">
      <div role="group" aria-label="Period" className="inline-flex overflow-hidden rounded-lg border border-default">
        {([30, 90] as const).map((d) => (
          <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)} className={`px-2.5 py-1 text-xs ${days === d ? "bg-brand/15 font-semibold text-primary" : "text-secondary hover:text-primary"}`}>{d} days</button>
        ))}
      </div>
      {failed ? <p className="text-xs text-secondary">Couldn&apos;t load Engage analytics. Refresh to try again.</p> : !data ? (
        <p className="flex items-center gap-2 text-xs text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading…</p>
      ) : data.byFlow.length === 0 ? (
        <p className="text-xs text-secondary">No one has been in a flow yet.</p>
      ) : (
        <>
          {table("Flow", data.byFlow, (r) => r.name ?? "A flow")}
          {table("Rep", data.byRep, (r) => (r.key === data.viewerId ? "You" : names.get(r.key) ?? "A rep"))}
          <p className="text-[11px] text-muted">Steps, calls and outcomes in the last {days} days; people counts everyone ever enrolled. Connect rate counts calls with an outcome.</p>
        </>
      )}
    </div>
  );
}

type AgentAction = { kind: "brief" } | { kind: "notify"; to: "rep" | "owner" } | { kind: "todo"; title: string; due_days?: number } | { kind: "webhook" };
type AgentRow = { id: string; name: string; trigger: { kind?: string; status?: string; label?: string; tracker_id?: string; days?: number }; actions: AgentAction[]; enabled: boolean };
type RunRow = { id: number; agent_id: string; prospect_id: string | null; test: boolean; ok: boolean; skipped: string | null; results: Array<{ kind: string; ok: boolean; detail: string }>; created_at: string };
const ACTION_WORD = (a: AgentAction) => (a.kind === "brief" ? "write the deal brief" : a.kind === "notify" ? (a.to === "rep" ? "notify the deal's rep" : "notify me") : a.kind === "todo" ? `add the to-do “${a.title}”${a.due_days ? ` due in ${a.due_days} days` : ""}` : "send an agent.ran webhook");

/**
 * Engage → Agents (plan E5, 0379; Gong M27): when a deal reaches a stage (or is won or lost), do these things in order.
 * An agent acts only on deals its owner can see. Each run is listed with what every action did; a test run on a chosen
 * deal says what would happen and changes nothing.
 */
function useTrackers() {
  const [trackers, setTrackers] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    fetch("/api/coach/remote/trackers", { cache: "no-store" })
      .then(async (r) => { if (!r.ok) throw new Error(String(r.status)); const j = (await r.json()) as { trackers?: Array<{ id: string; name: string }> }; setTrackers(j.trackers ?? []); })
      .catch(() => setTrackers([])); // names only: an agent still shows as "a tracker"
  }, []);
  return trackers;
}

function Agents() {
  const trackers = useTrackers();
  const trackerName = (id?: string) => trackers.find((t) => t.id === id)?.name ?? null;
  const [data, setData] = useState<{ agents: AgentRow[]; runs: RunRow[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [deals, setDeals] = useState<Array<{ id: string; name: string | null }>>([]);
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => {
    setFailed(false);
    try {
      const r = await fetch("/api/coach/remote/agents", { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      setData(await r.json());
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    void load();
    fetch("/api/coach/remote/prospects?repId=team", { cache: "no-store" })
      .then(async (r) => { if (!r.ok) throw new Error(String(r.status)); const j = (await r.json()) as { prospects: Array<{ id: string; name: string | null }> }; setDeals(j.prospects.slice(0, 200)); })
      .catch(() => setMsg("Couldn't load deals to test on."));
  }, [load]);
  const post = async (body: Record<string, unknown>) => {
    setMsg(null);
    const r = await fetch("/api/coach/remote/agents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = (await r.json().catch(() => ({}))) as { error?: string; ok?: boolean; skipped?: string | null; results?: Array<{ detail: string }> };
    if (!r.ok) return setMsg(j.error ?? "Couldn't save that.");
    if ("test" in body) setMsg(j.skipped ? `Test: ${j.skipped}` : `Test: ${(j.results ?? []).map((x) => x.detail).join(" ")}`);
    void load();
  };
  if (failed) return <p className="text-xs text-secondary">Couldn&apos;t load agents. Refresh to try again.</p>;
  if (!data) return <p className="flex items-center gap-2 text-xs text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading…</p>;
  return (
    <div className="space-y-3 text-xs">
      {editing ? <AgentEditor onSaved={() => { setEditing(false); void load(); }} onCancel={() => setEditing(false)} /> : (
        <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 font-semibold text-black"><Plus className="h-3.5 w-3.5" aria-hidden /> New agent</button>
      )}
      {msg && <p className="text-secondary">{msg}</p>}
      {data.agents.length === 0 ? <p className="text-secondary">No agents yet. An agent does things for you when a deal reaches a stage — for example, writes the brief and adds a to-do when a deal reaches “Proposal”.</p> : (
        <ul className="space-y-2">
          {data.agents.map((a) => (
            <li key={a.id} className="rounded-xl border border-default bg-surface p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-primary">{a.name}{!a.enabled && <span className="ml-1 font-normal text-muted">(off)</span>}</span>
                <span className="flex flex-wrap items-center gap-2">
                  <select defaultValue="" aria-label={`Test ${a.name} on a deal`} onChange={(e) => { if (e.currentTarget.value) void post({ test: a.id, prospectId: e.currentTarget.value }); e.currentTarget.value = ""; }} className={field}>
                    <option value="">Test on a deal…</option>
                    {deals.map((d) => <option key={d.id} value={d.id}>{d.name ?? "Unnamed deal"}</option>)}
                  </select>
                  <button type="button" onClick={() => void post({ id: a.id, enabled: !a.enabled })} className="text-secondary hover:text-primary">{a.enabled ? "Turn off" : "Turn on"}</button>
                  <button type="button" onClick={() => void post({ retire: a.id })} className="text-muted hover:text-primary">Retire</button>
                </span>
              </div>
              <p className="mt-1 text-secondary">
                {a.trigger.kind === "close_date_near" ? <>When an open deal&apos;s close date is {a.trigger.days} day{a.trigger.days === 1 ? "" : "s"} away (checked each night): {a.actions.map(ACTION_WORD).join(", then ")}.</> : a.trigger.kind === "tracker_heard" ? <>When a tracker{trackerName(a.trigger.tracker_id) ? ` (“${trackerName(a.trigger.tracker_id)}”)` : ""} is first heard on a deal&apos;s call: {a.actions.map(ACTION_WORD).join(", then ")}.</> : <>
                When a deal {a.trigger.label ? `reaches “${a.trigger.label}”` : ""}{a.trigger.label && a.trigger.status ? " and " : ""}{a.trigger.status ? (a.trigger.status === "won" ? "is won" : a.trigger.status === "lost" ? "is lost" : "is open") : ""}: {a.actions.map(ACTION_WORD).join(", then ")}.</>}
              </p>
              <ul className="mt-1 space-y-0.5">
                {data.runs.filter((r) => r.agent_id === a.id).slice(0, 5).map((r) => (
                  <li key={r.id} className={r.ok ? "text-muted" : "text-amber-700 dark:text-amber-300"}>
                    {new Date(r.created_at).toLocaleString()} · {r.test ? "test · " : ""}{r.skipped ?? r.results.map((x) => x.detail).join(" ")}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AgentEditor({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const trackers = useTrackers();
  const [when, setWhen] = useState<"stage" | "tracker" | "close">("stage");
  const [closeDays, setCloseDays] = useState(7);
  const [trackerId, setTrackerId] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [label, setLabel] = useState("");
  const [brief, setBrief] = useState(true);
  const [notify, setNotify] = useState<"" | "rep" | "owner">("rep");
  const [todo, setTodo] = useState("");
  const [days, setDays] = useState(2);
  const [webhook, setWebhook] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const actions: AgentAction[] = [
    ...(brief ? [{ kind: "brief" } as const] : []),
    ...(notify ? [{ kind: "notify", to: notify } as const] : []),
    ...(todo.trim() ? [{ kind: "todo", title: todo.trim(), due_days: days } as const] : []),
    ...(webhook ? [{ kind: "webhook" } as const] : []),
  ];
  const save = async () => {
    setErr(null);
    const r = await fetch("/api/coach/remote/agents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), trigger: when === "close" ? { kind: "close_date_near", days: closeDays } : when === "tracker" ? { kind: "tracker_heard", tracker_id: trackerId } : { kind: "deal_stage", ...(status ? { status } : {}), ...(label.trim() ? { label: label.trim() } : {}) }, actions }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) return setErr(j.error ?? "Couldn't save the agent.");
    onSaved();
  };
  return (
    <div className="space-y-2 rounded-xl border border-default bg-surface p-3">
      <input value={name} onChange={(e) => setName(e.currentTarget.value)} maxLength={80} placeholder="Agent name, e.g. Proposal prep" aria-label="Agent name" className={`${field} w-full`} />
      <div role="group" aria-label="When it runs" className="inline-flex overflow-hidden rounded-lg border border-default">
        {(["stage", "tracker", "close"] as const).map((w) => (
          <button key={w} type="button" aria-pressed={when === w} onClick={() => setWhen(w)} className={`px-2.5 py-1 ${when === w ? "bg-brand/15 font-semibold text-primary" : "text-secondary hover:text-primary"}`}>{w === "stage" ? "A deal reaches a stage" : w === "tracker" ? "A tracker is heard on a deal's call" : "A close date is near"}</button>
        ))}
      </div>
      {when === "close" ? (
        <div className="space-y-1 text-secondary">
          <div className="flex flex-wrap items-center gap-2">
            When an open deal&apos;s expected close date is
            <input type="number" min={1} max={60} value={closeDays} onChange={(e) => setCloseDays(Math.min(60, Math.max(1, Number(e.currentTarget.value) || 1)))} aria-label="Days before the close date" className={`${field} w-16`} />
            days away or less
          </div>
          <p className="text-[11px] text-muted">Checked each night, once per deal and close date.</p>
        </div>
      ) : when === "tracker" ? (
        <div className="flex flex-wrap items-center gap-2 text-secondary">
          When
          <select value={trackerId} onChange={(e) => setTrackerId(e.currentTarget.value)} aria-label="Tracker" className={field}>
            <option value="">pick a tracker…</option>
            {trackers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          is first heard on one of a deal&apos;s calls
        </div>
      ) : (
      <div className="flex flex-wrap items-center gap-2 text-secondary">
        When a deal
        <input value={label} onChange={(e) => setLabel(e.currentTarget.value)} list="stage-names-in-use" maxLength={60} placeholder="reaches this stage (optional)" aria-label="Stage" className={`${field} w-48`} />
        <select value={status} onChange={(e) => setStatus(e.currentTarget.value)} aria-label="Status" className={field}>
          <option value="">(any status)</option>
          <option value="won">is won</option>
          <option value="lost">is lost</option>
          <option value="open">is open</option>
        </select>
      </div>
      )}
      <div className="space-y-1 text-secondary">
        <label className="flex items-center gap-1"><input type="checkbox" checked={brief} onChange={(e) => setBrief(e.currentTarget.checked)} /> Write the deal brief</label>
        <label className="flex items-center gap-1">
          Notify
          <select value={notify} onChange={(e) => setNotify(e.currentTarget.value as "" | "rep" | "owner")} aria-label="Who to notify" className={field}>
            <option value="rep">the deal&apos;s rep</option>
            <option value="owner">me</option>
            <option value="">no one</option>
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-1">
          Add the to-do
          <input value={todo} onChange={(e) => setTodo(e.currentTarget.value)} maxLength={200} placeholder="e.g. Send the proposal (optional)" aria-label="To-do" className={`${field} min-w-0 flex-1`} />
          due in <input type="number" min={0} max={365} value={days} onChange={(e) => setDays(Math.max(0, Math.min(365, Math.round(Number(e.currentTarget.value) || 0))))} aria-label="Due in days" className={`${field} w-14`} /> days
        </div>
        <label className="flex items-center gap-1"><input type="checkbox" checked={webhook} onChange={(e) => setWebhook(e.currentTarget.checked)} /> Send an agent.ran webhook (to webhooks listening for it, on Protection)</label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!name.trim() || (when === "stage" ? !status && !label.trim() : when === "tracker" ? !trackerId : false) || actions.length === 0} onClick={() => void save()} className="rounded-lg bg-brand px-3 py-1 font-semibold text-black disabled:opacity-50">Save agent</button>
        <button type="button" onClick={onCancel} className="px-2 text-muted hover:text-primary">Cancel</button>
      </div>
      {err && <p className="text-amber-700 dark:text-amber-300">{err}</p>}
    </div>
  );
}
