import { Hourglass } from "lucide-react";
import TopBar from "@/components/layout/TopBar";

/**
 * Honest placeholder for a Sales Coach product section that's planned
 * but not built yet (AMD-006 L3 — no nav dead-ends; §3.4 — say what it
 * IS and that it's coming, don't fake a finished surface).
 */
export function SalesCoachComing({
  title,
  whatItIs,
}: {
  title: string;
  whatItIs: string;
}) {
  return (
    <>
      <TopBar title={title} subtitle="Sales Coach" />
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-3xl mx-auto w-full">
        <div className="rounded-xl border border-default bg-white/[0.01] p-5">
          <div className="inline-flex items-center gap-1.5 text-[11px] text-muted rounded-md border border-default px-2 py-1 mb-3">
            <Hourglass className="w-3 h-3" aria-hidden />
            Coming soon
          </div>
          <h2 className="text-sm font-semibold text-primary mb-1">{title}</h2>
          <p className="text-xs text-secondary leading-relaxed">{whatItIs}</p>
        </div>
      </div>
    </>
  );
}
