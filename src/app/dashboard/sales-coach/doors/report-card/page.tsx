import { PitchPerformance } from "@/components/sales-coach/doorlog/PitchPerformance";

/**
 * /dashboard/sales-coach/doors/report-card — Macro Mode Tab 2 (Report Card). The reflective surface;
 * reads precomputed pattern summaries + the pitch list (no LLM cost on view).
 */
export const dynamic = "force-dynamic";

export default function PitchPerformancePage() {
  return <PitchPerformance />;
}
