import { Lock } from "lucide-react";

/**
 * The honest empty state for any panel that previously asserted a problem before
 * earning the right to (CLAUDE.md §3.2). Surfaces the Understanding Gate so the user
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
    <div className="flex items-start gap-3 p-4 rounded-xl bg-[#12141f] border border-[#252840]">
      <Lock className="w-4 h-4 text-[#5a6399] flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-[#e8eaf6]">
          Awaiting evidence
        </p>
        <p className="text-xs text-[#5a6399] mt-1 leading-relaxed">
          ExecOS will surface a {domain} problem here once it links to{" "}
          <span className="text-[#8895c4] font-medium">≥3 signals from ≥2 distinct sources</span>{" "}
          and an explicit diagnosis is stated. Until that gate clears, the System stays silent.
        </p>
        <p className="text-xs text-[#5a6399] mt-2 leading-relaxed">
          <span className="text-[#7a96ff]">What would unblock it:</span> {hint}
        </p>
        <p className="text-[10px] text-[#3a3f5c] mt-2 uppercase tracking-widest">
          Understanding Gate · CLAUDE.md §3.2
        </p>
      </div>
    </div>
  );
}
