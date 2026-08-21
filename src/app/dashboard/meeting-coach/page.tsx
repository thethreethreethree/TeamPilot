import { MeetingCoachingPanel } from "@/components/sales-coach/MeetingCoachingPanel";

/**
 * Meeting Coach (Team-Sync) — live meeting/huddle coaching. The panel owns session creation + the live loop.
 * Auth/company context is provided by the dashboard layout (same as the sales-coach routes). Nav integration
 * and module-access gating are follow-ups; the route is reachable by URL for the in-person MVP.
 */
export default function MeetingCoachPage() {
  return <MeetingCoachingPanel />;
}
