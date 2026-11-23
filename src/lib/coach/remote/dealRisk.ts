/**
 * Deal risk and a simple forecast for the Remote Sales pipeline (2026-11-23; gong.io capture M36 "Forecast risk scoring
 * and scenario planning", graded LACK: "Pipeline totals only; no sales forecast, risk score or what-if").
 *
 * Deliberately NOT a model. Each flag is a fact the rep can check and fix — no next call booked, a booked call that
 * passed with no call held, a long silence, an overdue to-do, no amount. The forecast multiplies the open value by
 * THIS pipeline's own closed-deal win rate, and refuses to give a number until enough deals have closed (§3.4: no
 * day-one behavior claiming understanding it cannot have). Pure, so every rule is tested.
 */

export type RiskReason = "no_next_call" | "missed_next_call" | "gone_quiet" | "overdue_todo" | "cooled" | "no_amount";
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
  no_amount: "No deal amount",
};

type P = {
  id: string;
  name: string | null;
  status: "open" | "won" | "lost";
  amount: number | null;
  nextCallDate: string | null;
  lastCallAt: string | null;
  createdAt: string;
  nextTodo: { due: string | null } | null;
  /** dealSentiment.ts — the last call's net customer sentiment, when read. */
  sentiment?: { last: "warming" | "cooling" | "flat" } | null;
};

const DAY = 86_400_000;
const dayOf = (iso: string) => iso.slice(0, 10);

/** Why an OPEN deal may slip, and how much: two or more of the first five reasons = at risk; one = watch. A missing
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
