"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Check } from "lucide-react";

/**
 * "Your courses" — the training courses a manager gave this rep (2026-11-26, Gong F17.1; migrations 0355, 0357). Each
 * course shows "n of m steps" and its due date; a practice step opens the role-play and is done when it's practiced; opening it lists the lessons in order. Marking a lesson done opens the next
 * one not done (§1.5.1: the rep is never left on a finished lesson with no next step). Renders nothing when nothing is
 * assigned; a failed read is said.
 */
type Step = {
  uid: string; title: string; body: string; done: boolean; kind?: "lesson" | "practice";
  /** Practice steps (0357): the practice to open, and its state in words. */
  practiceAssignmentId?: string | null; practiceState?: string | null;
  /** 0359: a call in the company library, and/or an outside page. */
  libraryItemId?: string | null; linkUrl?: string | null;
  /** A practice retired before it reached this rep: shown, not counted (review 2026-11-26). */
  retired?: boolean;
};
const PRACTICE: Record<string, string> = { due: "Not practiced yet", overdue: "Not practiced yet — overdue", attempted: "Practiced", passed: "Passed", not_passed_yet: "Not passed yet — try again" };
type Course = { id: string; title: string; summary: string | null; assignedByName: string | null; dueAt: string; done: number; total: number; state: "not_started" | "in_progress" | "done" | "overdue"; steps?: Step[] };
const STATE: Record<Course["state"], string> = { not_started: "Not started", in_progress: "In progress", done: "Done", overdue: "Overdue" };
const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function AssignedCourses() {
  const [items, setItems] = useState<Course[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [openCourse, setOpenCourse] = useState<string | null>(null);
  const [openStep, setOpenStep] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/coach/remote/course-assignments");
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as { available?: boolean; assignments?: Course[] };
      const list = j.available ? (j.assignments ?? []) : [];
      setItems(list);
      setFailed(false);
      return list;
    } catch {
      setFailed(true);
      return null;
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (failed && !items) {
    return (
      <p className="rounded-2xl border border-default bg-surface p-4 text-xs text-muted" aria-label="Your courses">
        Couldn&apos;t load your courses. Refresh to try again.
      </p>
    );
  }
  if (!items || items.length === 0) return null;
  const order = [...items.filter((c) => c.state !== "done"), ...items.filter((c) => c.state === "done")];

  const markDone = async (c: Course, s: Step) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/coach/remote/course-assignments", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assignmentId: c.id, stepUid: s.uid }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setMsg(j.error ?? "Couldn't save that.");
        if (r.status === 409) await load(); // the course changed: show its current lessons
        return;
      }
      const list = await load();
      // The save worked but the refresh didn't (review 2026-11-26): say that, never "You finished".
      if (!list) {
        setMsg("Saved. Couldn't refresh your course — reload the page to see your next step.");
        return;
      }
      const fresh = list.find((x) => x.id === c.id);
      const next = fresh?.steps?.find((x) => !x.done && !x.retired);
      setOpenStep(next?.uid ?? null);
      if (!next && fresh?.state === "done") setMsg(`You finished “${c.title}”.`);
    } catch {
      setMsg("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-default bg-surface p-4 space-y-2" aria-label="Your courses">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
        <BookOpen className="h-4 w-4 text-brand" aria-hidden /> Your courses
      </p>
      {msg && <p role="status" className="text-xs text-secondary">{msg}</p>}
      {failed && <p className="text-xs text-muted">Couldn&apos;t refresh your courses — what you see may be out of date. Reload the page.</p>}
      <ul className="space-y-2">
        {order.map((c) => (
          <li key={c.id} className="rounded-xl border border-default p-2">
            <button
              type="button"
              aria-expanded={openCourse === c.id}
              onClick={() => {
                const opening = openCourse !== c.id;
                setOpenCourse(opening ? c.id : null);
                setOpenStep(opening ? (c.steps?.find((s) => !s.done && !s.retired)?.uid ?? null) : null);
              }}
              className="flex w-full flex-wrap items-center gap-2 text-left text-xs"
            >
              <span className="font-semibold text-brand">{c.title}</span>
              <span className="text-muted">{c.assignedByName ? `from ${c.assignedByName}` : ""}</span>
              <span className={`ml-auto ${c.state === "overdue" ? "font-semibold text-primary" : "text-secondary"}`}>
                {c.done} of {c.total} step{c.total === 1 ? "" : "s"} · {STATE[c.state]}
                {c.state !== "done" ? ` · due ${when(c.dueAt)}` : ""}
              </span>
            </button>
            <div className="mt-1 h-1 rounded-full bg-base" aria-hidden>
              <div className="h-1 rounded-full bg-ember-400" style={{ width: `${c.total ? Math.round((c.done / c.total) * 100) : 0}%` }} />
            </div>
            {openCourse === c.id && (
              <div className="mt-2 space-y-1">
                {c.summary && <p className="text-xs text-secondary">{c.summary}</p>}
                <ol className="space-y-1">
                  {(c.steps ?? []).map((s, i) => (
                    <li key={s.uid} className="rounded-lg border border-default">
                      <button type="button" aria-expanded={openStep === s.uid} onClick={() => setOpenStep(openStep === s.uid ? null : s.uid)} className="flex w-full items-center gap-2 px-2 py-1 text-left text-xs">
                        {s.done ? <Check className="h-3.5 w-3.5 text-brand" aria-label="Done" /> : <span className="w-3.5 text-center text-muted">{i + 1}</span>}
                        <span className={s.done ? "text-secondary" : "font-semibold text-primary"}>{s.title}</span>
                      </button>
                      {openStep === s.uid && (
                        <div className="space-y-2 border-t border-default px-2 py-2">
                          {s.body && <p className="whitespace-pre-wrap text-xs leading-relaxed text-primary">{s.body}</p>}
                          {(s.libraryItemId || s.linkUrl) && (
                            <p className="flex flex-wrap gap-3 text-xs">
                              {s.libraryItemId && (
                                <Link href={`/dashboard/remote-sales/library?scope=company&item=${s.libraryItemId}&from=training`} className="font-semibold text-brand hover:underline">
                                  Listen in the library
                                </Link>
                              )}
                              {s.linkUrl && (
                                <a href={s.linkUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand hover:underline">
                                  Open link
                                </a>
                              )}
                            </p>
                          )}
                          {s.kind === "practice" && (
                            <p className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="text-secondary">
                                {s.retired ? "This practice was retired before it reached you — it doesn't count toward the course." : s.practiceState ? PRACTICE[s.practiceState] ?? s.practiceState : "Not assigned to you yet — ask your manager."}
                              </span>
                              {s.practiceAssignmentId && !s.done && (
                                <Link href={`/dashboard/remote-sales/practice?assignment=${s.practiceAssignmentId}`} className="rounded-lg bg-ember-400 px-3 py-1 font-semibold text-ink-950">
                                  Practice it
                                </Link>
                              )}
                            </p>
                          )}
                          {s.kind !== "practice" && !s.done && (
                            <button type="button" disabled={busy} onClick={() => void markDone(c, s)} className="rounded-lg bg-ember-400 px-3 py-1 text-xs font-semibold text-ink-950 disabled:opacity-60">
                              {busy ? "Saving…" : "Mark done"}
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
