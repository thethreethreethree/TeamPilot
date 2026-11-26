/**
 * Engage flows (Gong M24 sequences, M25 call outcomes), as rules. A flow is ordered steps (email, call, task), each with
 * a delay after the step before it (the first after enrolment), in hours or business days. An enrolment is one person
 * (a contact on a deal) going through one flow. Pure, so the schedule and the state rules are tested.
 */
export type StepKind = "email" | "call" | "task";
export type Step = { kind: StepKind; delay: { amount: number; unit: "hours" | "business_days" }; title: string; body?: string };

export class FlowError extends Error {}

/** A flow's steps, checked: 1–15 steps, delays 0–30 business days or 0–720 hours, a title on each. */
export function checkSteps(steps: Step[]): Step[] {
  if (!Array.isArray(steps) || steps.length < 1 || steps.length > 15) throw new FlowError("A flow has 1 to 15 steps.");
  for (const [i, s] of steps.entries()) {
    if (!["email", "call", "task"].includes(s.kind)) throw new FlowError(`Step ${i + 1}: unknown kind.`);
    const max = s.delay.unit === "hours" ? 720 : 30;
    if (!Number.isInteger(s.delay.amount) || s.delay.amount < 0 || s.delay.amount > max) throw new FlowError(`Step ${i + 1}: the delay must be 0–${max} ${s.delay.unit === "hours" ? "hours" : "business days"}.`);
    if (!s.title?.trim() || s.title.length > 120) throw new FlowError(`Step ${i + 1} needs a title of 1–120 characters.`);
  }
  return steps;
}

/** Add business days (Mon–Fri) to a UTC instant; 0 keeps the day but moves a weekend to Monday. */
export function addBusinessDays(fromIso: string, days: number): string {
  const d = new Date(fromIso);
  const isWeekend = () => d.getUTCDay() === 0 || d.getUTCDay() === 6;
  while (isWeekend()) d.setUTCDate(d.getUTCDate() + 1);
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (!isWeekend()) left -= 1;
  }
  return d.toISOString();
}

/** When a step falls due, from the moment the one before it was done (or the enrolment started). */
export function dueAfter(prevDoneIso: string, step: Step): string {
  if (step.delay.unit === "hours") return new Date(Date.parse(prevDoneIso) + step.delay.amount * 3_600_000).toISOString();
  return addBusinessDays(prevDoneIso, step.delay.amount);
}

// ── Enrolment states ────────────────────────────────────────────────────────────────────────────────────────────────
export type EnrolState = "active" | "paused" | "finished" | "removed";
export type EnrolAction = "complete_step" | "skip_step" | "pause" | "resume" | "remove" | "replied" | "meeting_booked" | "opted_out";

/**
 * The rules (Gong's ruleset defaults, M24 F24.4, as one fixed set — plan E2): a reply or a booked meeting finishes the
 * enrolment; an opt-out removes it and the person can't be enrolled again; finishing the last step finishes it.
 * Returns the new state and the step index; throws on an action that doesn't apply.
 */
export function applyAction(state: EnrolState, stepIndex: number, stepCount: number, action: EnrolAction): { state: EnrolState; stepIndex: number } {
  const done = state === "finished" || state === "removed";
  if (done) throw new FlowError("This enrolment has ended.");
  switch (action) {
    case "complete_step":
    case "skip_step":
      if (state !== "active") throw new FlowError("Resume the enrolment first.");
      return stepIndex + 1 >= stepCount ? { state: "finished", stepIndex: stepCount } : { state: "active", stepIndex: stepIndex + 1 };
    case "pause":
      if (state !== "active") throw new FlowError("Only an active enrolment can be paused.");
      return { state: "paused", stepIndex };
    case "resume":
      if (state !== "paused") throw new FlowError("Only a paused enrolment can be resumed.");
      return { state: "active", stepIndex };
    case "replied":
    case "meeting_booked":
      return { state: "finished", stepIndex };
    case "opted_out":
    case "remove":
      return { state: "removed", stepIndex };
  }
}

// ── Call outcomes (M25 F25.7, F25.8) ────────────────────────────────────────────────────────────────────────────────
export type Outcome = { key: string; label: string; connected: boolean; sentiment: "positive" | "neutral" | "negative" };
/** Gong's default list (F25.7), our wording. One company-wide set (plan E3). */
export const DEFAULT_OUTCOMES: Outcome[] = [
  { key: "no_voicemail", label: "No answer, no voicemail", connected: false, sentiment: "neutral" },
  { key: "left_voicemail", label: "Left a voicemail", connected: false, sentiment: "neutral" },
  { key: "not_in_service", label: "Number not in service", connected: false, sentiment: "negative" },
  { key: "busy", label: "Busy", connected: false, sentiment: "neutral" },
  { key: "follow_up", label: "Follow up", connected: true, sentiment: "positive" },
  { key: "meeting_booked", label: "Meeting booked", connected: true, sentiment: "positive" },
  { key: "bad_timing", label: "Bad timing", connected: true, sentiment: "neutral" },
  { key: "has_solution", label: "Already has a solution", connected: true, sentiment: "negative" },
  { key: "wrong_person", label: "Wrong person", connected: true, sentiment: "neutral" },
  { key: "wrong_number", label: "Wrong number", connected: false, sentiment: "negative" },
  { key: "referral", label: "Gave a referral", connected: true, sentiment: "positive" },
  { key: "not_a_fit", label: "Not a fit", connected: true, sentiment: "negative" },
  { key: "opt_out", label: "Asked not to be contacted", connected: true, sentiment: "negative" },
  { key: "hung_up", label: "Hung up", connected: true, sentiment: "negative" },
  { key: "gatekeeper", label: "Reached a gatekeeper", connected: true, sentiment: "neutral" },
  { key: "not_interested", label: "Not interested", connected: true, sentiment: "negative" },
];

/** Connect rate = connected outcomes ÷ calls with an outcome; null with none. */
export function connectRate(outcomeKeys: string[], outcomes: Outcome[] = DEFAULT_OUTCOMES): number | null {
  const known = outcomeKeys.map((k) => outcomes.find((o) => o.key === k)).filter((o): o is Outcome => !!o);
  if (!known.length) return null;
  return known.filter((o) => o.connected).length / known.length;
}

/** What an outcome does to the enrolment: a booked meeting finishes it; an opt-out removes it. Others just complete the step. */
export function outcomeAction(key: string): EnrolAction {
  if (key === "meeting_booked") return "meeting_booked";
  if (key === "opt_out") return "opted_out";
  return "complete_step";
}
