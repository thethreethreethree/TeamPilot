import { MeetingCoachingPanel } from "@/components/sales-coach/MeetingCoachingPanel";

/**
 * Meeting Coach (Team-Sync) — live meeting/huddle coaching. The panel owns session creation + the live loop.
 * When arriving from Prep-up ("Start Meeting"), the `prepId` query binds the new session to that prep so the
 * coach loads its agenda (goal + must-discuss topics + docs). Auth/company context comes from the dashboard layout.
 */
export default async function MeetingCoachPage({
  searchParams,
}: {
  searchParams: Promise<{ prepId?: string }>;
}) {
  const { prepId } = await searchParams;
  return <MeetingCoachingPanel initialPrepId={typeof prepId === "string" ? prepId : undefined} />;
}
