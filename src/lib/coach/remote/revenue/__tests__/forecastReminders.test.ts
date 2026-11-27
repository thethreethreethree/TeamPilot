import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The forecast reminder (0391; Gong F22.4). Pinned: only on the due weekday; only people who forecast (this quarter or
 * the last) and haven't submitted this quarter in the 7 days up to today; claimed before it's sent, once per person and
 * date; a removed person isn't reminded; every read is pinned to the company.
 */
vi.mock("server-only", () => ({}));
const st = vi.hoisted(() => ({ subs: [] as unknown[], people: [] as unknown[], claims: new Set<string>(), notes: [] as unknown[], eqs: [] as Array<[string, string, unknown]> }));
const admin = {
  from: (table: string) => {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "order", "in"]) q[m] = () => q;
    q.eq = (c: string, v: unknown) => (st.eqs.push([table, c, v]), q);
    q.range = async (f: number) => ({ data: f > 0 ? [] : st.subs, error: null });
    q.then = (r: (v: unknown) => unknown) => r({ data: table === "profiles" ? st.people : [], error: null });
    q.insert = async (row: Record<string, unknown>) => {
      if (table === "forecast_reminders") {
        const k = `${row.user_id}|${row.due_day}`;
        if (st.claims.has(k)) return { error: { code: "23505", message: "dup" } };
        st.claims.add(k);
        return { error: null };
      }
      st.notes.push(row);
      return { error: null };
    };
    return q;
  },
} as never;
import { dueDateFor, reminderRecipients, sendForecastReminders, weekdayOf } from "../forecastReminders";

// 2026-11-30 is a Monday; Q4 2026, previous Q3.
const MON = "2026-11-30";
const sub = (user_id: string, period: string, created_at: string) => ({ user_id, period, created_at });
beforeEach(() => {
  st.subs = [];
  st.people = [];
  st.claims = new Set();
  st.notes = [];
  st.eqs = [];
});

describe("reminderRecipients", () => {
  it("the due date is today or tomorrow, whichever is the due weekday (US West's run is the evening before)", () => {
    expect(weekdayOf(MON)).toBe(1);
    expect(dueDateFor(MON, 1)).toBe(MON);
    expect(dueDateFor("2026-11-29", 1)).toBe(MON); // Sunday's run reminds for Monday
    expect(dueDateFor("2026-12-01", 1)).toBeNull();
  });
  it("for a due date: forecasters not up to date in the 7 days up to it", () => {
    const subs = [
      sub("late", "2026-Q4", "2026-11-10T09:00:00Z"), // this quarter, but 20 days ago
      sub("fresh", "2026-Q4", "2026-11-28T09:00:00Z"), // within the week
      sub("lastq", "2026-Q3", "2026-09-20T09:00:00Z"), // forecast last quarter, nothing this one
      sub("old", "2026-Q2", "2026-05-01T09:00:00Z"), // two quarters back: not a forecaster now
    ];
    expect(reminderRecipients(subs, MON)).toEqual(["lastq", "late"]);
    // a Postgres "+00:00" timestamp is compared by time, not text
    expect(reminderRecipients([sub("x", "2026-Q4", "2026-11-24 00:00:00+00:00")], MON)).toEqual([]);
  });
});

describe("sendForecastReminders", () => {
  it("claims, then sends once per person and date; removed people skipped; reads pinned", async () => {
    st.subs = [{ id: 1, ...sub("a", "2026-Q4", "2026-11-01T00:00:00Z") }, { id: 2, ...sub("gone", "2026-Q4", "2026-11-01T00:00:00Z") }];
    st.people = [{ id: "a", status: "active" }, { id: "gone", status: "removed" }];
    expect(await sendForecastReminders(admin, "co1", MON, 1)).toBe(1);
    expect(st.notes).toEqual([expect.objectContaining({ company_id: "co1", recipient_id: "a", type: "forecast_due", payload: { period: "2026-Q4", due_day: MON } })]);
    expect(st.eqs).toContainEqual(["forecast_submissions", "company_id", "co1"]);
    expect(st.eqs).toContainEqual(["profiles", "company_id", "co1"]);
    // a second run the same day: the claim is taken, nothing sent
    expect(await sendForecastReminders(admin, "co1", MON, 1)).toBe(0);
    expect(st.notes).toHaveLength(1);
  });
  it("neither today nor tomorrow is the due day → nothing read, nothing sent", async () => {
    expect(await sendForecastReminders(admin, "co1", "2026-12-01", 1)).toBe(0);
    expect(st.eqs).toEqual([]);
  });
  it("the evening-before run and the due-day run share the claim: one reminder per date", async () => {
    st.subs = [{ id: 1, ...sub("a", "2026-Q4", "2026-11-01T00:00:00Z") }];
    st.people = [{ id: "a", status: "active" }];
    expect(await sendForecastReminders(admin, "co1", "2026-11-29", 1)).toBe(1);
    expect(await sendForecastReminders(admin, "co1", MON, 1)).toBe(0);
  });
});
