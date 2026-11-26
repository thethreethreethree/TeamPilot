/**
 * Deal risk and a simple forecast for the Remote Sales pipeline (2026-11-23; gong.io capture M36 "Forecast risk scoring
 * and scenario planning", graded LACK: "Pipeline totals only; no sales forecast, risk score or what-if").
 *
 * Deliberately NOT a model. Each flag is a fact the rep can check and fix — no next call booked, a booked call that
 * passed with no call held, a long silence, an overdue to-do, no amount. The forecast multiplies the open value by
 * THIS pipeline's own closed-deal win rate, and refuses to give a number until enough deals have closed (§3.4: no
 * day-one behavior claiming understanding it cannot have). Pure, so every rule is tested.
 */

export type RiskReason =
  | "no_next_call" | "missed_next_call" | "gone_quiet" | "overdue_todo" | "cooled" | "past_close_date"
  // Revenue Phase 3a (0372; Gong F20.5): raised only when the fact behind it was read (rss_deal_signals) — an absent
  // fact never raises a warning.
  | "ghosted" | "few_contacts" | "no_power" | "no_pricing" | "stalled"
  | "no_amount";
export type RiskLevel = "at_risk" | "watch" | "ok";

export const QUIET_DAYS = 21;
/** A prospect with no call at all is "quiet" once it has been in the pipeline this long. */
export const NEW_GRACE_DAYS = 14;
/** Closed deals needed before the pipeline's own win rate is used for a forecast. */
export const MIN_CLOSED_FOR_FORECAST = 5;
/** Gong F20.5 defaults (docs/ELOSTATE-REVENUE-BUILD-PLAN/docs/04-REVENUE-RULES.md; plan R4). */
export const GHOSTED_DAYS = 7; // calls kept happening, but the customer hasn't spoken on one in this long
export const MIN_CONTACTS = 2; // fewer people than this on a deal ...
export const FEW_CONTACTS_AFTER_DAYS = 14; // ... once it has been open this long
export const CLOSE_WINDOW_DAYS = 30; // "no power" and "no pricing" look at deals closing within this many days

export const RISK_WORDS: Record<RiskReason, string> = {
  no_next_call: "No next call booked",
  missed_next_call: "Booked call date passed, no call since",
  gone_quiet: `No call in ${QUIET_DAYS}+ days`,
  overdue_todo: "Overdue to-do",
  cooled: "Customer cooled on the last call",
  past_close_date: "Expected close date passed",
  ghosted: `Customer hasn't spoken on a call in ${GHOSTED_DAYS}+ days`,
  few_contacts: `Fewer than ${MIN_CONTACTS} contacts on the deal`,
  no_power: "No director, VP or C-level contact active near close",
  no_pricing: "Price hasn't come up and close is near",
  stalled: "Longer in this stage than its limit",
  no_amount: "No deal amount",
};

/** What to do about each warning (the deal panel's Warnings tab; Gong F20.5 pairs each warning with a mitigation). */
export const RISK_FIX: Record<RiskReason, string> = {
  no_next_call: "Book the next call while you still have them: a deal with no date drifts.",
  missed_next_call: "Call today, or move the date to when you'll really call.",
  gone_quiet: "Reach out with something new for them: a question, a resource or a proposed date.",
  overdue_todo: "Do it or give it a new date: an overdue promise costs trust.",
  cooled: "Open the last call, find where it turned, and start the next one there.",
  past_close_date: "Ask the customer what changed, then set a close date you both believe.",
  ghosted: "Try another contact on the account, or another way to reach them.",
  few_contacts: "Ask your contact who else is involved, and bring them to the next call.",
  no_power: "Ask who signs off, and get them on a call before the close date.",
  no_pricing: "Bring up price on the next call, so it doesn't surprise anyone at close.",
  stalled: "Agree the step that moves it to the next stage, with a date.",
  no_amount: "Add the amount so the forecast counts this deal.",
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
  /** rss_deal_signals (0372). Undefined = not read; each reason below needs its fact. */
  signals?: {
    lastTwoWayAt: string | null;
    pricingMentioned: boolean;
    stageEnteredAt: string | null;
    contacts: Array<{ rank: "c_level" | "vp" | "director" | "manager" | "individual" | "unknown"; lastOnCall: string | null }>;
  };
  /** The company's limit for the deal's current stage (0372 stall_days), when it has one. */
  stallDays?: number | null;
  /** Calls linked to the deal (ghosted needs at least one). */
  callCount?: number;
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
  // Revenue Phase 3a (Gong F20.5), from rss_deal_signals.
  const sig = p.signals;
  if (sig) {
    const daysSince = (iso: string) => (todayMs - Date.parse(iso)) / DAY;
    // Never spoken on any call: measured from when the deal began (it isn't ghosting on day 0, but a month of calls
    // the customer never spoke on is).
    if ((p.callCount ?? 0) > 0 && daysSince(sig.lastTwoWayAt ?? p.createdAt) > GHOSTED_DAYS) reasons.push("ghosted");
    if (daysSince(p.createdAt) > FEW_CONTACTS_AFTER_DAYS && sig.contacts.length < MIN_CONTACTS) reasons.push("few_contacts");
    const closeIn = p.closeDate ? (Date.parse(`${p.closeDate}T12:00:00Z`) - todayMs) / DAY : null;
    if (closeIn !== null && closeIn >= 0 && closeIn <= CLOSE_WINDOW_DAYS) {
      // Gong: no Director/VP/C-level active in the window, and at least 75% of the contacts with a known title rank
      // below. Contacts with no known title can't fire it.
      const power = ["c_level", "vp", "director"];
      const known = sig.contacts.filter((c) => c.rank !== "unknown");
      const activePower = sig.contacts.some((c) => power.includes(c.rank) && c.lastOnCall && daysSince(c.lastOnCall) <= CLOSE_WINDOW_DAYS);
      if (!activePower && known.length > 0 && known.filter((c) => !power.includes(c.rank)).length / known.length >= 0.75) reasons.push("no_power");
      if (!sig.pricingMentioned) reasons.push("no_pricing");
    }
    if (p.stallDays && sig.stageEnteredAt && daysSince(sig.stageEnteredAt) > p.stallDays) reasons.push("stalled");
  }
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

/** What-if (2026-11-23): the same deals with some expected close dates moved ON SCREEN ONLY ("" clears one). Nothing
 *  is saved; the forecast is recomputed from the copy. */
export function withMovedDates<T extends { id: string; closeDate?: string | null }>(prospects: T[], moved: Record<string, string>): T[] {
  return prospects.map((p) => (p.id in moved ? { ...p, closeDate: moved[p.id] || null } : p));
}
