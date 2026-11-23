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
export const routineProgress = (steps: Step[]) => ({ done: steps.filter((s) => s.state === "done").length, checked: steps.filter((s) => s.state !== "unknown").length });
