/**
 * The forecast board (revenue Phase 6, 0376; Gong M22). By quarter. Per person: two submitted columns (Commit, Best
 * case), two computed ones (Closed won in the quarter, Open pipeline expected to close in it), and a target. Every
 * submission is kept, so each earlier one is the snapshot Gong takes weekly: accuracy is the forecast standing at a
 * moment ÷ what actually closed by the quarter's end, coloured as Gong's (green 85–115%). Pure, so it is tested.
 */
export type Category = "commit" | "best_case";
export type Submission = { userId: string; period: string; category: Category; amount: number; note: string | null; createdAt: string };
export type FDeal = { repId: string; status: "open" | "won" | "lost"; amount: number | null; closeDate?: string | null; closedAt?: string | null };

/** The quarter a date falls in, 'YYYY-Qn' (UTC calendar quarters). */
export function periodOf(isoDate: string): string {
  const y = Number(isoDate.slice(0, 4));
  const m = Number(isoDate.slice(5, 7));
  return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
}

/** First and last day of a quarter, YYYY-MM-DD. */
export function periodRange(period: string): { start: string; end: string } {
  const [y, q] = [Number(period.slice(0, 4)), Number(period.slice(6))];
  const startM = (q - 1) * 3 + 1;
  const end = new Date(Date.UTC(y, startM + 2, 0)); // day 0 of the next month = last day of this quarter
  return { start: `${y}-${String(startM).padStart(2, "0")}-01`, end: end.toISOString().slice(0, 10) };
}

export function shiftPeriod(period: string, by: number): string {
  const y = Number(period.slice(0, 4));
  const q = Number(period.slice(6)) - 1 + by;
  return `${y + Math.floor(q / 4)}-Q${((q % 4) + 4) % 4 + 1}`;
}

const inPeriod = (d: string | null | undefined, r: { start: string; end: string }) => !!d && d.slice(0, 10) >= r.start && d.slice(0, 10) <= r.end;

/** The computed columns for one person (or, with repId omitted, everyone in `deals`). */
export function metrics(deals: FDeal[], period: string, repId?: string) {
  const r = periodRange(period);
  const mine = repId ? deals.filter((d) => d.repId === repId) : deals;
  const won = mine.filter((d) => d.status === "won" && inPeriod(d.closedAt, r));
  const open = mine.filter((d) => d.status === "open" && inPeriod(d.closeDate, r));
  const sum = (xs: FDeal[]) => xs.reduce((s, d) => s + (d.amount ?? 0), 0);
  return {
    closedWon: sum(won), closedWonCount: won.length,
    openClosing: sum(open), openClosingCount: open.length, openUnpriced: open.filter((d) => d.amount === null).length,
  };
}

/** A person's current number in a column: their latest submission for the quarter (null = not submitted). */
export function latest(subs: Submission[], userId: string, period: string, category: Category): Submission | null {
  let best: Submission | null = null;
  for (const s of subs) if (s.userId === userId && s.period === period && s.category === category && (!best || s.createdAt > best.createdAt)) best = s;
  return best;
}

/** A team's number: the sum of its people's latest submissions, and how many of them have submitted. */
export function rollUp(subs: Submission[], userIds: string[], period: string, category: Category): { amount: number; submitted: number; of: number } {
  let amount = 0;
  let submitted = 0;
  for (const u of userIds) {
    const s = latest(subs, u, period, category);
    if (s) {
      amount += s.amount;
      submitted += 1;
    }
  }
  return { amount, submitted, of: userIds.length };
}

export type Accuracy = { ratio: number; band: "green" | "pink" | "red" } | null;
/** Gong's colours: green 85–115%, pink 70–84% or 116–130%, red outside. Null when nothing closed (no ratio to take). */
export function accuracyBand(forecast: number, actual: number): Accuracy {
  if (!(actual > 0)) return null;
  const ratio = forecast / actual;
  const pct = ratio * 100;
  const band = pct >= 85 && pct <= 115 ? "green" : (pct >= 70 && pct < 85) || (pct > 115 && pct <= 130) ? "pink" : "red";
  return { ratio, band };
}

/**
 * Accuracy for a finished quarter: the Commit standing at each of a few moments (the snapshot), ÷ what closed won. The
 * moments are the quarter's weeks; a week with no submission yet is left out (nothing was forecast then).
 */
export function accuracyOverQuarter(subs: Submission[], userId: string, period: string, closedWon: number): Array<{ asOf: string; forecast: number; accuracy: Accuracy }> {
  const r = periodRange(period);
  const out: Array<{ asOf: string; forecast: number; accuracy: Accuracy }> = [];
  for (let t = Date.parse(`${r.start}T23:59:59Z`) + 6 * 86_400_000; t <= Date.parse(`${r.end}T23:59:59Z`) + 86_400_000; t += 7 * 86_400_000) {
    const asOf = new Date(t).toISOString();
    const standing = subs.filter((s) => s.userId === userId && s.period === period && s.category === "commit" && s.createdAt <= asOf).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (standing) out.push({ asOf: asOf.slice(0, 10), forecast: standing.amount, accuracy: accuracyBand(standing.amount, closedWon) });
  }
  return out;
}
