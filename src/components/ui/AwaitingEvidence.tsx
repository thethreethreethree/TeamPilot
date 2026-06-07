import { Lock } from "lucide-react";

/**
 * The honest empty state for any panel that previously asserted a problem before
 * earning the right to (§3.2). Surfaces the Understanding Gate so the user
 * knows *why* the System is not speaking — it is not a bug, it is the rule.
 *
 * Once the signals layer is producing data, this panel will swap to a "1 of 3 signals
 * collected" progress state, then to the actual surfaced problem when the gate clears.
 */
export default function AwaitingEvidence({
  domain,
  hint,
}: {
  /** e.g. "operations", "finance", "marketing" */
  domain: string;
  /** What kind of signal would unblock this — phrased as guidance, not assertion. */
  hint: string;
}) {
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
