"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Check, Loader2, Phone, Plus, Video, X } from "lucide-react";
import { useIsSalesCoachManager, useCurrentUserRole, isCompanyAdminRole } from "@/lib/hooks/useCurrentUserRole";
import { TASK_STATUS_TRANSITIONS } from "@/lib/tasks/statusLabels";
import { stepsToCompleted } from "@/lib/coach/remote/macroMode";
import { downloadIcs } from "@/lib/coach/remote/ics";

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
  amount: number | null;
  nextCallDate: string | null;
  lastCallAt: string | null;
  callCount: number;
  openTodos: number;
  nextTodo: { id: string; title: string; due: string | null } | null;
};
type Totals = Record<"open" | "won" | "lost", { count: number; amount: number }>;

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
  const [whose, setWhose] = useState<string>("mine");
  const [people, setPeople] = useState<Array<{ id: string; name: string }>>([]);
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
      setFailed(true);
    }
  }, [whose]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!isManager) return;
    fetch("/api/team")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { members?: Array<{ id: string; full_name?: string | null }> } | null) =>
        setPeople((d?.members ?? []).map((m) => ({ id: m.id, name: m.full_name ?? "Unnamed teammate" }))),
      )
      .catch(() => {});
  }, [isManager]);

  const rows = useMemo(() => (data?.prospects ?? []).filter((p) => p.status === tab), [data, tab]);
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? null;
  const open = (id: string | null) => router.replace(id ? `/dashboard/remote-sales/pipeline?p=${id}` : "/dashboard/remote-sales/pipeline", { scroll: false });

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
              {people
                .filter((p) => p.id !== data?.viewerId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          )}
          <button type="button" onClick={() => setAdding((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-black">
            <Plus className="h-3.5 w-3.5" aria-hidden /> New prospect
          </button>
        </div>
      </div>

      {adding && <NewProspect onDone={(id) => { setAdding(false); void load(); if (id) open(id); }} />}

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
                    <span className="text-secondary">Next call: {shortDate(p.nextCallDate)}</span>
                    <span className="text-secondary">Last call: {shortDate(p.lastCallAt)}</span>
                  </div>
                </button>
                {selected === p.id && <ProspectDetail id={p.id} onChanged={() => void load()} onClose={() => open(null)} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function NewProspect({ onDone }: { onDone: (id: string | null) => void }) {
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [amount, setAmount] = useState("");
  const [next, setNext] = useState("");
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
  prospect: { id: string; name: string | null; organization: string | null; status: string; stage_label: string | null; amount: number | string | null; next_call_date: string | null };
  calls: Array<{ id: string; label: string | null; context: string; startedAt: string; outcome: string | null }>;
  todos: Array<{ id: string; title: string; due: string | null; status: string; done: boolean }>;
};

function ProspectDetail({ id, onChanged, onClose }: { id: string; onChanged: () => void; onClose: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [todo, setTodo] = useState("");
  const [due, setDue] = useState("");

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
          <input type="date" defaultValue={p.next_call_date ?? ""} disabled={busy} onChange={(e) => void post({ action: "set", kind: "next_call", value: e.currentTarget.value || null })} className={field} />
        </label>
      </div>

      {(p.next_call_date || d.todos.some((t) => !t.done && t.due)) && (
        <button
          type="button"
          onClick={() =>
            downloadIcs(`${p.name ?? "prospect"}-reminders`, [
              ...(p.next_call_date ? [{ uid: `${p.id}-next-call-${p.next_call_date}`, date: p.next_call_date, title: `Call ${p.name ?? "prospect"}` }] : []),
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
