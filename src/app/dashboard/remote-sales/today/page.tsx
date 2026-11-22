"use client";

import { RemoteToday } from "@/components/remote-sales/RemoteToday";
import { UnscoredCallsNotice } from "@/components/remote-sales/UnscoredCallsNotice";

/**
 * Remote Sales → Today (Macro Mode, docs/rss/MACRO-MODE-SPEC.md, 0303): the rep's brain dump, their pipeline's day,
 * yesterday. Managers also see how many phone/video calls are waiting to be scored (founder 2026-11-23).
 */
export default function RemoteSalesTodayPage() {
  return (
    <div className="space-y-4">
      <UnscoredCallsNotice />
      <RemoteToday />
    </div>
  );
}
