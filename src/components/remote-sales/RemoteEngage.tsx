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
  const [tab, setTab] = useState<"today" | "flows">("today");
  return (
    <section aria-label="Engage" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-primary"><ListChecks className="h-4 w-4 text-brand" aria-hidden /> Engage</h2>
        <div role="tablist" aria-label="Engage" className="inline-flex overflow-hidden rounded-lg border border-default">
          {(["today", "flows"] as const).map((t) => (
            <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)} className={`px-2.5 py-1 text-xs ${tab === t ? "bg-brand/15 font-semibold text-primary" : "text-secondary hover:text-primary"}`}>
              {t === "today" ? "Today" : "Flows"}
            </button>
          ))}
        </div>
      </div>
      {tab === "today" ? <Today /> : <Flows />}
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
