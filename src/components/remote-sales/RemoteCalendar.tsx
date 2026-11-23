"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, ChevronLeft, ChevronRight, Loader2, PhoneCall } from "lucide-react";
import { addDays, weekStart, type CalendarDay } from "@/lib/coach/remote/calendar";

/**
 * Remote Sales → Pipeline → Calendar (2026-11-23; Gong's Activity Calendar). One week of customer calls: booked (an
 * open prospect's next call date) and held (recorded calls, at the viewer's local time). Follows "Whose pipeline", so
 * a manager sees one report or the whole team. A booked call opens the prospect; a held call opens the call.
 */
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const dayLabel = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const OUTCOME: Record<string, string> = { sold: "Sold", follow_up: "Follow-up", no_sale: "No sale", no_contact: "No contact", undecided: "Undecided" };

export function RemoteCalendar({ scope, nameOf, onOpenProspect }: { scope: string; nameOf: (repId: string) => string | null; onOpenProspect: (id: string) => void }) {
  const [week, setWeek] = useState(() => weekStart(localToday()));
  const [days, setDays] = useState<CalendarDay[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    setDays(null);
    try {
      const q = new URLSearchParams({ week, scope, tz: String(new Date().getTimezoneOffset()) });
      const r = await fetch(`/api/coach/remote/calendar?${q}`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      setDays(((await r.json()) as { days: CalendarDay[] }).days);
    } catch {
      setFailed(true);
    }
  }, [week, scope]);
  useEffect(() => {
    void load();
  }, [load]);

  const today = localToday();
  const showRep = scope !== "mine";
  const total = days ? days.reduce((n, d) => n + d.booked.length + d.held.length, 0) : 0;

  return (
    <section aria-label="Calls calendar" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setWeek((w) => addDays(w, -7))} aria-label="Previous week" className="rounded-lg border border-default p-1.5 text-secondary hover:border-brand/60">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" onClick={() => setWeek((w) => addDays(w, 7))} aria-label="Next week" className="rounded-lg border border-default p-1.5 text-secondary hover:border-brand/60">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
          <p className="ml-2 text-xs font-semibold text-primary">
            {dayLabel(week)} – {dayLabel(addDays(week, 6))}
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-secondary">
          <span className="flex items-center gap-1">
            <CalendarClock className="h-3.5 w-3.5 text-brand" aria-hidden /> Booked
          </span>
          <span className="flex items-center gap-1">
            <PhoneCall className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden /> Held
          </span>
          {week !== weekStart(today) && (
            <button type="button" onClick={() => setWeek(weekStart(today))} className="rounded-lg border border-default px-2 py-1 text-[11px] text-primary hover:border-brand/60">
              This week
            </button>
          )}
        </div>
      </div>

      {failed ? (
        <p className="rounded-xl border border-default bg-surface p-6 text-center text-xs text-muted">
          Couldn&apos;t load the calendar.{" "}
          <button type="button" onClick={() => void load()} className="underline">
            Try again
          </button>
        </p>
      ) : !days ? (
        <p className="flex items-center justify-center gap-2 p-6 text-xs text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading calendar…
        </p>
      ) : (
        <>
          {total === 0 && (
            <p className="rounded-xl border border-default bg-surface p-3 text-center text-xs text-secondary">
              No calls booked or held this week. Set a prospect&apos;s next call date in the list to see it here.
            </p>
          )}
          <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
            {days.map((d) => (
              <li key={d.day} className={`min-h-24 rounded-xl border bg-surface p-2 ${d.day === today ? "border-brand" : "border-default"}`}>
                <p className={`text-[11px] font-semibold ${d.day === today ? "text-brand" : "text-muted"}`}>
                  {dayLabel(d.day)}
                  {d.day === today ? " · today" : ""}
                </p>
                <ul className="mt-1.5 space-y-1">
                  {d.held.map((h) => (
                    <li key={h.sessionId}>
                      <Link href={`/dashboard/remote-sales/calls/${h.sessionId}`} className="flex items-start gap-1 rounded-md bg-emerald-500/10 px-1.5 py-1 text-[11px] text-primary hover:bg-emerald-500/20">
                        <PhoneCall className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {timeLabel(h.startedAt)} · {h.prospectName ?? h.label ?? "Call"}
                          </span>
                          <span className="block truncate text-muted">
                            {[showRep ? nameOf(h.repId) : null, h.outcome ? (OUTCOME[h.outcome] ?? h.outcome) : null].filter(Boolean).join(" · ") || "Held"}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                  {d.booked.map((b) => (
                    <li key={b.prospectId}>
                      <button type="button" onClick={() => onOpenProspect(b.prospectId)} className="flex w-full items-start gap-1 rounded-md bg-brand/10 px-1.5 py-1 text-left text-[11px] text-primary hover:bg-brand/20">
                        <CalendarClock className="mt-0.5 h-3 w-3 shrink-0 text-brand" aria-hidden />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {b.time ? `${new Date(`2000-01-01T${b.time}:00`).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} · ` : ""}
                            {b.name ?? "Unnamed prospect"}
                          </span>
                          <span className="block truncate text-muted">{[b.organization, showRep ? nameOf(b.repId) : null].filter(Boolean).join(" · ") || "Booked"}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
