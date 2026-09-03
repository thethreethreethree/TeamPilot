import { TodaysMetricsPager } from "@/components/sales-coach/TodaysMetricsPager";

/**
 * /dashboard/sales-coach/doors/todays-metrics — Macro Mode "Today's Metrics" (founder spec 2026-08-19, revised
 * 2026-09-04). Now ONE module with TWO swipeable pages: the gamified rep dashboard (default) and the original
 * door field read (Next-Door focus + KPI trio + Score Chart), switched by a top toggle AND a swipe. The pager
 * mounts both; this shell just hosts it.
 */
export const dynamic = "force-dynamic";

export default function TodaysMetricsPage() {
  return <TodaysMetricsPager />;
}
