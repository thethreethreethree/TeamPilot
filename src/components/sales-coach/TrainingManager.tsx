"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Loader2 } from "lucide-react";

/**
 * The manager's training screen (RSS Phase 7; docs/rss/docs/06-UI-SPEC.md "Training"; Gong F17.3, F17.10, F17.11).
 *
 *   · Scenario builder — title, who the prospect is, the situation, the ONE skill being practised, channel,
 *     difficulty, length, optional pass mark, optional "from this call" (?fromSession=<id> on the page URL).
 *   · Assign — pick reps (only those on your team are accepted server-side) and a due date.
 *   · Status — every assignment for your team: rep, scenario, due, status in words, best score; change a due date
 *     (recorded as a change, never an overwrite). A rep's attempt also rings your bell.
 * Retiring a scenario keeps every attempt's meaning; a scenario is never edited.
 */
type Scenario = {
  id: string; title: string; persona: string; situation: string; focus: string; channel: string;
  difficulty: string; length_min: number; pass_score: number | null; source_session_id: string | null; retired_at: string | null;
};
type Assignment = {
  id: string; repName: string | null; dueAt: string; state: string; best: number | null; selfStarted?: boolean;
  scenario: { title: string; pass_score: number | null } | null;
};
type Member = { id: string; full_name: string | null };

const STATE: Record<string, string> = { due: "Due", overdue: "Overdue", attempted: "Done", passed: "Passed", not_passed_yet: "Not passed yet" };
const CHANNEL: Record<string, string> = { in_person: "In person", video: "Video", phone: "Phone" };
const input = "w-full rounded-lg border border-default bg-base px-2 py-1.5 text-xs text-primary";
const day = (iso: string) => iso.slice(0, 10);

export function TrainingManager() {
  const [scenarios, setScenarios] = useState<Scenario[] | null>(null);
  const [notReady, setNotReady] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersFailed, setMembersFailed] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: "", persona: "", situation: "", focus: "", channel: "phone", difficulty: "intermediate", lengthMin: "5", passScore: "", sourceSessionId: "" });
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [due, setDue] = useState("");

  // A failed read is said, not shown as "No scenarios yet" / "Nothing assigned yet" (2026-11-23).
  const [loadFailed, setLoadFailed] = useState(false);
  const [stageTags, setStageTags] = useState<Array<{ scenarioId: string; label: string }>>([]);
  const [stageNames, setStageNames] = useState<string[]>([]);
  const [stagesReady, setStagesReady] = useState(true);
  const [tagFor, setTagFor] = useState<string | null>(null);
  const [tagText, setTagText] = useState("");

  const load = useCallback(async () => {
    const ok = (r: Response) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))));
    try {
      const [s, a, st] = await Promise.all([
        fetch("/api/coach/remote/scenarios").then(ok),
        fetch("/api/coach/remote/assignments?team=1").then(ok),
        fetch("/api/coach/remote/scenarios/stages").then(ok),
      ]);
      setLoadFailed(false);
      if (s && s.available === false) setNotReady(s.reason);
      setScenarios(s?.scenarios ?? []);
      setAssignments(a?.assignments ?? []);
      setStagesReady(st?.available !== false);
      setStageTags(st?.tags ?? []);
      setStageNames(st?.stages ?? []);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
    fetch("/api/team")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { members?: Member[] } | null) => setMembers(j?.members ?? []))
      // The Assign picker is empty without the team; say why (2026-11-23).
      .catch(() => setMembersFailed(true));
    const from = new URLSearchParams(window.location.search).get("fromSession");
    if (from) setForm((f) => ({ ...f, sourceSessionId: from }));
  }, [load]);

  const send = async (url: string, method: string, body: unknown, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setMsg(j.error ?? "That didn't work.");
        return false;
      }
      setMsg(ok);
      await load();
      return true;
    } finally {
      setBusy(false);
    }
  };

  if (notReady) return <p className="text-xs text-muted">{notReady}</p>;
  if (loadFailed)
    return (
      <p className="rounded-2xl border border-default bg-surface p-4 text-xs text-muted">
        Couldn&apos;t load training.{" "}
        <button type="button" onClick={() => void load()} className="underline">Try again</button>
      </p>
    );
  if (!scenarios) return <Loader2 className="h-4 w-4 animate-spin text-muted" aria-hidden />;
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  const active = scenarios.filter((s) => !s.retired_at);

  return (
    <div className="space-y-4">
      {msg && <p className="text-xs text-secondary" role="status">{msg}</p>}

      <section className="rounded-2xl border border-default bg-surface p-4 space-y-2" aria-label="New scenario">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-primary"><ClipboardList className="h-4 w-4 text-brand" aria-hidden /> New practice scenario</h2>
        {form.sourceSessionId && <p className="text-[11px] text-muted">Built from a real call — it stays linked to that call.</p>}
        <div className="grid gap-2 md:grid-cols-2">
          <label className="text-[11px] text-muted">Title<input value={form.title} onChange={set("title")} maxLength={120} className={input} placeholder="The price-shopper on the phone" /></label>
          <label className="text-[11px] text-muted">Who the prospect is<input value={form.persona} onChange={set("persona")} maxLength={200} className={input} placeholder="Owner of a 5-person shop, already has two quotes" /></label>
          <label className="text-[11px] text-muted md:col-span-2">The situation<textarea value={form.situation} onChange={set("situation")} maxLength={600} rows={2} className={input} placeholder="Called back after a voicemail; opens with 'just give me your best price'." /></label>
          <label className="text-[11px] text-muted md:col-span-2">The skill being practiced (what the attempt is scored on)<input value={form.focus} onChange={set("focus")} maxLength={600} className={input} placeholder="Move a price question to value before quoting" /></label>
          <label className="text-[11px] text-muted">Channel
            <select value={form.channel} onChange={set("channel")} className={input}>{Object.entries(CHANNEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </label>
          <label className="text-[11px] text-muted">Difficulty
            <select value={form.difficulty} onChange={set("difficulty")} className={input}>{["easy", "intermediate", "advanced"].map((d) => <option key={d} value={d}>{d}</option>)}</select>
          </label>
          <label className="text-[11px] text-muted">Length (minutes)<input inputMode="numeric" value={form.lengthMin} onChange={set("lengthMin")} className={input} /></label>
          <label className="text-[11px] text-muted">Pass mark (optional, 0-100)<input inputMode="numeric" value={form.passScore} onChange={set("passScore")} className={input} /></label>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            const ok = await send("/api/coach/remote/scenarios", "POST", {
              ...form,
              lengthMin: Number(form.lengthMin),
              passScore: form.passScore === "" ? null : Number(form.passScore),
              sourceSessionId: form.sourceSessionId || undefined,
            }, "Scenario saved. Assign it below.");
            if (ok) setForm({ ...form, title: "", persona: "", situation: "", focus: "", passScore: "", sourceSessionId: "" });
          }}
          className="rounded-lg bg-ember-400 px-3 py-1.5 text-xs font-semibold text-ink-950 disabled:opacity-60"
        >
          Save scenario
        </button>
      </section>

      <section className="rounded-2xl border border-default bg-surface p-4 space-y-2" aria-label="Scenarios">
        <h2 className="text-sm font-semibold text-primary">Scenarios</h2>
        <datalist id="stage-names">{stageNames.map((n) => <option key={n} value={n} />)}</datalist>
        {active.length === 0 && <p className="text-xs text-muted">No scenarios yet.</p>}
        <ul className="space-y-2">
          {active.map((s) => (
            <li key={s.id} className="text-xs">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-semibold text-primary">{s.title}</span>
                <span className="text-muted">{CHANNEL[s.channel]} · {s.difficulty} · {s.length_min} min{s.pass_score !== null ? ` · pass ${s.pass_score}` : ""}</span>
                {/* F17.4: try it as a rep will, before assigning — a test run records nothing. */}
                <a href={`/dashboard/remote-sales/practice?scenario=${s.id}`} className="ml-auto text-secondary hover:text-primary hover:underline">Try it</a>
                <button type="button" onClick={() => { setAssignFor(assignFor === s.id ? null : s.id); setPicked([]); }} className="text-brand hover:underline">Assign</button>
                <button type="button" disabled={busy} onClick={() => send("/api/coach/remote/scenarios", "PATCH", { id: s.id }, "Scenario retired.")} className="text-muted hover:text-primary">Retire</button>
              </div>
              <p className="text-secondary">Skill: {s.focus}</p>
              {/* Training by deal stage (0310): reps whose open prospect is at one of these stages can start this. */}
              {stagesReady && (
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <span className="text-[11px] text-muted">For stages:</span>
                  {stageTags.filter((t) => t.scenarioId === s.id).map((t) => (
                    <span key={t.label} className="inline-flex items-center gap-1 rounded-full border border-default px-2 py-0.5 text-[11px] text-primary">
                      {t.label}
                      <button type="button" disabled={busy} aria-label={`Remove stage ${t.label}`} onClick={() => send("/api/coach/remote/scenarios/stages", "PUT", { scenarioId: s.id, stage: t.label, on: false }, `Removed “${t.label}”.`)} className="text-muted hover:text-primary">×</button>
                    </span>
                  ))}
                  {tagFor === s.id ? (
                    <form
                      className="inline-flex items-center gap-1"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const v = tagText.trim();
                        if (!v) return;
                        if (await send("/api/coach/remote/scenarios/stages", "PUT", { scenarioId: s.id, stage: v, on: true }, `Reps at “${v}” can now start this.`)) { setTagFor(null); setTagText(""); }
                      }}
                    >
                      <input autoFocus list="stage-names" value={tagText} onChange={(e) => setTagText(e.target.value)} maxLength={60} placeholder="Stage name" aria-label="Stage name" className="w-32 rounded border border-default bg-base px-1.5 py-0.5 text-[11px] text-primary" />
                      <button type="submit" disabled={busy || !tagText.trim()} className="text-[11px] text-brand hover:underline disabled:opacity-50">Add</button>
                      <button type="button" onClick={() => setTagFor(null)} className="text-[11px] text-muted hover:text-primary">Cancel</button>
                    </form>
                  ) : (
                    <button type="button" onClick={() => { setTagFor(s.id); setTagText(""); }} className="text-[11px] text-brand hover:underline">+ Stage</button>
                  )}
                </div>
              )}
              {assignFor === s.id && (
                <div className="mt-2 space-y-2 rounded-lg border border-default p-2">
                  {membersFailed && <p className="text-[11px] text-muted">Couldn&apos;t load your team. Refresh to assign.</p>}
                  <div className="flex flex-wrap gap-1">
                    {members.map((m) => (
                      <button key={m.id} type="button" aria-pressed={picked.includes(m.id)}
                        onClick={() => setPicked(picked.includes(m.id) ? picked.filter((x) => x !== m.id) : [...picked, m.id])}
                        className={`rounded-full border px-2 py-0.5 ${picked.includes(m.id) ? "border-strong font-semibold text-primary" : "border-default text-muted"}`}>
                        {m.full_name ?? "Unnamed"}
                      </button>
                    ))}
                  </div>
                  <label className="block text-[11px] text-muted">Due<input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={input} /></label>
                  <button type="button" disabled={busy || picked.length === 0 || !due}
                    onClick={async () => {
                      if (await send("/api/coach/remote/assignments", "POST", { scenarioId: s.id, repIds: picked, dueAt: `${due}T23:59:00` }, "Assigned.")) setAssignFor(null);
                    }}
                    className="rounded-lg bg-ember-400 px-3 py-1 text-xs font-semibold text-ink-950 disabled:opacity-60">
                    Assign to {picked.length} {picked.length === 1 ? "rep" : "reps"}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-default bg-surface p-4 space-y-2" aria-label="Assignments">
        <h2 className="text-sm font-semibold text-primary">Assigned practice</h2>
        {assignments.length === 0 ? (
          <p className="text-xs text-muted">Nothing assigned yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wide text-muted">
                <tr><th className="py-1 pr-3 font-medium">Rep</th><th className="py-1 pr-3 font-medium">Scenario</th><th className="py-1 pr-3 font-medium">Due</th><th className="py-1 pr-3 font-medium">Status</th><th className="py-1 font-medium">Best</th></tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id} className="border-t border-default">
                    <td className="py-1.5 pr-3 text-primary">{a.repName ?? "A rep"}</td>
                    <td className="py-1.5 pr-3 text-secondary">{a.scenario?.title ?? "—"}{a.selfStarted ? <span className="ml-1 text-[10px] text-muted">(self-started)</span> : null}</td>
                    <td className="py-1.5 pr-3">
                      <input type="date" defaultValue={day(a.dueAt)} aria-label={`Due date for ${a.repName ?? "rep"}`}
                        onBlur={(e) => { if (e.target.value && e.target.value !== day(a.dueAt)) void send("/api/coach/remote/assignments", "PATCH", { assignmentId: a.id, dueAt: `${e.target.value}T23:59:00` }, "Due date changed."); }}
                        className="rounded border border-default bg-base px-1 text-xs text-primary" />
                    </td>
                    <td className={`py-1.5 pr-3 ${a.state === "overdue" ? "font-semibold text-primary" : "text-secondary"}`}>{STATE[a.state] ?? a.state}</td>
                    <td className="py-1.5 tabular-nums text-muted">{a.best !== null ? `${a.best}/100` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
