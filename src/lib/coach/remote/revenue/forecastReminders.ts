import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import { periodOf, shiftPeriod } from "./forecast";

/**
 * The forecast due day and its reminder (revenue plan phase 8, 0391; Gong F22.4). On the first nightly run where the
 * company's due weekday is today or tomorrow (its own days, as the nightly job dates everything), each person who forecasts — someone who submitted for this quarter or the
 * last — and hasn't submitted for this quarter in the 7 days up to today gets one bell reminder. Once per person per due
 * date: the claim (forecast_reminders) is written before the reminder, so overlapping runs never send it twice; a claim
 * whose notification then fails is not retried (a missed reminder, never a doubled one). A removed person isn't reminded.
 * Service role, every read pinned to the company.
 */
/** The weekday of a YYYY-MM-DD day (0 Sunday … 6 Saturday). Pure. */
export const weekdayOf = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * The due date this run reminds for: today or tomorrow (the company's days), whichever is the due weekday; null if
 * neither. Tomorrow counts so a company whose night run falls late in its evening (US West at 05:15 UTC) is reminded
 * the evening before rather than late on the day (review 2026-11-27); the claim makes it once per date. Pure.
 */
export function dueDateFor(day: string, dueWeekday: number): string | null {
  if (weekdayOf(day) === dueWeekday) return day;
  const t = addDays(day, 1);
  return weekdayOf(t) === dueWeekday ? t : null;
}

/** Who to remind for the due date `due`: forecasters with no submission for its quarter in the 7 days up to it. Pure. */
export function reminderRecipients(subs: Array<{ user_id: string; period: string; created_at: string }>, due: string): string[] {
  const period = periodOf(due);
  const prev = shiftPeriod(period, -1);
  const since = Date.parse(`${due}T00:00:00Z`) - 6 * 86_400_000; // compared as times, not strings (formats vary)
  const forecasters = new Set(subs.filter((s) => s.period === period || s.period === prev).map((s) => String(s.user_id)));
  const upToDate = new Set(subs.filter((s) => s.period === period && Date.parse(s.created_at) >= since).map((s) => String(s.user_id)));
  return [...forecasters].filter((u) => !upToDate.has(u)).sort();
}

/** Sends today's reminders for one company; how many were sent, or null when a read failed. */
export async function sendForecastReminders(admin: SupabaseClient, companyId: string, day: string, dueWeekday: number): Promise<number | null> {
  const due = dueDateFor(day, dueWeekday);
  if (!due) return 0;
  const period = periodOf(due);
  const { data: subs, error } = await fetchAllPagedResult<{ id: number; user_id: string; period: string; created_at: string }>(
    (f, t) => admin.from("forecast_submissions").select("id, user_id, period, created_at").eq("company_id", companyId).in("period", [period, shiftPeriod(period, -1)]).order("id").range(f, t),
    { label: "forecast submissions (reminders)" },
  );
  if (error) {
    console.error(`[forecast-reminders] read failed company=${companyId}: ${error.message}`);
    return null;
  }
  const want = reminderRecipients(subs ?? [], due);
  if (!want.length) return 0;
  const { data: people, error: pErr } = await admin.from("profiles").select("id, status").eq("company_id", companyId).in("id", want);
  if (pErr) {
    console.error(`[forecast-reminders] people read failed company=${companyId}: ${pErr.message}`);
    return null;
  }
  const active = new Set(((people ?? []) as Array<{ id: string; status: string | null }>).filter((p) => p.status !== "removed").map((p) => String(p.id)));
  let sent = 0;
  for (const userId of want) {
    if (!active.has(userId)) continue;
    const { error: cErr } = await admin.from("forecast_reminders").insert({ company_id: companyId, user_id: userId, due_day: due });
    if (cErr) {
      if (cErr.code === "23505") continue; // another run has it
      console.error(`[forecast-reminders] claim failed company=${companyId}: ${cErr.message}`);
      return null;
    }
    const { error: nErr } = await admin.from("manager_notifications").insert({ company_id: companyId, recipient_id: userId, agent_id: userId, type: "forecast_due", payload: { period, due_day: due } });
    if (nErr) console.error(`[forecast-reminders] notification failed company=${companyId}: ${nErr.message}`);
    else sent += 1;
  }
  return sent;
}
