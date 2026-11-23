/**
 * Deal risk and a simple forecast for the Remote Sales pipeline (2026-11-23; gong.io capture M36 "Forecast risk scoring
 * and scenario planning", graded LACK: "Pipeline totals only; no sales forecast, risk score or what-if").
 *
 * Deliberately NOT a model. Each flag is a fact the rep can check and fix — no next call booked, a booked call that
 * passed with no call held, a long silence, an overdue to-do, no amount. The forecast multiplies the open value by
 * THIS pipeline's own closed-deal win rate, and refuses to give a number until enough deals have closed (§3.4: no
 * day-one behavior claiming understanding it cannot have). Pure, so every rule is tested.
 */

export type RiskReason = "no_next_call" | "missed_next_call" | "gone_quiet" | "overdue_todo" | "cooled" | "past_close_date" | "no_amount";
export type RiskLevel = "at_risk" | "watch" | "ok";

export const QUIET_DAYS = 21;
/** A prospect with no call at all is "quiet" once it has been in the pipeline this long. */
export const NEW_GRACE_DAYS = 14;
/** Closed deals needed before the pipeline's own win rate is used for a forecast. */
export const MIN_CLOSED_FOR_FORECAST = 5;

export const RISK_WORDS: Record<RiskReason, string> = {
  no_next_call: "No next call booked",
  missed_next_call: "Booked call date passed, no call since",
  gone_quiet: `No call in ${QUIET_DAYS}+ days`,
  overdue_todo: "Overdue to-do",
  cooled: "Customer cooled on the last call",
  past_close_date: "Expected close date passed",
  no_amount: "No deal amount",
};

type P = {
  id: string;
  name: string | null;
  status: "open" | "won" | "lost";
  amount: number | null;
  nextCallDate: string | null;
  /** 0320 — when the rep expects it to close; optional so older callers still type-check. */
  closeDate?: string | null;
  lastCallAt: string | null;
  createdAt: string;
  nextTodo: { due: string | null } | null;
  /** dealSentiment.ts — the last call's net customer sentiment, when read. */
  sentiment?: { last: "warming" | "cooling" | "flat" } | null;
};

const DAY = 86_400_000;
const dayOf = (iso: string) => iso.slice(0, 10);

/** Why an OPEN deal may slip, and how much: two or more of the first six reasons = at risk; one = watch. A missing
 *  amount is a data gap, shown but never enough on its own to call a deal at risk. `today` is the viewer's YYYY-MM-DD. */
export function dealRisk(p: P, today: string): { level: RiskLevel; reasons: RiskReason[] } {
  if (p.status !== "open") return { level: "ok", reasons: [] };
  const reasons: RiskReason[] = [];
  const todayMs = Date.parse(`${today}T12:00:00Z`);
  if (!p.nextCallDate) reasons.push("no_next_call");
  else if (p.nextCallDate < today && !(p.lastCallAt && dayOf(p.lastCallAt) >= p.nextCallDate)) reasons.push("missed_next_call");
  const quiet = p.lastCallAt
    ? todayMs - Date.parse(p.lastCallAt) > QUIET_DAYS * DAY
    : todayMs - Date.parse(p.createdAt) > NEW_GRACE_DAYS * DAY;
  if (quiet) reasons.push("gone_quiet");
  if (p.nextTodo?.due && p.nextTodo.due < today) reasons.push("overdue_todo");
  // The customer cooled over the last call (net sentiment from its timeline, 2026-11-23).
  if (p.sentiment?.last === "cooling") reasons.push("cooled");
  // The rep's own expected close date passed with the deal still open (0320).
  if (p.closeDate && p.closeDate < today) reasons.push("past_close_date");
  const serious = reasons.length;
  if (p.amount === null) reasons.push("no_amount");
  return { level: serious >= 2 ? "at_risk" : serious === 1 ? "watch" : "ok", reasons };
}

export type Forecast = {
  openCount: number;
  openAmount: number;
  closed: number;
  won: number;
  /** won / closed, or null below MIN_CLOSED_FOR_FORECAST closed deals. */
  winRate: number | null;
  /** openAmount × winRate, or null when there is no win rate yet. */
  expected: number | null;
  atRiskCount: number;
  atRiskAmount: number;
  /** What-if: the open value if every at-risk deal is lost. */
  openWithoutAtRisk: number;
  /** Open deals with no amount — not in any total. */
  unpriced: number;
};

export function forecast(prospects: P[], today: string): Forecast {
  const open = prospects.filter((p) => p.status === "open");
  const won = prospects.filter((p) => p.status === "won").length;
  const closed = won + prospects.filter((p) => p.status === "lost").length;
  const openAmount = open.reduce((t, p) => t + (p.amount ?? 0), 0);
  const atRisk = open.filter((p) => dealRisk(p, today).level === "at_risk");
  const atRiskAmount = atRisk.reduce((t, p) => t + (p.amount ?? 0), 0);
  const winRate = closed >= MIN_CLOSED_FOR_FORECAST ? won / closed : null;
  return {
    openCount: open.length,
    openAmount,
    closed,
    won,
    winRate,
    expected: winRate === null ? null : openAmount * winRate,
    atRiskCount: atRisk.length,
    atRiskAmount,
    openWithoutAtRisk: openAmount - atRiskAmount,
    unpriced: open.filter((p) => p.amount === null).length,
  };
}

/**
 * The open pipeline by the month the rep expects each deal to close (0320). Deals whose expected date has passed are
 * "past due", not quietly moved; deals with no date are counted apart. Expected value uses the same pipeline win rate as
 * forecast() and is null below MIN_CLOSED_FOR_FORECAST closed deals (§3.4).
 */
export type MonthRow = { month: string; count: number; amount: number; unpriced: number; expected: number | null };
export function forecastByMonth(prospects: P[], today: string): { pastDue: MonthRow; months: MonthRow[]; undated: { count: number; amount: number } } {
  const winRate = forecast(prospects, today).winRate;
  const row = (month: string): MonthRow => ({ month, count: 0, amount: 0, unpriced: 0, expected: winRate === null ? null : 0 });
  const add = (r: MonthRow, p: P) => {
    r.count++;
    if (p.amount === null) r.unpriced++;
    else {
      r.amount += p.amount;
      if (r.expected !== null && winRate !== null) r.expected += p.amount * winRate;
    }
  };
  const pastDue = row("past_due");
  const byMonth = new Map<string, MonthRow>();
  const undated = { count: 0, amount: 0 };
  for (const p of prospects) {
    if (p.status !== "open") continue;
    if (!p.closeDate) {
      undated.count++;
      undated.amount += p.amount ?? 0;
    } else if (p.closeDate < today) add(pastDue, p);
    else {
      const m = p.closeDate.slice(0, 7);
      const r = byMonth.get(m) ?? row(m);
      add(r, p);
      byMonth.set(m, r);
    }
  }
  return { pastDue, months: [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)), undated };
}

/** forecastByMonth's months summed into calendar quarters ("2026-Q4"); past due stays apart. Expected stays null when
 *  the months' is (below MIN_CLOSED_FOR_FORECAST closed deals). */
export function byQuarter(months: MonthRow[]): MonthRow[] {
  const q = new Map<string, MonthRow>();
  for (const m of months) {
    const [y, mm] = m.month.split("-");
    const key = `${y}-Q${Math.floor((Number(mm) - 1) / 3) + 1}`;
    const r = q.get(key) ?? { month: key, count: 0, amount: 0, unpriced: 0, expected: m.expected === null ? null : 0 };
    r.count += m.count;
    r.amount += m.amount;
    r.unpriced += m.unpriced;
    if (r.expected !== null && m.expected !== null) r.expected += m.expected;
    q.set(key, r);
  }
  return [...q.values()].sort((a, b) => a.month.localeCompare(b.month));
}
