import { OUTCOME_TONE_CLASS, outcomeLabel, outcomeTone } from "@/lib/coach/v5/outcomeLabels";

/** A call's outcome as a colored badge (F26.10): Sold green, No sale amber, the rest grey. */
export function OutcomeBadge({ outcome, label }: { outcome: string; label?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-1.5 py-px text-[10px] font-semibold ${OUTCOME_TONE_CLASS[outcomeTone(outcome)]}`}>
      {label ?? outcomeLabel(outcome)}
    </span>
  );
}
