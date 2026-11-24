/**
 * Macro Mode's "brain dump when they first open the software" (General Sales Interface PDF): Today opens on the first
 * visit of the day. One record of "Today was seen today", per browser, shared by Today (seeing it counts) and Calls
 * (which redirects only when it wasn't) — two separate keys let Calls bounce someone who had already opened Today
 * (review 2026-11-25). Storage failing means "not recorded": Calls then just shows, never a loop.
 */
const KEY = "rss-macro-today-shown";
export const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function todaySeenToday(): boolean | null {
  try {
    return window.localStorage.getItem(KEY) === localDay();
  } catch {
    return null;
  }
}

export function markTodaySeen(): boolean {
  try {
    window.localStorage.setItem(KEY, localDay());
    return true;
  } catch {
    return false;
  }
}
