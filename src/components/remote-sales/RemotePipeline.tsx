"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Check, GraduationCap, Loader2, Phone, Plus, Sparkles, Video, X } from "lucide-react";
import { useIsSalesCoachManager, useCurrentUserRole, isCompanyAdminRole } from "@/lib/hooks/useCurrentUserRole";
import { TASK_STATUS_TRANSITIONS } from "@/lib/tasks/statusLabels";
import { stepsToCompleted } from "@/lib/coach/remote/macroMode";
import { downloadIcs } from "@/lib/coach/remote/ics";
import { stagesInUse } from "@/lib/coach/remote/stageTraining";
import { addDays, weekStart } from "@/lib/coach/remote/calendar";
import { RemoteCalendar } from "./RemoteCalendar";
import { PromptLibrary } from "./PromptLibrary";
import { NO_SOURCE, sourceBreakdown, sourcesInUse } from "@/lib/coach/remote/leadSource";
import { byQuarter, dealRisk, forecast, forecastByMonth, MIN_CLOSED_FOR_FORECAST, RISK_WORDS, withMovedDates } from "@/lib/coach/remote/dealRisk";

/**
 * Remote Sales → Pipeline (Macro Mode, docs/rss/MACRO-MODE-SPEC.md, 0303) — ELOSTATE's own simple CRM, so a rep does
 * not have to leave for HubSpot and come back.
 *
 *   Top tabs: Open ($ total) · Closed Won · Closed Lost.
 *   Per prospect: To do (the one that matters next — "so things don't slip through the crack"), stage, next call date,
 *   last call date (derived from the calls linked to it, never typed), deal amount.
 *   A manager can open a report's pipeline, or the whole team's (the spec's one manager addition).
 *
 * Every number comes from the server's read of the event log (remote_prospects_current); this screen keeps no copy.
 */
type Prospect = {
  id: string;
  repId: string;
  name: string | null;
  organization: string | null;
  status: "open" | "won" | "lost";
  stageLabel: string | null;
  source: string | null;
  amount: number | null;
  nextCallDate: string | null;
  nextCallTime?: string | null;
  closeDate?: string | null;
  lastCallAt: string | null;
  callCount: number;
  createdAt: string;
  openTodos: number;
  nextTodo: { id: string; title: string; due: string | null } | null;
  sentiment?: { last: "warming" | "cooling" | "flat"; trend: "warming" | "cooling" | "steady" | null; calls: number } | null;
};
type Totals = Record<"open" | "won" | "lost", { count: number; amount: number }>;

/** "15:00" → the viewer's own clock format, e.g. "3:00 PM" (0325). */
const clock = (hm: string) => new Date(`2000-01-01T${hm}:00`).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const money = (n: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const shortDate = (iso: string | null) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—");

export function RemotePipeline() {
  const router = useRouter();
  const params = useSearchParams();
  const selected = params.get("p");
  const scManager = useIsSalesCoachManager();
  const role = useCurrentUserRole();
  const isManager = scManager || isCompanyAdminRole(role);

  const [tab, setTab] = useState<"open" | "won" | "lost">("open");
  const [view, setView] = useState<"list" | "calendar" | "sources" | "forecast">("list");
  const [whose, setWhose] = useState<string>("mine");
  const [people, setPeople] = useState<Array<{ id: string; name: string }>>([]);
  const [peopleFailed, setPeopleFailed] = useState(false);
  const [data, setData] = useState<{ prospects: Prospect[]; totals: Totals; viewerId: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const q = whose === "mine" ? "" : `?repId=${encodeURIComponent(whose)}`;
      const r = await fetch(`/api/coach/remote/prospects${q}`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      setData(await r.json());
    } catch {
      // Clear what was shown (2026-11-23): otherwise, after switching "Whose pipeline", the stage totals kept the
      // PREVIOUS person's amounts and counts above "Couldn't load the pipeline".
      setData(null);
      setFailed(true);
    }
  }, [whose]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!isManager) return;
    fetch("/api/team")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { members?: Array<{ id: string; full_name?: string | null }> } | null) =>
        setPeople((d?.members ?? []).map((m) => ({ id: m.id, name: m.full_name ?? "Unnamed teammate" }))),
      )
      // Without the team the list offers only "mine" and "team"; say why (2026-11-23).
      .catch(() => setPeopleFailed(true));
  }, [isManager]);

  const rows = useMemo(() => (data?.prospects ?? []).filter((p) => p.status === tab), [data, tab]);
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? null;
  const open = (id: string | null) => router.replace(id ? `/dashboard/remote-sales/pipeline?p=${id}` : "/dashboard/remote-sales/pipeline", { scroll: false });
  // Go to a prospect from elsewhere on the page (an Ask answer, the calendar): the list, on the tab that holds it — a
  // closed prospect would otherwise "open" on a tab that isn't showing.
  const goTo = (id: string) => {
    const p = data?.prospects.find((x) => x.id === id);
    if (p) setTab(p.status);
    setView("list");
    open(id);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-primary">Pipeline</h2>
        <div className="flex flex-wrap items-center gap-2">
          {isManager && (
            <select
              value={whose}
              onChange={(e) => setWhose(e.currentTarget.value)}
              aria-label="Whose pipeline"
              className="rounded-lg border border-default bg-surface px-2 py-1.5 text-xs text-primary"
            >
              <option value="mine">My pipeline</option>
              <option value="team">My team&apos;s pipeline</option>
              {peopleFailed && <option disabled>Couldn&apos;t load your reports — refresh</option>}
              {people
                .filter((p) => p.id !== data?.viewerId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          )}
          <div role="group" aria-label="View" className="inline-flex overflow-hidden rounded-lg border border-default">
            {(["list", "calendar", "sources", "forecast"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`px-2.5 py-1.5 text-xs ${view === v ? "bg-brand/15 font-semibold text-primary" : "bg-surface text-secondary hover:text-primary"}`}
              >
                {v === "list" ? "List" : v === "calendar" ? "Calendar" : v === "sources" ? "Sources" : "Forecast"}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setAdding((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-black">
            <Plus className="h-3.5 w-3.5" aria-hidden /> New prospect
          </button>
        </div>
      </div>

      {adding && <NewProspect onDone={(id) => { setAdding(false); void load(); if (id) open(id); }} />}

      {/* One datalist of the sources already used in this pipeline, for every source box on the page. */}
      <datalist id="lead-sources">{sourcesInUse(data?.prospects ?? []).map((s) => <option key={s} value={s} />)}</datalist>
      {/* Stage names already used in this pipeline (2026-11-23): picking one keeps spellings the same, so a practice
          scenario tagged "Demo" reaches every prospect at "Demo" (stage tags match on the normalised name). */}
      <datalist id="stage-names-in-use">{stagesInUse((data?.prospects ?? []).map((p) => p.stageLabel)).map((s) => <option key={s} value={s} />)}</datalist>
      {view === "calendar" ? (
        <RemoteCalendar key={whose} scope={whose} nameOf={nameOf} onOpenProspect={goTo} />
      ) : view === "sources" ? (
        <SourcesView prospects={data?.prospects ?? null} failed={failed} />
      ) : view === "forecast" ? (
        <>
          <ForecastView prospects={data?.prospects ?? null} failed={failed} onOpen={goTo} />
          {data && <PipelineChanges key={whose} whose={whose} onOpen={goTo} />}
        </>
      ) : (
        <>
      <div role="tablist" aria-label="Pipeline stages" className="grid grid-cols-3 gap-2">
        {([
          ["open", "Open"],
          ["won", "Closed Won"],
          ["lost", "Closed Lost"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`rounded-xl border p-3 text-left transition-colors ${tab === k ? "border-brand bg-brand/10" : "border-default bg-surface hover:border-brand/60"}`}
          >
            <p className="text-[11px] uppercase tracking-wider text-muted">{label}</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-primary">{data ? money(data.totals[k].amount) : "—"}</p>
            <p className="text-[11px] text-secondary">{data ? `${data.totals[k].count} ${data.totals[k].count === 1 ? "prospect" : "prospects"}` : ""}</p>
          </button>
        ))}
      </div>

      {data && data.prospects.length > 0 && <AskPipeline key={whose} scope={whose} onOpen={goTo} />}

      {failed ? (
        <p className="rounded-xl border border-default bg-surface p-6 text-center text-xs text-muted">Couldn&apos;t load the pipeline. Refresh to try again.</p>
      ) : !data ? (
        <p className="flex items-center justify-center gap-2 p-6 text-xs text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading pipeline…
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-default bg-surface p-6 text-center text-xs text-secondary">
          {tab === "open"
            ? "No open prospects yet. Add one, or open a call and choose “Add to pipeline”."
            : tab === "won"
              ? "No closed-won deals yet."
              : "No closed-lost deals."}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((p) => {
            const overdue = !!p.nextTodo?.due && p.nextTodo.due < today();
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => open(selected === p.id ? null : p.id)}
                  aria-expanded={selected === p.id}
                  className={`w-full rounded-xl border bg-surface p-3 text-left hover:border-brand ${selected === p.id ? "border-brand" : "border-default"}`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-primary">{p.name ?? "Unnamed prospect"}</span>
                      <span className="block truncate text-[11px] text-muted">
                        {[p.organization, p.stageLabel, whose !== "mine" ? nameOf(p.repId) : null].filter(Boolean).join(" · ") || "No stage set"}
                      </span>
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-primary">{p.amount !== null ? money(p.amount) : "—"}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-1 text-[11px] sm:grid-cols-3">
                    <span className={`flex items-center gap-1 ${overdue ? "text-amber-700 dark:text-amber-300" : "text-secondary"}`}>
                      {overdue && <AlertCircle className="h-3 w-3" aria-hidden />}
                      To do: {p.nextTodo ? `${p.nextTodo.title}${p.nextTodo.due ? ` (${shortDate(p.nextTodo.due)})` : ""}` : "nothing open"}
                      {p.openTodos > 1 ? ` +${p.openTodos - 1}` : ""}
                    </span>
                    <span className="text-secondary">
                      Next call: {shortDate(p.nextCallDate)}
                      {p.nextCallDate && p.nextCallTime ? ` · ${clock(p.nextCallTime)}` : ""}
                    </span>
                    <span className="text-secondary">
                      Last call: {shortDate(p.lastCallAt)}
                      {p.closeDate ? ` · Close: ${shortDate(p.closeDate)}` : ""}
                    </span>
                  </div>
                  <SentimentLine s={p.sentiment ?? null} />
                  <RiskLine p={p} />
                </button>
                {selected === p.id && <ProspectDetail id={p.id} onChanged={() => void load()} onClose={() => open(null)} />}
              </li>
            );
          })}
        </ul>
      )}
        </>
      )}
    </div>
  );
}

function NewProspect({ onDone }: { onDone: (id: string | null) => void }) {
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [amount, setAmount] = useState("");
  const [next, setNext] = useState("");
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const a = amount.trim() ? Number(amount.replace(/[^0-9.]/g, "")) : undefined;
      const r = await fetch("/api/coach/remote/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          ...(org.trim() ? { organization: org.trim() } : {}),
          ...(a !== undefined && Number.isFinite(a) ? { amount: a } : {}),
          ...(next ? { nextCallDate: next } : {}),
          ...(source.trim() ? { source: source.trim() } : {}),
        }),
      });
      const d = (await r.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!r.ok) throw new Error(d.error ?? "Couldn't add the prospect.");
      onDone(d.id ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't add the prospect.");
    } finally {
      setBusy(false);
    }
  };
  const field = "rounded-lg border border-default bg-base px-2 py-1.5 text-sm text-primary";
  return (
    <div className="rounded-xl border border-default bg-surface p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.currentTarget.value)} placeholder="Prospect name (required)" aria-label="Prospect name" className={field} />
        <input value={org} onChange={(e) => setOrg(e.currentTarget.value)} placeholder="Company (optional)" aria-label="Company" className={field} />
        <input value={amount} onChange={(e) => setAmount(e.currentTarget.value)} placeholder="Deal amount, e.g. 1500" inputMode="decimal" aria-label="Deal amount" className={field} />
        <label className="flex items-center gap-2 text-xs text-secondary">
          Next call
          <input type="date" value={next} onChange={(e) => setNext(e.currentTarget.value)} className={field} />
        </label>
        <input value={source} onChange={(e) => setSource(e.currentTarget.value)} list="lead-sources" maxLength={60} placeholder="Lead source, e.g. Webinar (optional)" aria-label="Lead source" className={field} />
      </div>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={() => void save()} disabled={busy || !name.trim()} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50">
          {busy ? "Adding…" : "Add to pipeline"}
        </button>
        <button type="button" onClick={() => onDone(null)} className="rounded-lg border border-default px-3 py-1.5 text-xs text-secondary">
          Cancel
        </button>
      </div>
      {err && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{err}</p>}
    </div>
  );
}

type Detail = {
  prospect: { id: string; name: string | null; organization: string | null; status: string; stage_label: string | null; amount: number | string | null; next_call_date: string | null; source?: string | null; close_date?: string | null; next_call_time?: string | null };
  calls: Array<{ id: string; label: string | null; context: string; startedAt: string; outcome: string | null }>;
  todos: Array<{ id: string; title: string; due: string | null; status: string; done: boolean }>;
};

function ProspectDetail({ id, onChanged, onClose }: { id: string; onChanged: () => void; onClose: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [todo, setTodo] = useState("");
  const [due, setDue] = useState("");
  // The next call's date and time (0325) are one fact: each input sends both, so changing one keeps the other.
  const callDateRef = useRef<HTMLInputElement>(null);
  const callTimeRef = useRef<HTMLInputElement>(null);
  const setNextCall = () => {
    const date = callDateRef.current?.value || null;
    const time = callTimeRef.current?.value || null;
    void post({ action: "set", kind: "next_call", value: date ? { date, time } : null });
  };

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/coach/remote/prospects/${id}`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      setD(await r.json());
    } catch {
      setErr("Couldn't load this prospect.");
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/coach/remote/prospects/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Couldn't save that.");
      await load();
      onChanged();
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save that.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  // "Done" walks the Tasks module's own transition graph through its own route — e.g. To Do → In Progress → Completed.
  const done = async (t: Detail["todos"][number]) => {
    setBusy(true);
    setErr(null);
    try {
      for (const status of stepsToCompleted(t.status, TASK_STATUS_TRANSITIONS)) {
        const r = await fetch("/api/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: t.id, status }) });
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? "Couldn't mark it done.");
        }
      }
      await load();
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't mark it done.");
    } finally {
      setBusy(false);
    }
  };

  if (!d) return <p className="mt-1 px-3 py-2 text-xs text-muted">{err ?? "Loading…"}</p>;
  const p = d.prospect;
  const field = "rounded-lg border border-default bg-base px-2 py-1 text-xs text-primary";
  return (
    <div className="mt-1 space-y-3 rounded-xl border border-default bg-base/40 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-primary">{p.name ?? "Unnamed prospect"}</p>
        <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-primary">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 text-xs text-secondary sm:grid-cols-2">
        <label className="flex items-center gap-2">
          Stage
          <select
            value={p.status}
            disabled={busy}
            onChange={(e) => void post({ action: "set", kind: "stage", value: { status: e.currentTarget.value, ...(p.stage_label ? { label: p.stage_label } : {}) } })}
            className={field}
          >
            <option value="open">Open</option>
            <option value="won">Closed Won</option>
            <option value="lost">Closed Lost</option>
          </select>
          <input
            defaultValue={p.stage_label ?? ""}
            placeholder="e.g. Proposal"
            aria-label="Stage name"
            list="stage-names-in-use"
            maxLength={60}
            onBlur={(e) => {
              const v = e.currentTarget.value.trim();
              if (v !== (p.stage_label ?? "")) void post({ action: "set", kind: "stage", value: { status: p.status, ...(v ? { label: v } : {}) } });
            }}
            className={`${field} min-w-0 flex-1`}
          />
        </label>
        <label className="flex items-center gap-2">
          Amount
          <input
            defaultValue={p.amount ?? ""}
            inputMode="decimal"
            aria-label="Deal amount"
            onBlur={(e) => {
              const v = Number(e.currentTarget.value.replace(/[^0-9.]/g, ""));
              if (e.currentTarget.value.trim() && Number.isFinite(v) && v !== Number(p.amount)) void post({ action: "set", kind: "amount", value: v });
            }}
            className={`${field} w-28`}
          />
        </label>
        <label className="flex items-center gap-2">
          Next call
          <input ref={callDateRef} type="date" defaultValue={p.next_call_date ?? ""} disabled={busy} aria-label="Next call date" onChange={setNextCall} className={field} />
          <input ref={callTimeRef} type="time" defaultValue={p.next_call_time ?? ""} disabled={busy || !p.next_call_date} aria-label="Next call time" onBlur={(e) => { if ((e.currentTarget.value || null) !== (p.next_call_time ?? null)) setNextCall(); }} className={`${field} w-28`} />
        </label>
        <label className="flex items-center gap-2">
          Expected close
          <input type="date" defaultValue={p.close_date ?? ""} disabled={busy} aria-label="Expected close date" onChange={(e) => void post({ action: "set", kind: "close_date", value: e.currentTarget.value || null })} className={field} />
        </label>
        <label className="flex items-center gap-2">
          Source
          <input
            defaultValue={p.source ?? ""}
            list="lead-sources"
            maxLength={60}
            placeholder="e.g. Referral"
            aria-label="Lead source"
            onBlur={(e) => {
              const v = e.currentTarget.value.trim();
              if (v && v !== (p.source ?? "")) void post({ action: "set", kind: "source", value: v });
            }}
            className={`${field} w-36`}
          />
        </label>
      </div>

      {(p.next_call_date || d.todos.some((t) => !t.done && t.due)) && (
        <button
          type="button"
          onClick={() =>
            downloadIcs(`${p.name ?? "prospect"}-reminders`, [
              ...(p.next_call_date ? [{ uid: `${p.id}-next-call-${p.next_call_date}`, date: p.next_call_date, time: p.next_call_time ?? null, title: `Call ${p.name ?? "prospect"}` }] : []),
              ...d.todos.filter((t) => !t.done && t.due).map((t) => ({ uid: `${t.id}-todo`, date: t.due!, title: `${t.title} (${p.name ?? "prospect"})` })),
            ].map((e) => ({ ...e, url: `${window.location.origin}/dashboard/remote-sales/pipeline?p=${p.id}` })))
          }
          className="text-[11px] text-secondary underline-offset-2 hover:text-primary hover:underline"
        >
          Add the next call and dated to-dos to my calendar
        </button>
      )}
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">To do</p>
        {d.todos.length === 0 && <p className="text-xs text-secondary">Nothing yet.</p>}
        <ul className="space-y-1">
          {d.todos.map((t) => (
            <li key={t.id} className="flex items-center gap-2 text-sm">
              <button
                type="button"
                disabled={busy || t.done}
                onClick={() => void done(t)}
                aria-label={t.done ? `${t.title} is done` : `Mark done: ${t.title}`}
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${t.done ? "border-brand bg-brand text-black" : "border-default hover:border-brand"}`}
              >
                {t.done && <Check className="h-3 w-3" aria-hidden />}
              </button>
              <span className={t.done ? "text-muted line-through" : "text-primary"}>{t.title}</span>
              {t.due && <span className={`text-[11px] ${!t.done && t.due < today() ? "text-amber-700 dark:text-amber-300" : "text-muted"}`}>{shortDate(t.due)}</span>}
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap gap-2">
          <input value={todo} onChange={(e) => setTodo(e.currentTarget.value)} placeholder="e.g. Send Betty the follow-up email" aria-label="New to-do" className={`${field} min-w-0 flex-1 text-sm`} />
          <input type="date" value={due} onChange={(e) => setDue(e.currentTarget.value)} aria-label="Due date" className={field} />
          <button
            type="button"
            disabled={busy || !todo.trim()}
            onClick={async () => {
              if (await post({ action: "todo", title: todo.trim(), due: due || null })) {
                setTodo("");
                setDue("");
              }
            }}
            className="rounded-lg border border-default px-2 py-1 text-xs text-primary disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      {d.prospect.status === "open" && d.prospect.stage_label && <StagePractice key={d.prospect.stage_label} prospectId={id} />}

      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Calls</p>
        {d.calls.length === 0 ? (
          <p className="text-xs text-secondary">No calls linked yet. Open a call and choose “Add to pipeline”.</p>
        ) : (
          <ul className="space-y-1">
            {d.calls.map((c) => (
              <li key={c.id}>
                <Link href={`/dashboard/remote-sales/calls/${c.id}`} className="flex items-center gap-2 text-xs text-primary hover:underline">
                  {c.context === "phone" ? <Phone className="h-3.5 w-3.5 text-muted" aria-hidden /> : <Video className="h-3.5 w-3.5 text-muted" aria-hidden />}
                  {shortDate(c.startedAt)} · {c.label ?? "Untitled call"}
                  {c.outcome ? ` · ${c.outcome.replace("_", " ")}` : ""}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      {err && <p className="text-xs text-amber-700 dark:text-amber-300">{err}</p>}
    </div>
  );
}

/**
 * Ask Coach across the pipeline (2026-11-23). One question over every prospect in view — stage, amount, next call,
 * to-dos and the latest call's key points — answered with [P#] references that open the prospect. Keyed by "whose",
 * so switching pipelines clears an answer that was about someone else's.
 */
type PipelineCitation = { ref: number; prospectId: string; name: string };
const PIPELINE_STARTERS = ["Which deals are at risk of slipping?", "Which prospects have no next call booked?", "What should I do first this week?"];

function AskPipeline({ scope, onOpen }: { scope: string; onOpen: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  // The conversation (founder picker 2026-11-23: "Follow-ups, not stored"): kept on this page only; the earlier turns go
  // back with each follow-up so "that deal" means something. Leaving the page, or "New conversation", clears it.
  const [thread, setThread] = useState<Array<{ question: string; answer: string; citations: PipelineCitation[]; prospects: number; capped: boolean }>>([]);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    setThread([]); // another person's pipeline is another conversation
    setNote(null);
  }, [scope]);

  const ask = async (question: string) => {
    const text = question.trim();
    if (text.length < 3 || busy) return;
    setQ(text);
    setBusy(true);
    setNote(null);
    try {
      const r = await fetch("/api/coach/remote/ask-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, scope, today: today(), history: thread.map((t) => ({ question: t.question, answer: t.answer })) }),
      });
      const j = (await r.json().catch(() => ({}))) as { answer?: string | null; suppressed?: boolean; citations?: PipelineCitation[]; prospects?: number; capped?: boolean; error?: string };
      if (!r.ok) setNote(j.error ?? "Couldn't get an answer. Try again.");
      else if (j.suppressed || !j.answer) setNote("Coaching answers are switched off for this account right now.");
      else {
        setThread((t) => [...t, { question: text, answer: j.answer!, citations: j.citations ?? [], prospects: j.prospects ?? 0, capped: !!j.capped }]);
        setQ("");
      }
    } catch {
      setNote("Couldn't reach the coach. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const last = thread[thread.length - 1];
  const answerParts = (t: (typeof thread)[number]) => {
    const byRef = new Map(t.citations.map((c) => [c.ref, c]));
    return t.answer.split(/(\[P\d+\])/g).map((part, i) => {
      const m = /^\[P(\d+)\]$/.exec(part);
      const c = m ? byRef.get(Number(m[1])) : undefined;
      return c ? (
        <button key={i} type="button" onClick={() => onOpen(c.prospectId)} title={c.name} className="mx-0.5 rounded bg-brand/15 px-1 text-[11px] font-semibold text-brand hover:bg-brand/25">
          {c.name}
        </button>
      ) : (
        <span key={i}>{part}</span>
      );
    });
  };

  return (
    <section aria-label="Ask about this pipeline" className="rounded-xl border border-default bg-surface p-3">
      {thread.length > 0 && (
        <ol className="mb-3 space-y-3" aria-label="This conversation">
          {thread.map((t, i) => (
            <li key={i} className="space-y-1">
              <p className="text-xs font-semibold text-primary">{t.question}</p>
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-primary">{answerParts(t)}</p>
            </li>
          ))}
        </ol>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(q);
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <Sparkles className="h-4 w-4 shrink-0 text-brand" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          maxLength={1000}
          placeholder={thread.length ? "Ask a follow-up — e.g. what should I say to them?" : "Ask about this pipeline — e.g. which deals are stalling?"}
          aria-label="Question about this pipeline"
          className="min-w-0 flex-1 rounded-lg border border-default bg-surface px-2 py-1.5 text-xs text-primary"
        />
        <button type="submit" disabled={busy || q.trim().length < 3} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null} Ask
        </button>
        {thread.length > 0 && !busy && (
          <button type="button" onClick={() => { setThread([]); setQ(""); setNote(null); }} className="text-[11px] text-secondary hover:text-primary hover:underline">
            New conversation
          </button>
        )}
      </form>
      {thread.length === 0 && !busy && !note && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PIPELINE_STARTERS.map((s) => (
            <button key={s} type="button" onClick={() => void ask(s)} className="rounded-full border border-default px-2.5 py-1 text-[11px] text-secondary hover:border-brand/60">
              {s}
            </button>
          ))}
        </div>
      )}
      {!busy && <PromptLibrary scope="pipeline" onPick={(t) => { setQ(t); setNote(null); }} />}
      {busy && <p className="mt-2 text-xs text-muted">Reading the pipeline…</p>}
      {note && (
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-xs text-secondary">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden /> {note}
        </p>
      )}
      {last && (
        <p className="mt-2 text-[11px] text-muted">
          Based on {last.capped ? `the ${last.prospects} prospects with the most recent activity` : `${last.prospects} ${last.prospects === 1 ? "prospect" : "prospects"}`} and each one&apos;s latest call summary — not full transcripts. This conversation isn&apos;t saved.
        </p>
      )}
    </section>
  );
}

/**
 * Training by deal stage (2026-11-23; 0310; founder picker "Rep starts it"). The practice scenarios a manager set for
 * this prospect's stage. The prospect's own rep starts one as their own practice, due on the next call, and goes
 * straight into the role-play; a manager viewing a report's prospect sees the list without the button. Keyed by the
 * stage, so renaming the stage re-reads it. Shows nothing when no scenario is set for the stage.
 */
type StageScenario = { id: string; title: string; focus: string; difficulty: string; lengthMin: number; assignmentId: string | null; need?: { item: string; misses: number; graded: number } | null };

function StagePractice({ prospectId }: { prospectId: string }) {
  const router = useRouter();
  const [res, setRes] = useState<{ stage: string | null; canStart: boolean; scenarios: StageScenario[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/coach/remote/stage-practice?prospectId=${encodeURIComponent(prospectId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => live && setRes(j))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [prospectId]);

  if (failed) return <p className="text-xs text-muted">Couldn&apos;t load practice for this stage.</p>;
  if (!res || res.scenarios.length === 0) return null;

  const start = async (s: StageScenario) => {
    if (s.assignmentId) return router.push(`/dashboard/remote-sales/practice?assignment=${s.assignmentId}`);
    setBusy(s.id);
    setErr(null);
    try {
      const r = await fetch("/api/coach/remote/stage-practice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prospectId, scenarioId: s.id }) });
      const j = (await r.json().catch(() => ({}))) as { assignmentId?: string; error?: string };
      if (!r.ok || !j.assignmentId) throw new Error(j.error ?? "Couldn't start the practice.");
      router.push(`/dashboard/remote-sales/practice?assignment=${j.assignmentId}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't start the practice.");
      setBusy(null);
    }
  };

  return (
    <div>
      <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
        <GraduationCap className="h-3.5 w-3.5" aria-hidden /> Practice for “{res.stage}”
      </p>
      <ul className="space-y-1">
        {res.scenarios.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-2 text-xs">
            <span className="min-w-0 flex-1">
              <span className="font-medium text-primary">{s.title}</span>
              <span className="text-muted"> · {s.lengthMin} min · {s.difficulty} · {s.focus}</span>
              {s.need && (
                <span className="block text-[11px] text-amber-700 dark:text-amber-300">
                  Trains {s.need.item} — missed on {s.need.misses} of the last {s.need.graded} scored calls
                </span>
              )}
            </span>
            {res.canStart && (
              <button type="button" disabled={busy !== null} onClick={() => void start(s)} className="rounded-lg border border-brand px-2 py-0.5 text-[11px] font-semibold text-brand hover:bg-brand/10 disabled:opacity-50">
                {busy === s.id ? "Starting…" : s.assignmentId ? "Continue" : "Practice"}
              </button>
            )}
          </li>
        ))}
      </ul>
      {err && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{err}</p>}
    </div>
  );
}

/**
 * Pipeline → Sources (2026-11-23; 0313). Deals by where they came from, for the pipeline in view ("Whose pipeline"):
 * prospects, open value, won and lost, and the win rate on closed deals (none until a source has one).
 */
function SourcesView({ prospects, failed }: { prospects: Prospect[] | null; failed: boolean }) {
  if (failed) return <p className="rounded-xl border border-default bg-surface p-6 text-center text-xs text-muted">Couldn&apos;t load the pipeline. Refresh to try again.</p>;
  if (!prospects)
    return (
      <p className="flex items-center justify-center gap-2 p-6 text-xs text-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading pipeline…
      </p>
    );
  if (prospects.length === 0) return <p className="rounded-xl border border-default bg-surface p-6 text-center text-xs text-secondary">No prospects yet.</p>;
  const rows = sourceBreakdown(prospects);
  const withSource = prospects.filter((p) => p.source && p.source.trim()).length;
  return (
    <section aria-label="Deals by lead source" className="space-y-2">
      <p className="text-xs text-secondary">
        {withSource} of {prospects.length} {prospects.length === 1 ? "prospect has" : "prospects have"} a source. Set one on a prospect, or when you add it.
      </p>
      <div className="overflow-x-auto rounded-xl border border-default bg-surface">
        <table className="w-full text-left text-xs">
          <thead className="text-[10px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Source</th>
              <th className="px-3 py-2 text-right font-medium">Prospects</th>
              <th className="px-3 py-2 text-right font-medium">Open</th>
              <th className="px-3 py-2 text-right font-medium">Won</th>
              <th className="px-3 py-2 text-right font-medium">Lost</th>
              <th className="px-3 py-2 text-right font-medium">Win rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.source} className="border-t border-default">
                <td className={`px-3 py-2 ${r.source === NO_SOURCE ? "italic text-muted" : "font-medium text-primary"}`}>{r.source}</td>
                <td className="px-3 py-2 text-right tabular-nums text-primary">{r.prospects}</td>
                <td className="px-3 py-2 text-right tabular-nums text-secondary">
                  {r.open} · {money(r.openAmount)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-secondary">
                  {r.won} · {money(r.wonAmount)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-secondary">{r.lost}</td>
                <td className="px-3 py-2 text-right tabular-nums text-primary">{r.winRate === null ? "—" : `${Math.round(r.winRate * 100)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted">Win rate counts closed deals only (won ÷ won + lost); “—” means none have closed yet.</p>
    </section>
  );
}

/** Deal risk on a list row (2026-11-23, dealRisk.ts): the reasons, in words, for an open deal that may slip. */
function RiskLine({ p }: { p: Prospect }) {
  const r = dealRisk(p, today());
  if (r.level === "ok" && r.reasons.length === 0) return null;
  const tone = r.level === "at_risk" ? "text-amber-700 dark:text-amber-300" : "text-secondary";
  return (
    <p className={`mt-1.5 flex flex-wrap items-center gap-1 text-[11px] ${tone}`}>
      {r.level !== "ok" && <AlertCircle className="h-3 w-3" aria-hidden />}
      <span className="font-semibold">{r.level === "at_risk" ? "At risk" : r.level === "watch" ? "Watch" : "Missing"}:</span>
      {r.reasons.map((x) => RISK_WORDS[x]).join(" · ")}
    </p>
  );
}

/**
 * Pipeline → Forecast (2026-11-23, dealRisk.ts). For the pipeline in view: open value; the expected value from THIS
 * pipeline's own closed-deal win rate (no number until enough deals have closed); a what-if without the at-risk
 * deals; and the at-risk deals themselves, largest first, each opening its prospect.
 */
/** Open deals by the month the rep expects them to close (0320, dealRisk.forecastByMonth). */
function ByCloseMonth({ prospects: saved, today: t }: { prospects: Prospect[]; today: string }) {
  const [quarters, setQuarters] = useState(false);
  // What-if (2026-11-23): move deals' expected dates here to see the months change. On screen only — never saved.
  const [moved, setMoved] = useState<Record<string, string> | null>(null);
  const prospects = moved ? withMovedDates(saved, moved) : saved;
  const f = forecastByMonth(prospects, t);
  const openDeals = saved.filter((p) => p.status === "open");
  const monthName = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
  const quarterName = (q: string) => `${q.slice(5)} ${q.slice(0, 4)}`;
  const periods = quarters ? byQuarter(f.months).map((m) => ({ ...m, label: quarterName(m.month) })) : f.months.map((m) => ({ ...m, label: monthName(m.month) }));
  const rows = [...(f.pastDue.count ? [{ ...f.pastDue, label: "Past due" }] : []), ...periods];
  return (
    <section aria-label="By expected close month" className="rounded-xl border border-default bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-primary">By expected close {quarters ? "quarter" : "month"}</p>
        <div role="group" aria-label="Group by" className="inline-flex overflow-hidden rounded-lg border border-default text-[11px]">
          {([false, true] as const).map((q) => (
            <button key={String(q)} type="button" aria-pressed={quarters === q} onClick={() => setQuarters(q)} className={`px-2 py-0.5 ${quarters === q ? "bg-brand/15 font-semibold text-primary" : "text-secondary"}`}>
              {q ? "Quarters" : "Months"}
            </button>
          ))}
        </div>
      </div>
      {openDeals.length > 0 && (
        <div className="mt-1">
          {moved === null ? (
            <button type="button" onClick={() => setMoved({})} className="text-[11px] text-secondary underline-offset-2 hover:text-primary hover:underline">
              What if? Move deals&apos; dates to see the totals change
            </button>
          ) : (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">What if — on screen only, nothing is saved</p>
                <button type="button" onClick={() => setMoved(null)} className="text-[11px] text-secondary hover:text-primary hover:underline">
                  Back to the real dates
                </button>
              </div>
              <ul className="mt-1.5 max-h-48 space-y-1 overflow-y-auto" aria-label="What-if dates">
                {openDeals.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span className="min-w-0 truncate text-primary">
                      {p.name ?? "Unnamed prospect"} <span className="text-muted">· {p.amount !== null ? money(p.amount) : "no amount"}</span>
                    </span>
                    <input
                      type="date"
                      value={p.id in moved ? moved[p.id] : (p.closeDate ?? "")}
                      onChange={(e) => setMoved({ ...moved, [p.id]: e.currentTarget.value })}
                      aria-label={`What-if close date for ${p.name ?? "unnamed prospect"}`}
                      className="rounded border border-default bg-surface px-1.5 py-0.5 text-[11px] text-primary"
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {rows.length === 0 ? (
        <p className="mt-1 text-xs text-secondary">No open deal has an expected close date yet — set one on a prospect&apos;s card.</p>
      ) : (
        <table className="mt-2 w-full text-left text-xs">
          <thead className="text-[10px] uppercase tracking-wide text-muted">
            <tr>
              <th className="py-1 pr-2 font-medium">{quarters ? "Quarter" : "Month"}</th>
              <th className="py-1 pr-2 text-right font-medium">Deals</th>
              <th className="py-1 pr-2 text-right font-medium">Value</th>
              <th className="py-1 text-right font-medium">Expected</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month} className="border-t border-default">
                <td className={`py-1.5 pr-2 font-medium ${r.month === "past_due" ? "text-amber-700 dark:text-amber-300" : "text-primary"}`}>{r.label}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-secondary">
                  {r.count}
                  {r.unpriced ? ` (${r.unpriced} no amount)` : ""}
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-primary">{money(r.amount)}</td>
                <td className="py-1.5 text-right tabular-nums text-secondary">{r.expected === null ? "—" : money(r.expected)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {f.undated.count > 0 && (
        <p className="mt-1 text-[11px] text-secondary">
          {f.undated.count} open {f.undated.count === 1 ? "deal has" : "deals have"} no expected close date ({money(f.undated.amount)}).
        </p>
      )}
      <p className="mt-1 text-[10px] text-muted">&ldquo;Expected&rdquo; = value × this pipeline&apos;s win rate, shown once {MIN_CLOSED_FOR_FORECAST} deals have closed; &ldquo;—&rdquo; until then.</p>
    </section>
  );
}

/**
 * What changed in the pipeline (2026-11-23; pipelineChanges.ts; ledger F23.7): this week or last week (Monday first, the
 * viewer's own days), read from the prospects' own event history. Follows "Whose pipeline".
 */
type ChangeRow = { kind: string; prospectId: string; at: string; name: string | null; amount?: number | null; from?: string | number | null; to?: string | number | null };
const CHANGE_WORDS: Record<string, string> = { new: "New deal", won: "Won", lost: "Lost", stage: "Moved", amount: "Amount", close_slipped: "Close date pushed out", close_pulled_in: "Close date pulled in" };
function PipelineChanges({ whose, onOpen }: { whose: string; onOpen: (id: string) => void }) {
  const [week, setWeek] = useState<0 | 1>(0);
  const [res, setRes] = useState<{ summary: { new: number; newValue: number; won: number; wonValue: number; lost: number; lostValue: number; moved: number; slipped: number }; changes: ChangeRow[] } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    const monday = weekStart(today());
    const start = addDays(monday, -7 * week);
    const fromIso = new Date(`${start}T00:00:00`).toISOString();
    const toIso = new Date(`${addDays(start, 7)}T00:00:00`).toISOString();
    setRes(null);
    setFailed(false);
    const q = new URLSearchParams({ from: fromIso, to: toIso, ...(whose === "mine" ? {} : { repId: whose }) });
    fetch(`/api/coach/remote/prospects/changes?${q}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => {
        if (!live) return;
        if (j && Array.isArray(j.changes) && j.summary) setRes(j);
        else setFailed(true); // a reply without the list is not "no changes"
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [whose, week]);
  const detail = (c: ChangeRow) =>
    c.kind === "stage" ? `${c.from ?? "no stage"} → ${c.to ?? "no stage"}`
    : c.kind === "amount" ? `${c.from == null ? "none" : money(Number(c.from))} → ${c.to == null ? "none" : money(Number(c.to))}`
    : c.kind === "close_slipped" || c.kind === "close_pulled_in" ? `${shortDate(String(c.from))} → ${shortDate(String(c.to))}`
    : c.amount != null ? money(c.amount) : "";
  return (
    <section aria-label="Pipeline changes" className="mt-3 rounded-xl border border-default bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-primary">What changed {week === 0 ? "this week" : "last week"}</p>
        <div role="group" aria-label="Week" className="inline-flex overflow-hidden rounded-lg border border-default text-[11px]">
          {([0, 1] as const).map((w) => (
            <button key={w} type="button" aria-pressed={week === w} onClick={() => setWeek(w)} className={`px-2 py-0.5 ${week === w ? "bg-brand/15 font-semibold text-primary" : "text-secondary"}`}>
              {w === 0 ? "This week" : "Last week"}
            </button>
          ))}
        </div>
      </div>
      {failed ? (
        <p className="mt-2 text-xs text-muted">Couldn&apos;t load the changes. Refresh to try again.</p>
      ) : !res ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Reading the pipeline&apos;s history…</p>
      ) : res.changes.length === 0 ? (
        <p className="mt-2 text-xs text-secondary">No changes {week === 0 ? "so far this week" : "last week"}.</p>
      ) : (
        <>
          <p className="mt-1 text-[11px] text-secondary">
            {res.summary.new} new ({money(res.summary.newValue)}) · {res.summary.won} won ({money(res.summary.wonValue)}) · {res.summary.lost} lost ({money(res.summary.lostValue)}) · {res.summary.moved} moved · {res.summary.slipped} close dates pushed out
          </p>
          <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
            {res.changes.map((c, i) => (
              <li key={`${c.prospectId}-${c.kind}-${i}`}>
                <button type="button" onClick={() => onOpen(c.prospectId)} className="flex w-full flex-wrap items-baseline justify-between gap-2 rounded px-1 py-0.5 text-left text-xs hover:bg-base">
                  <span className="min-w-0">
                    <span className={`font-semibold ${c.kind === "won" ? "text-emerald-700 dark:text-emerald-300" : c.kind === "lost" || c.kind === "close_slipped" ? "text-amber-700 dark:text-amber-300" : "text-primary"}`}>{CHANGE_WORDS[c.kind] ?? c.kind}</span>{" "}
                    <span className="text-primary">{c.name ?? "Unnamed prospect"}</span> <span className="text-muted">{detail(c)}</span>
                  </span>
                  <span className="text-[10px] text-muted">{shortDate(c.at)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function ForecastView({ prospects, failed, onOpen }: { prospects: Prospect[] | null; failed: boolean; onOpen: (id: string) => void }) {
  if (failed) return <p className="rounded-xl border border-default bg-surface p-6 text-center text-xs text-muted">Couldn&apos;t load the pipeline. Refresh to try again.</p>;
  if (!prospects)
    return (
      <p className="flex items-center justify-center gap-2 p-6 text-xs text-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading pipeline…
      </p>
    );
  const t = today();
  const f = forecast(prospects, t);
  const risky = prospects
    .filter((p) => p.status === "open")
    .map((p) => ({ p, r: dealRisk(p, t) }))
    .filter((x) => x.r.level === "at_risk")
    .sort((a, b) => (b.p.amount ?? 0) - (a.p.amount ?? 0));
  const card = "rounded-xl border border-default bg-surface p-3";
  return (
    <section aria-label="Forecast" className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className={card}>
          <p className="text-[11px] uppercase tracking-wider text-muted">Open pipeline</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-primary">{money(f.openAmount)}</p>
          <p className="text-[11px] text-secondary">
            {f.openCount} open {f.openCount === 1 ? "deal" : "deals"}
            {f.unpriced ? ` · ${f.unpriced} with no amount (not counted)` : ""}
          </p>
        </div>
        <div className={card}>
          <p className="text-[11px] uppercase tracking-wider text-muted">Expected from open deals</p>
          {f.expected === null ? (
            <>
              <p className="mt-0.5 text-lg font-semibold text-muted">Not yet</p>
              <p className="text-[11px] text-secondary">
                Needs {MIN_CLOSED_FOR_FORECAST} closed deals to use this pipeline&apos;s own win rate — {f.closed} so far.
              </p>
            </>
          ) : (
            <>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-primary">{money(f.expected)}</p>
              <p className="text-[11px] text-secondary">
                Open value × win rate {Math.round((f.winRate ?? 0) * 100)}% ({f.won} won of {f.closed} closed)
              </p>
            </>
          )}
        </div>
        <div className={card}>
          <p className="text-[11px] uppercase tracking-wider text-muted">If the at-risk deals are lost</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-primary">{money(f.openWithoutAtRisk)}</p>
          <p className="text-[11px] text-secondary">
            {f.atRiskCount} at risk · {money(f.atRiskAmount)}
          </p>
        </div>
      </div>

      <ByCloseMonth prospects={prospects} today={t} />

      <div className={card}>
        <p className="text-xs font-semibold text-primary">Deals at risk</p>
        {risky.length === 0 ? (
          <p className="mt-1 text-xs text-secondary">None right now — every open deal has at most one warning.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {risky.map(({ p, r }) => (
              <li key={p.id}>
                <button type="button" onClick={() => onOpen(p.id)} className="flex w-full flex-wrap items-baseline justify-between gap-2 rounded-lg px-1 py-0.5 text-left hover:bg-base">
                  <span className="min-w-0">
                    <span className="text-sm font-medium text-primary">{p.name ?? "Unnamed prospect"}</span>
                    <span className="block text-[11px] text-amber-700 dark:text-amber-300">{r.reasons.map((x) => RISK_WORDS[x]).join(" · ")}</span>
                  </span>
                  <span className="text-sm tabular-nums text-primary">{p.amount !== null ? money(p.amount) : "—"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-[11px] text-muted">
        A deal is at risk when two of these are true: no next call booked, its booked call date passed with no call, no call
        in 21 days (14 for a new prospect), an overdue to-do, the customer cooled on the last call, its expected close date
        passed. These are checks, not predictions.
      </p>
    </section>
  );
}

/**
 * The customer's sentiment across a deal's calls (2026-11-23, dealSentiment.ts): the last call's net reading from its
 * timeline, and whether it rose or fell against the call before. Nothing shows until a linked call has a reading.
 */
function SentimentLine({ s }: { s: { last: "warming" | "cooling" | "flat"; trend: "warming" | "cooling" | "steady" | null; calls: number } | null }) {
  if (!s) return null;
  const word = s.last === "warming" ? "warming" : s.last === "cooling" ? "cooling" : "neutral";
  const tone = s.last === "warming" ? "text-emerald-700 dark:text-emerald-300" : s.last === "cooling" ? "text-amber-700 dark:text-amber-300" : "text-secondary";
  const trend = s.trend === "warming" ? " — better than the call before" : s.trend === "cooling" ? " — worse than the call before" : s.trend === "steady" ? " — same as the call before" : "";
  return (
    <p className={`mt-1 text-[11px] ${tone}`}>
      Customer on the last call: {word}
      {trend}
    </p>
  );
}
