"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * A manager's nudge on Remote Sales → Today: "N phone/video calls are waiting to be scored".
 *
 * Founder decision 2026-11-23: scoring the backlog stays manual, and the waiting calls are made visible so they are not
 * missed. The number is the backfill route's own count (`?module=remote_sales`) — the same read the Coaching panel
 * shows — so the two can never disagree. It links to Coaching, where the manager sees what will be spent and runs it.
 *
 * Renders NOTHING when there is nothing waiting, for a non-manager (401/403 — the backlog is not theirs), or when the
 * count fails. That last is deliberate and is not a confident zero: this notice makes no claim when silent, and the
 * Coaching panel, which is where the number is acted on, says out loud when it could not be read.
 */
export function UnscoredCallsNotice() {
  const [waiting, setWaiting] = useState(0);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const r = await fetch("/api/coach/sales-session/pitch-score/backfill?module=remote_sales", { cache: "no-store" });
        if (!r.ok) return;
        const body = (await r.json()) as { unscored?: number };
        if (live && typeof body.unscored === "number") setWaiting(body.unscored);
      } catch {
        /* silent by design — see above */
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  if (waiting <= 0) return null;

  return (
    <div className="rounded-xl border border-ember-400/40 bg-ember-400/[0.06] px-4 py-3 text-sm text-primary">
      <span className="font-semibold">
        {waiting} phone/video call{waiting === 1 ? " is" : "s are"} waiting to be scored.
      </span>{" "}
      <span className="text-secondary">Until scored, {waiting === 1 ? "it counts" : "they count"} on no scoreboard.</span>{" "}
      <Link href="/dashboard/remote-sales/coaching" className="font-medium text-ember-400 underline-offset-2 hover:underline">
        Review and score in Coaching
      </Link>
    </div>
  );
}
