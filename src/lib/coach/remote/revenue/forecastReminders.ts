import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import { periodOf, shiftPeriod } from "./forecast";

/**
 * The forecast due day and its reminder (revenue plan phase 8, 0391; Gong F22.4). On the company's due weekday (its own
 * day, as the nightly job dates everything), each person who forecasts — someone who submitted for this quarter or the
 * last — and hasn't submitted for this quarter in the 7 days up to today gets one bell reminder. Once per person per due
 * date: the claim (forecast_reminders) is written before the reminder, so overlapping runs never send it twice; a claim
 * whose notification then fails is not retried (a missed reminder, never a doubled one). A removed person isn't reminded.
 * Service role, every read pinned to the company.
 */
/** The weekday of a YYYY-MM-DD day (0 Sunday … 6 Saturday). Pure. */
export const weekdayOf = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();

/** Who to remind today, or nobody when today isn't the due day. Pure. */
export function reminderRecipients(subs: Array<{ user_id: string; period: string; created_at: string }>, day: string, dueWeekday: number): string[] {
  if (weekdayOf(day) !== dueWeekday) return [];
  const period = periodOf(day);
  const prev = shiftPeriod(period, -1);
  const weekStart = new Date(Date.parse(`${day}T00:00:00Z`) - 6 * 86_400_000).toISOString();
  const forecasters = new Set(subs.filter((s) => s.period === period || s.period === prev).map((s) => String(s.user_id)));
  const upToDate = new Set(subs.filter((s) => s.period === period && s.created_at >= weekStart).map((s) => String(s.user_id)));
  return [...forecasters].filter((u) => !upToDate.has(u)).sort();
}

/** Sends today's reminders for one company; how many were sent, or null when a read failed. */
export async function sendForecastReminders(admin: SupabaseClient, companyId: string, day: string, dueWeekday: number): Promise<number | null> {
  if (weekdayOf(day) !== dueWeekday) return 0;
  const period = periodOf(day);
  const { data: subs, error } = await fetchAllPagedResult<{ id: number; user_id: string; period: string; created_at: string }>(
    (f, t) => admin.from("forecast_submissions").select("id, user_id, period, created_at").eq("company_id", companyId).in("period", [period, shiftPeriod(period, -1)]).order("id").range(f, t),
    { label: "forecast submissions (reminders)" },
  );
  if (error) {
    console.error(`[forecast-reminders] read failed company=${companyId}: ${error.message}`);
    return null;
  }
  const want = reminderRecipients(subs ?? [], day, dueWeekday);
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
    const { error: cErr } = await admin.from("forecast_reminders").insert({ company_id: companyId, user_id: userId, due_day: day });
    if (cErr) {
      if (cErr.code === "23505") continue; // another run has it
      console.error(`[forecast-reminders] claim failed company=${companyId}: ${cErr.message}`);
      return null;
    }
    const { error: nErr } = await admin.from("manager_notifications").insert({ company_id: companyId, recipient_id: userId, agent_id: userId, type: "forecast_due", payload: { period } });
    if (nErr) console.error(`[forecast-reminders] notification failed company=${companyId}: ${nErr.message}`);
    else sent += 1;
  }
  return sent;
}
