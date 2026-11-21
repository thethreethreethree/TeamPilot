"use client";

import { SessionDetailView } from "@/components/sessions/SessionDetailView";

/** Sales Coach → one in-person session. A phone or video call is sent to its Remote Sales page. */
export default function SalesCoachSessionPage() {
  return <SessionDetailView module="sales_coach" />;
}
