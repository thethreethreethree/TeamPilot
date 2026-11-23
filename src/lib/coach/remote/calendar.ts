/**
 * Remote Sales → Pipeline → Calendar (2026-11-23; Gong's "Activity Calendar: quick view of customer conversations
 * across team members"). One week, day by day: the calls BOOKED (each open prospect's next call date) and the calls
 * HELD (remote coaching sessions that started that day, in the viewer's time zone). Pure, so the bucketing is tested.
 */

export type Booked = { prospectId: string; repId: string; name: string | null; organization: string | null; time?: string | null };
export type Held = { sessionId: string; repId: string; startedAt: string; label: string | null; outcome: string | null; prospectId: string | null; prospectName: string | null };
export type CalendarDay = { day: string; booked: Booked[]; held: Held[] };

/** YYYY-MM-DD plus n days (noon-based, so no offset moves it across a date). */
export const addDays = (day: string, n: number): string => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** The Monday on or before `day`. */
export function weekStart(day: string): string {
  const dow = new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((dow + 6) % 7));
}

/** The viewer's calendar day of an instant; `offsetMin` is the browser's getTimezoneOffset() (minutes behind UTC). */
export const localDay = (iso: string, offsetMin: number): string => new Date(Date.parse(iso) - offsetMin * 60_000).toISOString().slice(0, 10);

/** Seven days from `from`, each with its booked and held calls; held calls in time order. */
export function buildWeek(from: string, booked: Array<Booked & { day: string }>, held: Held[], offsetMin: number): CalendarDay[] {
  const days: CalendarDay[] = Array.from({ length: 7 }, (_, i) => ({ day: addDays(from, i), booked: [], held: [] }));
  const at = new Map(days.map((d) => [d.day, d]));
  // Booked calls with a time first, in time order; untimed after (0325).
  for (const b of [...booked].sort((x, y) => (x.time ?? "99:99").localeCompare(y.time ?? "99:99"))) {
    const { day, ...rest } = b;
    at.get(day)?.booked.push(rest);
  }
  for (const h of [...held].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) at.get(localDay(h.startedAt, offsetMin))?.held.push(h);
  return days;
}
