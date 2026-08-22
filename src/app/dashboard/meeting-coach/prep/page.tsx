"use client";

import { useRouter } from "next/navigation";
import { MeetingPrepUp } from "@/components/sales-coach/meeting/MeetingPrepUp";

/**
 * Prep-up screen (Team-Sync / Meeting Coach). Collect the goal + must-discuss topics + documents before a
 * meeting; "Start Meeting" carries the prepId to the live coach (Phase 5 wires it into session creation so the
 * coach loads the agenda). Auth/company context comes from the dashboard layout.
 */
export default function MeetingPrepPage() {
  const router = useRouter();
  return <MeetingPrepUp onStart={(prepId) => router.push(`/dashboard/meeting-coach?prepId=${prepId}`)} />;
}
