"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * MeetingHistoryList — the facilitator's recent meetings, each linking to its review (closes the "review a PAST
 * meeting, not just the just-ended one" reach). Fetches GET /api/coach/meeting-session. Renders NOTHING when
 * there are none or on a load failure — a supplementary list must never break the page it sits on. Theme tokens.
 */
type MeetingRow = { id: string; title: string | null; kind: string; startedAt: string; endedAt: string | null };

function shortDate(iso: string): string {
  // Locale-free, stable: YYYY-MM-DD → "Mon D". Avoids a timezone-shifting toLocaleString in the browser.
  const d = iso.slice(0, 10);
  return d || iso;
}

export function MeetingHistoryList() {
  const [rows, setRows] = useState<MeetingRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/coach/meeting-session");
        if (!res.ok) return;
        const data = (await res.json()) as { meetings: MeetingRow[] };
        if (!cancelled) setRows(Array.isArray(data.meetings) ? data.meetings : []);
      } catch {
        /* silent — the list is supplementary */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!rows || rows.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Your meetings</h2>
      <div className="flex flex-col gap-1.5">
        {rows.map((m) => (
          <Link
            key={m.id}
            href={`/dashboard/meeting-coach/${m.id}/review`}
            className="flex items-center justify-between gap-3 rounded-lg border border-default bg-surface px-3 py-2 hover:border-strong"
          >
            <span className="min-w-0 truncate text-sm text-primary">{m.title || "Untitled meeting"}</span>
            <span className="shrink-0 text-xs text-muted">
              <span className="capitalize">{m.kind}</span> · {shortDate(m.startedAt)}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
