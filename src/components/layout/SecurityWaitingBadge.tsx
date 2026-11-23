"use client";

import { useEffect, useState } from "react";

/**
 * The count on the founders' "Security reports" sidebar item (2026-11-23): public reports with no response recorded
 * yet, so one doesn't wait unseen until someone opens the inbox (OPEN.md "security reports have no alert"; in-app per
 * D10). Rendered only inside the vendor-admin nav. Shows nothing at zero or when the count couldn't be read — a failed
 * read never shows as "0 waiting". Re-reads when refreshKey (the path) changes, e.g. after leaving the inbox.
 */
export function SecurityWaitingBadge({ refreshKey }: { refreshKey: string }) {
  const [waiting, setWaiting] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/admin/security-reports/waiting", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { waiting?: number }) => live && setWaiting(typeof j.waiting === "number" ? j.waiting : null))
      .catch(() => live && setWaiting(null));
    return () => {
      live = false;
    };
  }, [refreshKey]);
  if (waiting === null || waiting <= 0) return null;
  return (
    <span
      className="ml-auto rounded-full bg-amber-500/20 px-1.5 text-[10px] font-semibold tabular-nums text-amber-700 dark:text-amber-300"
      aria-label={`${waiting} ${waiting === 1 ? "report" : "reports"} waiting for a response`}
    >
      {waiting}
    </span>
  );
}
