"use client";

import { useRouter } from "next/navigation";
import { MeetingPrepUp } from "./MeetingPrepUp";

/**
 * The client half of /dashboard/meeting-coach/prep — navigation only.
 *
 * It exists so the PAGE can stay a server component. Route segment config (`export const dynamic`)
 * is only honoured in a server component; in a `"use client"` page file it is inert, which is how
 * this route ended up statically prerendered and breaking the build. Its sibling
 * /dashboard/sales-coach/doors already had the right shape — a server shell mounting a client
 * component — and this is now the same.
 */
export function MeetingPrepUpRoute() {
  const router = useRouter();
  return <MeetingPrepUp onStart={(prepId) => router.push(`/dashboard/meeting-coach?prepId=${prepId}`)} />;
}
