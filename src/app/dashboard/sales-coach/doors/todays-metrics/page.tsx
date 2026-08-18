import { TodaysMetrics } from "@/components/sales-coach/doorlog/TodaysMetrics";

/**
 * /dashboard/sales-coach/doors/todays-metrics — Macro Mode Today's Metrics (founder spec 2026-08-19).
 * The 1-page field read (Next-Door focus + KPI trio + Score Chart + growth opportunities), with the
 * Day/Week/Month/All-Time tabs. Client-driven; this shell just mounts it.
 */
export const dynamic = "force-dynamic";

export default function TodaysMetricsPage() {
  return <TodaysMetrics />;
}
