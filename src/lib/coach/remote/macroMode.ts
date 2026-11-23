/**
 * Remote Sales Macro Mode (docs/rss/MACRO-MODE-SPEC.md, 0303) — the pure parts of the follow-up draft and the daily
 * brain dump, kept apart from the routes so their guards are tested without a model or a database.
 *
 * FOLLOW-UP DRAFT: an email or a text the rep edits and sends themselves. Nothing is sent from here (§3.3 — the rep
 * stays the author). The draft is built from the call and its stored brief, never from a template.
 *
 * DAY PLAN: "Hello <name>, what is our to-do list for the day?" The rep writes their day; the model only ORGANIZES it
 * (times, order, the two needle movers). It may not add work the rep did not write: an item sharing no word with the
 * brain dump is dropped, and the needle movers must come from the items.
 */

export const FOLLOWUP_SYSTEM = `You write a follow-up message from a sales rep to the prospect they just spoke with, as JSON only.

Return exactly: {"subject": ..., "body": ...}
- channel "email": a short subject line and a body of 60-160 words: thank them, restate what was agreed (the next
  steps given), and propose the next contact. Sign off with the rep's first name only if it is given.
- channel "text": subject null and a body under 300 characters, friendly and direct.
Use only facts from the transcript and the next steps given. Never promise a price, discount or date that was not said.
Plain words, no placeholders like [Name] — if a name is unknown, write around it.`;

export type FollowUpDraft = { subject: string | null; body: string };

export function parseFollowUp(raw: string, channel: "email" | "text"): FollowUpDraft | null {
  let j: unknown;
  try {
    j = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return null;
  }
  if (!j || typeof j !== "object") return null;
  const o = j as { subject?: unknown; body?: unknown };
  const body = typeof o.body === "string" ? o.body.trim() : "";
  if (!body) return null;
  // A leftover template slot means the model guessed at a fact it did not have; refuse rather than send it to a rep.
  if (/\[(name|company|date|price|first name|your name)\]/i.test(body)) return null;
  if (channel === "text") return { subject: null, body: body.slice(0, 480) };
  const subject = typeof o.subject === "string" && o.subject.trim() ? o.subject.trim().slice(0, 140) : null;
  return { subject, body: body.slice(0, 4000) };
}

export const DAY_PLAN_SYSTEM = `A sales rep is planning their day. They wrote what is on it in their own words. Organize it, as JSON only.

Return exactly: {"items": [{"time": ..., "what": ...}], "needle_movers": [..., ...]}
- items: every task, meeting or follow-up they wrote, in time order; "time" is "HH:MM" (24-hour) if they gave one, else
  null; "what" is the item in their words, under 15 words. Do NOT add anything they did not write.
- needle_movers: the TWO items that would move their sales forward most today, copied exactly from items[].what. If
  they named their own, use theirs.`;

export type DayPlan = { items: Array<{ time: string | null; what: string }>; needleMovers: string[] };

const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3),
  );

/** Validate the organized plan against what the rep actually wrote. Pure. */
export function parseDayPlan(raw: string, dump: string): DayPlan | null {
  let j: unknown;
  try {
    j = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return null;
  }
  if (!j || typeof j !== "object") return null;
  const said = words(dump);
  const o = j as { items?: unknown; needle_movers?: unknown };
  const items = (Array.isArray(o.items) ? o.items : [])
    .slice(0, 15)
    .flatMap((x) => {
      if (!x || typeof x !== "object") return [];
      const what = typeof (x as { what?: unknown }).what === "string" ? (x as { what: string }).what.trim().slice(0, 140) : "";
      if (!what) return [];
      // Organize, never add: an item with no word from the brain dump was invented.
      if (![...words(what)].some((w) => said.has(w))) return [];
      const t = (x as { time?: unknown }).time;
      const time = typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : null;
      return [{ time, what }];
    })
    .sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
  const listed = new Set(items.map((i) => i.what));
  const needleMovers = (Array.isArray(o.needle_movers) ? o.needle_movers : [])
    .filter((n): n is string => typeof n === "string" && listed.has(n.trim()))
    .map((n) => n.trim())
    .slice(0, 2);
  return { items, needleMovers };
}

/** Yesterday, in numbers the rep can trust: computed from the record, never written by a model. */
export type Yesterday = { calls: number; scored: number; averageScore: number | null; outcomes: Record<string, number> };

export function summariseYesterday(
  calls: Array<{ outcome: string | null }>,
  scores: Array<{ total: number | null }>,
): Yesterday {
  const outcomes: Record<string, number> = {};
  for (const c of calls) if (c.outcome) outcomes[c.outcome] = (outcomes[c.outcome] ?? 0) + 1;
  // A missing score is not a zero: Number(null) is 0, so nulls are dropped BEFORE converting.
  const vals = scores.filter((s) => s.total !== null && s.total !== undefined).map((s) => Number(s.total)).filter((n) => Number.isFinite(n));
  return {
    calls: calls.length,
    scored: vals.length,
    averageScore: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null,
    outcomes,
  };
}

/** The pipeline's three top tabs: Open (with its total), Closed Won, Closed Lost. */
export type ProspectStatus = "open" | "won" | "lost";
export function pipelineTotals(rows: Array<{ status: string; amount: number | string | null }>) {
  const t = { open: { count: 0, amount: 0 }, won: { count: 0, amount: 0 }, lost: { count: 0, amount: 0 } };
  for (const r of rows) {
    const k = (r.status === "won" || r.status === "lost" ? r.status : "open") as ProspectStatus;
    t[k].count += 1;
    const a = Number(r.amount);
    if (Number.isFinite(a)) t[k].amount += a;
  }
  return t;
}

/** The stored value for each kind — the shapes 0303's CHECKs and remote_prospects_current read. Null = refused. */
export type ProspectFact = "name" | "organization" | "stage" | "amount" | "next_call" | "source";
export function eventValue(kind: ProspectFact, value: unknown): Record<string, unknown> | null {
  if (kind === "name" || kind === "organization") return typeof value === "string" && value.trim() ? { text: value.trim() } : null;
  // Lead source (0313): 1-60 characters, like a stage name.
  if (kind === "source") return typeof value === "string" && value.trim() && value.trim().length <= 60 ? { text: value.trim() } : null;
  if (kind === "amount") return typeof value === "number" && value >= 0 ? { amount: value } : null;
  if (kind === "next_call") {
    if (value === null) return { date: null };
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? { date: value } : null;
  }
  if (value && typeof value === "object") {
    const v = value as { status?: unknown; label?: unknown };
    if (v.status !== "open" && v.status !== "won" && v.status !== "lost") return null;
    return typeof v.label === "string" && v.label.trim() ? { status: v.status, label: v.label.trim().slice(0, 60) } : { status: v.status };
  }
  return null;
}


/**
 * The steps that take a task to Completed, walked on the Tasks module's OWN transition graph (TASK_STATUS_TRANSITIONS
 * — the single source; "To Do" cannot jump straight to "Completed"). A pipeline to-do's "Done" sends each step through
 * PATCH /api/tasks, so the server's check and the task's event trail see a normal, legal sequence. Empty = already
 * closed or no route.
 */
export function stepsToCompleted(status: string, graph: Record<string, string[]>): string[] {
  if (status === "Completed") return [];
  const prev = new Map<string, string>();
  const queue = [status];
  const seen = new Set([status]);
  while (queue.length) {
    const s = queue.shift()!;
    for (const n of graph[s] ?? []) {
      if (seen.has(n)) continue;
      seen.add(n);
      prev.set(n, s);
      if (n === "Completed") {
        const path = ["Completed"];
        let c = s;
        while (c !== status) {
          path.unshift(c);
          c = prev.get(c)!;
        }
        return path;
      }
      queue.push(n);
    }
  }
  return [];
}

/**
 * The rep's calendar day as [start, end) ISO instants (Macro Mode → Today, /api/coach/remote/day). `offsetMin` is the
 * browser's Date.getTimezoneOffset(): minutes BEHIND UTC (Los Angeles +480, Manila −480), so local midnight is UTC
 * midnight PLUS the offset. Moved here from the route (2026-11-23) so it is tested. One known edge: on a daylight-saving
 * change day the day is 23 or 25 hours and this uses that morning's offset for both ends.
 */
export function dayBounds(day: string, offsetMin: number): [string, string] {
  const start = Date.parse(`${day}T00:00:00Z`) + offsetMin * 60_000;
  return [new Date(start).toISOString(), new Date(start + 86_400_000).toISOString()];
}

/** The calendar day before `day` (YYYY-MM-DD). Noon-based so no offset can move it across a date. */
export const prevDay = (day: string): string => new Date(Date.parse(`${day}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

/** A browser time-zone offset from a query string: a whole number within ±14 h (840 min), else 0 (UTC). */
export function clampOffset(raw: string | null): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= -840 && n <= 840 ? n : 0;
}
