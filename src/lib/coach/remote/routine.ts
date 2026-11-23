/**
 * The manager's weekly coaching routine (2026-11-23; ledger F16.12 "Coaching routines", graded LACK). Gong publishes a
 * guided weekly routine; ours is built from what is actually waiting for this manager right now, so each step is a
 * count with a place to act — not advice. Pure, so the wording and the "done" rule are tested.
 *
 * A step whose count couldn't be read is "unknown" — never "done": a failed read is not an empty queue (§3.4).
 */
export type StepKey = "feedback" | "disputes" | "unscored" | "practice";
export type Count = number | null; // null = couldn't be read
export type Step = { key: StepKey; label: string; detail: string; state: "todo" | "done" | "unknown"; count: Count; href: string };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function routineSteps(c: Record<StepKey, Count>): Step[] {
  const step = (key: StepKey, label: string, n: Count, todo: (n: number) => string, done: string, href: string): Step => ({
    key,
    label,
    count: n,
    href,
    state: n === null ? "unknown" : n > 0 ? "todo" : "done",
    detail: n === null ? "Couldn't check right now." : n > 0 ? todo(n) : done,
  });
  return [
    step("feedback", "Answer feedback requests", c.feedback, (n) => `${plural(n, "rep is", "reps are")} waiting for your feedback on a call.`, "No one is waiting for feedback.", "#coaching-inbox"),
    step("disputes", "Settle score disputes", c.disputes, (n) => `${plural(n, "score is", "scores are")} disputed by a rep.`, "No open disputes.", "#score-disputes"),
    step("unscored", "Score the calls that are waiting", c.unscored, (n) => `${plural(n, "call has", "calls have")} no score yet.`, "Every call is scored.", "#unscored-calls"),
    step("practice", "Follow up on overdue practice", c.practice, (n) => `${plural(n, "assigned practice is", "assigned practices are")} past due.`, "No practice is overdue.", "/dashboard/remote-sales/training"),
  ];
}

/** How many steps are done out of those that could be checked. */
export const routineProgress = (steps: Array<Pick<Step, "state">>) => ({ done: steps.filter((s) => s.state === "done").length, checked: steps.filter((s) => s.state !== "unknown").length });

/**
 * The rep's own week (2026-11-23; ledger F16.12, the self-coaching half): what only the rep can do, counted from their
 * own records — practice still due, answers from a manager they asked for feedback, and recent calls they haven't
 * written a note on. Same rule as the manager's: an unread count is "unknown", never "done".
 */
export type RepStepKey = "practice" | "answers" | "notes";
export type RepStep = { key: RepStepKey; label: string; detail: string; state: "todo" | "done" | "unknown"; count: Count; href: string };
export type RepCounts = {
  practice: Count;
  answers: Count;
  waiting: Count; // requests still open — context for the answers step, not a to-do for the rep
  notes: Count;
  answersHref?: string | null; // the newest answered call
  notesHref?: string | null; // the newest call without a note
};

export function repRoutineSteps(c: RepCounts): RepStep[] {
  const state = (n: Count): RepStep["state"] => (n === null ? "unknown" : n > 0 ? "todo" : "done");
  const unknown = "Couldn't check right now.";
  const waiting = c.waiting !== null && c.waiting > 0 ? ` ${plural(c.waiting, "request is", "requests are")} still waiting.` : "";
  return [
    {
      key: "practice",
      label: "Do your assigned practice",
      count: c.practice,
      state: state(c.practice),
      href: "/dashboard/remote-sales/training",
      detail: c.practice === null ? unknown : c.practice > 0 ? `${plural(c.practice, "practice is", "practices are")} still due.` : "No practice is due.",
    },
    {
      key: "answers",
      label: "Read the feedback you asked for",
      count: c.answers,
      state: state(c.answers),
      href: c.answersHref ?? "/dashboard/remote-sales",
      detail: c.answers === null ? unknown : (c.answers > 0 ? `${plural(c.answers, "request was", "requests were")} answered this week.` : "No new answers this week.") + waiting,
    },
    {
      key: "notes",
      label: "Note what you learned on your calls",
      count: c.notes,
      state: state(c.notes),
      href: c.notesHref ?? "/dashboard/remote-sales",
      detail: c.notes === null ? unknown : c.notes > 0 ? `${plural(c.notes, "call", "calls")} this week ${c.notes === 1 ? "has" : "have"} no note from you.` : "Every call this week has a note.",
    },
  ];
}
