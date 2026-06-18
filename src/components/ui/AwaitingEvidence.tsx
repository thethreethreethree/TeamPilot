import { Lock, Construction } from "lucide-react";

/**
 * The honest empty state for any panel that previously asserted a problem before
 * earning the right to (§3.2). Surfaces the Understanding Gate so the user
 * knows *why* the System is not speaking — it is not a bug, it is the rule.
 *
 * 2026-06-19 (Wave S) — accepts an optional `mode` prop:
 *   - "awaiting" (default): the §3.2 gate state, current behavior
 *   - "design-preview": for surfaces where the AI feature is
 *     intentionally not built yet (finance / marketing dashboards).
 *     Without this, the gate-style message reads as "if I produce
 *     more signals, the AI will turn on" — false promise. The
 *     design-preview wording is honest about the state.
 */
export default function AwaitingEvidence({
  domain,
  hint,
  mode = "awaiting",
}: {
  /** e.g. "operations", "finance", "marketing" */
  domain: string;
  /** What kind of signal would unblock this — phrased as guidance, not assertion. */
  hint: string;
  mode?: "awaiting" | "design-preview";
}) {
  if (mode === "design-preview") {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl bg-surface border border-default">
        <Construction className="w-4 h-4 text-muted flex-shrink-0 mt-0.5" aria-hidden />
        <div className="flex-1">
          <p className="text-sm font-medium text-primary">
            Design preview — not wired yet
          </p>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            The {domain} dashboard above is a design preview of what
            this surface will look like. The AI {domain} diagnosis was
            sunset in 2026-04 — it produced surface-level patterns that
            failed the §3.2 understanding gate when measured against
            outcomes. The next version will replay the same chain
            architecture you see in Operations, scoped to {domain}.
          </p>
          <p className="text-xs text-muted mt-2 leading-relaxed">
            <span className="text-brand">When it will reactivate:</span>{" "}
            {hint}
          </p>
          <p className="text-[10px] text-muted mt-2 uppercase tracking-widest">
            Design preview · not GA
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-surface border border-default">
      <Lock className="w-4 h-4 text-muted flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-primary">
          Awaiting evidence
        </p>
        <p className="text-xs text-muted mt-1 leading-relaxed">
          ELOSTATE will surface a {domain} problem here once it links to{" "}
          <span className="text-secondary font-medium">≥3 signals from ≥2 distinct sources</span>{" "}
          and an explicit diagnosis is stated. Until that gate clears, the System stays silent.
        </p>
        <p className="text-xs text-muted mt-2 leading-relaxed">
          <span className="text-brand">What would unblock it:</span> {hint}
        </p>
        <p className="text-[10px] text-muted mt-2 uppercase tracking-widest">
          Understanding Gate · §3.2
        </p>
      </div>
    </div>
  );
}
