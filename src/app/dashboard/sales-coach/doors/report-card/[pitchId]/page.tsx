import { PitchDetail } from "@/components/sales-coach/doorlog/PitchDetail";

/**
 * /dashboard/sales-coach/doors/report-card/[pitchId] — per-pitch detail drill-down (Macro Mode).
 */
export const dynamic = "force-dynamic";

export default async function PitchDetailPage({
  params,
}: {
  params: Promise<{ pitchId: string }>;
}) {
  const { pitchId } = await params;
  return <PitchDetail pitchId={pitchId} />;
}
