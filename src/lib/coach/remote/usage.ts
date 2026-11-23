/**
 * Team usage (2026-11-23; gong.io capture M36 "Platform adoption analytics", graded PARTIAL: "Sessions and last-active
 * per rep; no logins, active users or feature-use events"). Built ONLY from records the product already keeps — no new
 * tracking: successful sign-ins (login_attempts), calls (coaching_sessions), Ask Coach questions (ask_coach_turns,
 * role 'user'), practice attempts (training_attempts) and pipeline updates (remote_prospect_events). Pure, so tested.
 *
 * "Active" means did at least one of these in the window. This is how much the product is used, not a ranking of
 * people (§A18 in the team-activity route's words): rows are shown alphabetically, never sorted by count.
 */
export const USAGE_KINDS = ["signIns", "calls", "questions", "practice", "pipeline"] as const;
export type UsageKind = (typeof USAGE_KINDS)[number];
export type UsageEvent = { personId: string; kind: UsageKind; at: string };
export type Counts = Record<UsageKind, number>;
export type PersonUsage = { id: string; name: string; last7: Counts; last30: Counts; lastActive: string | null };

const zero = (): Counts => ({ signIns: 0, calls: 0, questions: 0, practice: 0, pipeline: 0 });
const DAY = 86_400_000;

export function buildUsage(members: Array<{ id: string; name: string }>, events: UsageEvent[], nowMs: number) {
  const people = new Map<string, PersonUsage>(members.map((m) => [m.id, { id: m.id, name: m.name, last7: zero(), last30: zero(), lastActive: null }]));
  for (const e of events) {
    const p = people.get(e.personId);
    const t = Date.parse(e.at);
    if (!p || !Number.isFinite(t) || t > nowMs || t < nowMs - 30 * DAY) continue;
    p.last30[e.kind] += 1;
    if (t >= nowMs - 7 * DAY) p.last7[e.kind] += 1;
    if (!p.lastActive || e.at > p.lastActive) p.lastActive = e.at;
  }
  const rows = [...people.values()].sort((a, b) => a.name.localeCompare(b.name));
  const active = (k: "last7" | "last30") => rows.filter((r) => USAGE_KINDS.some((u) => r[k][u] > 0)).length;
  const totals = (k: "last7" | "last30") => USAGE_KINDS.reduce((acc, u) => ({ ...acc, [u]: rows.reduce((t, r) => t + r[k][u], 0) }), zero());
  return { rows, active7: active("last7"), active30: active("last30"), people: rows.length, totals7: totals("last7"), totals30: totals("last30") };
}
