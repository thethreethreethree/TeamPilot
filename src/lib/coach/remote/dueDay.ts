import { localDay } from "./todayShown";

/**
 * Due dates picked in a date field (2026-11-26, review of the course builds). The field gives a day in the MANAGER's
 * own time; the server reads a time without a zone in ITS zone (UTC), so "Dec 1 23:59" used to mean 23:59 UTC — a
 * course turned overdue mid-afternoon west of UTC and showed the next day east of it. The browser turns the day into
 * an exact moment before sending, and shows a stored moment back as the viewer's local day.
 */
export const dueEndOfDay = (day: string): string => new Date(`${day}T23:59:00`).toISOString();
export const dayOf = (iso: string): string => localDay(new Date(iso));
