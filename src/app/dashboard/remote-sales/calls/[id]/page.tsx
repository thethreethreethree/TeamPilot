"use client";

import { SessionDetailView } from "@/components/sessions/SessionDetailView";

/** Remote Sales → one phone or video call. An in-person session is sent to its Sales Coach page. */
export default function RemoteSalesCallPage() {
  return <SessionDetailView module="remote_sales" />;
}
