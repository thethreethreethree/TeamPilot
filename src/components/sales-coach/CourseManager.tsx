"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, BookOpen, Trash2 } from "lucide-react";

/**
 * Training courses for managers (2026-11-26, Gong F17.1; migration 0355): write a course as ordered lessons, change it
 * (each save is a new version — reps keep the lessons they've done), assign it with a due date, retire it, and see each
 * rep's progress. Saving a new course opens its Assign step (§1.5.1: the next action is in front of the manager).
 */
type Step = { uid?: string; title: string; body: string; kind: "lesson" | "practice"; scenarioId: string | null; libraryItemId?: string | null; linkUrl?: string | null };
type LibItem = { id: string; label: string };
type Course = { id: string; title: string; summary: string | null; retired: boolean; version: number; steps: Array<{ uid: string; title: string; body: string; kind: "lesson" | "practice"; scenarioId: string | null; libraryItemId?: string | null; linkUrl?: string | null }> };
type Scenario = { id: string; title: string; retired_at: string | null };
type Progress = { id: string; title: string; repName: string | null; dueAt: string; done: number; total: number; state: string };
type Member = { id: string; full_name: string | null };
const STATE: Record<string, string> = { not_started: "Not started", in_progress: "In progress", done: "Done", overdue: "Overdue" };
const input = "w-full rounded-lg border border-default bg-base px-2 py-1.5 text-xs text-primary";
const blank = (): Step => ({ title: "", body: "", kind: "lesson", scenarioId: null });
/** A step is ready to save: a lesson has text; a practice names a scenario (its note is optional). */
const ready = (s: Step) => !!s.title.trim() && (s.kind === "practice" ? !!s.scenarioId : !!s.body.trim());

export function CourseManager() {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [notReady, setNotReady] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [progress, setProgress] = useState<Progress[] | null>(null);
  const [progressFailed, setProgressFailed] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  // Practice steps (0357) pick one of the company's live scenarios.
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  // A failed scenarios read is said — never "write a scenario first" when there are scenarios we couldn't load.
  const [scenariosFailed, setScenariosFailed] = useState(false);
  // A lesson can point at a call or clip in the COMPANY library (0359) — the only place every rep can reach it.
  const [libItems, setLibItems] = useState<LibItem[]>([]);
  const [libFailed, setLibFailed] = useState(false);
  const [membersFailed, setMembersFailed] = useState(false);
  // The editor: null = closed; id null = a new course.
  const [editing, setEditing] = useState<{ id: string | null; title: string; summary: string; steps: Step[] } | null>(null);
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/coach/remote/courses");
      if (r.status === 403) return setCourses([]);
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as { available?: boolean; reason?: string; courses?: Course[] };
      if (!j.available) return setNotReady(j.reason ?? "Courses aren't available yet.");
      setCourses(j.courses ?? []);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
    try {
      const r = await fetch("/api/coach/remote/course-assignments?team=1");
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as { assignments?: Progress[] };
      setProgress(j.assignments ?? []);
      setProgressFailed(false);
    } catch {
      setProgressFailed(true);
    }
  }, []);
  useEffect(() => {
    void load();
    fetch("/api/team")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { members?: Member[] } | null) => setMembers(j?.members ?? []))
      .catch(() => setMembersFailed(true));
  }, [load]);
  // Each time the editor opens: a scenario written in Scenarios below since the page loaded is offered too.
  const editorOpen = editing !== null;
  useEffect(() => {
    if (!editorOpen) return;
    fetch("/api/coach/remote/scenarios")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { scenarios?: Scenario[] }) => {
        setScenarios((j.scenarios ?? []).filter((x) => !x.retired_at));
        setScenariosFailed(false);
      })
      .catch(() => setScenariosFailed(true));
    fetch("/api/coach/remote/library?scope=company")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { available?: boolean; items?: Array<{ id: string; folderName: string; callLabel: string | null; clip: { title: string } | null }> }) => {
        setLibItems((j.items ?? []).map((i) => ({ id: i.id, label: `${i.folderName} — ${i.clip?.title ?? i.callLabel ?? "Untitled call"}` })));
        setLibFailed(false);
      })
      .catch(() => setLibFailed(true));
  }, [editorOpen]);

  const send = async (method: string, url: string, body: unknown, ok: string): Promise<Record<string, unknown> | null> => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) {
        setMsg(typeof j.error === "string" ? j.error : "That didn't save.");
        return null;
      }
      setMsg(ok);
      await load();
      return j;
    } catch {
      setMsg("Couldn't reach the server.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  if (notReady) return <p className="rounded-2xl border border-default bg-surface p-4 text-xs text-muted">{notReady}</p>;
  if (loadFailed && !courses) return <p className="rounded-2xl border border-default bg-surface p-4 text-xs text-muted">Couldn&apos;t load courses. Refresh to try again.</p>;
  if (!courses) return null;
  const live = courses.filter((c) => !c.retired);
  const move = (i: number, d: -1 | 1) => {
    if (!editing) return;
    const s = [...editing.steps];
    const j = i + d;
    if (j < 0 || j >= s.length) return;
    [s[i], s[j]] = [s[j]!, s[i]!];
    setEditing({ ...editing, steps: s });
  };
  const setStep = (i: number, patch: Partial<Step>) => editing && setEditing({ ...editing, steps: editing.steps.map((s, k) => (k === i ? { ...s, ...patch } : s)) });

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-default bg-surface p-4 space-y-2" aria-label="Courses">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-primary"><BookOpen className="h-4 w-4 text-brand" aria-hidden /> Courses</h2>
          {!editing && (
            <button type="button" onClick={() => setEditing({ id: null, title: "", summary: "", steps: [blank()] })} className="rounded-lg border border-default px-2 py-1 text-xs text-secondary hover:text-primary">
              New course
            </button>
          )}
        </div>
        {msg && <p role="status" className="text-xs text-secondary">{msg}</p>}
        {editing && (
          <div className="space-y-2 rounded-xl border border-default p-3" aria-label={editing.id ? "Edit course" : "New course"}>
            {editing.id === null ? (
              <>
                <label className="block text-[11px] text-muted">Title<input value={editing.title} maxLength={120} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className={input} /></label>
                <label className="block text-[11px] text-muted">What reps will learn (optional)<textarea value={editing.summary} maxLength={600} rows={2} onChange={(e) => setEditing({ ...editing, summary: e.target.value })} className={input} /></label>
              </>
            ) : (
              <p className="text-xs font-semibold text-primary">{editing.title}</p>
            )}
            <ol className="space-y-2">
              {editing.steps.map((s, i) => (
                <li key={i} className="space-y-1 rounded-lg border border-default p-2">
                  <div className="flex items-center gap-1">
                    <span className="w-5 text-[11px] text-muted">{i + 1}</span>
                    <input aria-label={`Lesson ${i + 1} title`} placeholder="Lesson title" value={s.title} maxLength={120} onChange={(e) => setStep(i, { title: e.target.value })} className={input} />
                    <button type="button" aria-label={`Move lesson ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)} className="p-1 text-muted disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label={`Move lesson ${i + 1} down`} disabled={i === editing.steps.length - 1} onClick={() => move(i, 1)} className="p-1 text-muted disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label={`Remove lesson ${i + 1}`} disabled={editing.steps.length === 1} onClick={() => setEditing({ ...editing, steps: editing.steps.filter((_, k) => k !== i) })} className="p-1 text-muted disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="flex gap-1 text-[11px]" role="group" aria-label={`Step ${i + 1} kind`}>
                    {(["lesson", "practice"] as const).map((k) => (
                      <button key={k} type="button" aria-pressed={s.kind === k} disabled={k === "practice" && scenarios.length === 0}
                        onClick={() => setStep(i, { kind: k, scenarioId: k === "practice" ? s.scenarioId : null })}
                        className={`rounded-full border px-2 py-0.5 disabled:opacity-40 ${s.kind === k ? "border-strong font-semibold text-primary" : "border-default text-muted"}`}>
                        {k === "lesson" ? "Lesson" : "Practice"}
                      </button>
                    ))}
                    {scenariosFailed && <span className="text-muted">Couldn&apos;t load your practice scenarios. Reopen the editor to try again.</span>}
                    {!scenariosFailed && scenarios.length === 0 && <span className="text-muted">Write a practice scenario below to add practice steps.</span>}
                  </div>
                  {s.kind === "practice" && (
                    <select aria-label={`Step ${i + 1} scenario`} value={s.scenarioId ?? ""} onChange={(e) => setStep(i, { scenarioId: e.target.value || null, title: s.title || (scenarios.find((x) => x.id === e.target.value)?.title ?? "") })} className={input}>
                      <option value="">Pick a scenario…</option>
                      {scenarios.map((x) => (
                        <option key={x.id} value={x.id}>{x.title}</option>
                      ))}
                    </select>
                  )}
                  {s.kind === "lesson" && (
                    <div className="grid gap-1 sm:grid-cols-2">
                      <input aria-label={`Lesson ${i + 1} link`} placeholder="Link to a video or page (optional, https://)" value={s.linkUrl ?? ""} maxLength={500} onChange={(e) => setStep(i, { linkUrl: e.target.value })} className={input} />
                      <select aria-label={`Lesson ${i + 1} library call`} value={s.libraryItemId ?? ""} onChange={(e) => setStep(i, { libraryItemId: e.target.value || null })} className={input}>
                        <option value="">{libFailed ? "Couldn't load the company library" : libItems.length ? "A call from the company library (optional)" : "No calls in the company library yet"}</option>
                        {libItems.map((x) => (
                          <option key={x.id} value={x.id}>{x.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <textarea aria-label={`Lesson ${i + 1} text`} placeholder={s.kind === "practice" ? "A note before they practice (optional)" : "What the rep reads"} value={s.body} maxLength={4000} rows={s.kind === "practice" ? 2 : 4} onChange={(e) => setStep(i, { body: e.target.value })} className={input} />
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={editing.steps.length >= 50} onClick={() => setEditing({ ...editing, steps: [...editing.steps, blank()] })} className="rounded-lg border border-default px-2 py-1 text-xs text-secondary">
                Add lesson
              </button>
              <button
                type="button"
                disabled={busy || !editing.title.trim() || !editing.steps.every(ready)}
                onClick={async () => {
                  const steps = editing.steps.map((s) => ({ uid: s.uid, title: s.title, body: s.body, kind: s.kind, scenarioId: s.scenarioId, libraryItemId: s.kind === "lesson" ? s.libraryItemId ?? null : null, linkUrl: s.kind === "lesson" ? s.linkUrl ?? null : null }));
                  const j = editing.id
                    ? await send("PUT", "/api/coach/remote/courses", { courseId: editing.id, steps }, "Saved. Reps keep the steps they've already done.")
                    : await send("POST", "/api/coach/remote/courses", { title: editing.title, summary: editing.summary, steps }, "Course saved — now pick who takes it.");
                  if (!j) return;
                  if (j.practiceAssigned === false) setMsg("Saved, but a new practice step didn't reach everyone taking the course. Assign that scenario from Scenarios below.");
                  // A new course goes straight to Assign; an edited one closes back to the list.
                  if (!editing.id && typeof j.id === "string") {
                    setAssignFor(j.id);
                    setPicked([]);
                  }
                  setEditing(null);
                }}
                className="rounded-lg bg-ember-400 px-3 py-1 text-xs font-semibold text-ink-950 disabled:opacity-60"
              >
                {busy ? "Saving…" : "Save course"}
              </button>
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg px-2 py-1 text-xs text-muted">Cancel</button>
            </div>
          </div>
        )}
        {live.length === 0 && !editing && <p className="text-xs text-muted">No courses yet. A course is a set of lessons and practice reps work through in order, with a due date.</p>}
        <ul className="space-y-1.5">
          {live.map((c) => (
            <li key={c.id} className="rounded-lg border border-default p-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-primary">{c.title}</span>
                <span className="text-muted">
                  {c.steps.filter((x) => x.kind !== "practice").length} lesson{c.steps.filter((x) => x.kind !== "practice").length === 1 ? "" : "s"}
                  {c.steps.some((x) => x.kind === "practice") ? ` · ${c.steps.filter((x) => x.kind === "practice").length} practice` : ""}
                </span>
                <span className="ml-auto flex gap-2">
                  <button type="button" onClick={() => { setAssignFor(assignFor === c.id ? null : c.id); setPicked([]); }} className="text-brand hover:underline">Assign</button>
                  <button type="button" onClick={() => setEditing({ id: c.id, title: c.title, summary: c.summary ?? "", steps: c.steps.map((s) => ({ ...s })) })} className="text-secondary hover:text-primary">Edit lessons</button>
                  <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Retire “${c.title}”? Reps who have it keep it; it can't be assigned again.`)) void send("PATCH", "/api/coach/remote/courses", { courseId: c.id, retire: true }, "Retired."); }} className="text-muted hover:text-primary">Retire</button>
                </span>
              </div>
              {assignFor === c.id && (
                <div className="mt-2 space-y-2 rounded-lg border border-default p-2" aria-label={`Assign ${c.title}`}>
                  {membersFailed && <p className="text-[11px] text-muted">Couldn&apos;t load your team. Refresh to assign.</p>}
                  <div className="flex flex-wrap gap-1">
                    {members.map((m) => (
                      <button key={m.id} type="button" aria-pressed={picked.includes(m.id)} onClick={() => setPicked(picked.includes(m.id) ? picked.filter((x) => x !== m.id) : [...picked, m.id])}
                        className={`rounded-full border px-2 py-0.5 ${picked.includes(m.id) ? "border-strong font-semibold text-primary" : "border-default text-muted"}`}>
                        {m.full_name ?? "Unnamed"}
                      </button>
                    ))}
                  </div>
                  <label className="block text-[11px] text-muted">Due<input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={input} /></label>
                  <button type="button" disabled={busy || picked.length === 0 || !due}
                    onClick={async () => { if (await send("POST", "/api/coach/remote/course-assignments", { courseId: c.id, repIds: picked, dueAt: `${due}T23:59:00` }, "Assigned.")) setAssignFor(null); }}
                    className="rounded-lg bg-ember-400 px-3 py-1 text-xs font-semibold text-ink-950 disabled:opacity-60">
                    Assign to {picked.length} {picked.length === 1 ? "rep" : "reps"}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-2xl border border-default bg-surface p-4 space-y-2" aria-label="Course progress">
        <h2 className="text-sm font-semibold text-primary">Course progress</h2>
        {progressFailed && <p className="text-xs text-muted">Couldn&apos;t load your team&apos;s progress. Refresh to try again.</p>}
        {progress && progress.length === 0 && <p className="text-xs text-muted">No courses assigned yet.</p>}
        {progress && progress.length > 0 && (
          <table className="w-full text-xs">
            <thead><tr className="text-left text-muted"><th className="py-1">Rep</th><th>Course</th><th>Steps</th><th>Due</th><th>Status</th></tr></thead>
            <tbody>
              {progress.map((p) => (
                <tr key={p.id} className="border-t border-default">
                  <td className="py-1 text-primary">{p.repName ?? "Unnamed"}</td>
                  <td className="text-secondary">{p.title}</td>
                  <td className="text-secondary">{p.done} of {p.total}</td>
                  <td>
                    {/* Moving a due date is a new row (0358); the rep sees it at once. */}
                    <input type="date" key={p.dueAt} defaultValue={p.dueAt.slice(0, 10)} aria-label={`Due date for ${p.repName ?? "rep"}, ${p.title}`}
                      onBlur={(e) => { if (e.target.value && e.target.value !== p.dueAt.slice(0, 10)) void send("PATCH", "/api/coach/remote/course-assignments", { assignmentId: p.id, dueAt: `${e.target.value}T23:59:00` }, "Due date changed."); }}
                      className="rounded border border-default bg-base px-1 text-xs text-primary" />
                  </td>
                  <td className={p.state === "overdue" ? "font-semibold text-primary" : "text-secondary"}>{STATE[p.state] ?? p.state}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
