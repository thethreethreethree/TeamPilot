/**
 * Remote Sales first-week checklist (2026-11-25; Gong ledger F36.40; founder picker "Short checklist, dismissible").
 * Four steps, each ticked from what the person has actually done — never a self-report. Pure.
 */
export type StepKey = "call" | "checklist" | "prospect" | "practice";
export type Step = { key: StepKey; label: string; href: string; done: boolean };

export const STEPS: Array<Omit<Step, "done">> = [
  { key: "call", label: "Make or upload your first phone or video call", href: "/dashboard/remote-sales" },
  { key: "checklist", label: "Review a call's Next Meeting checklist", href: "/dashboard/remote-sales" },
  { key: "prospect", label: "Add a prospect to your pipeline", href: "/dashboard/remote-sales/pipeline" },
  { key: "practice", label: "Try a practice scenario", href: "/dashboard/remote-sales/training" },
];

export function gettingStarted(done: Record<StepKey, boolean>): { steps: Step[]; complete: boolean } {
  const steps = STEPS.map((s) => ({ ...s, done: done[s.key] }));
  return { steps, complete: steps.every((s) => s.done) };
}
