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
/** `seconds` (calls only): the call's length from conversationDurationSeconds; null = unknown, never guessed. */
export type UsageEvent = { personId: string; kind: UsageKind; at: string; seconds?: number | null };
export type Counts = Record<UsageKind, number>;
/**
 * Time on calls in a window (2026-11-25, ledger F10.7 "Activity stats"): total seconds over the calls whose length is
 * known, and how many those were — the average is seconds ÷ timed, and calls without a known length are said, not
 * averaged in as zero (§3.4).
 */
export type CallTime = { seconds: number; timed: number };
export type PersonUsage = { id: string; name: string; last7: Counts; last30: Counts; lastActive: string | null; time7: CallTime; time30: CallTime };

const zero = (): Counts => ({ signIns: 0, calls: 0, questions: 0, practice: 0, pipeline: 0 });
const DAY = 86_400_000;

export function buildUsage(members: Array<{ id: string; name: string }>, events: UsageEvent[], nowMs: number) {
  const people = new Map<string, PersonUsage>(
    members.map((m) => [m.id, { id: m.id, name: m.name, last7: zero(), last30: zero(), lastActive: null, time7: { seconds: 0, timed: 0 }, time30: { seconds: 0, timed: 0 } }]),
  );
  for (const e of events) {
    const p = people.get(e.personId);
    const t = Date.parse(e.at);
    if (!p || !Number.isFinite(t) || t > nowMs || t < nowMs - 30 * DAY) continue;
    p.last30[e.kind] += 1;
    const timed = e.kind === "calls" && typeof e.seconds === "number" && Number.isFinite(e.seconds) && e.seconds > 0;
    if (timed) {
      p.time30.seconds += e.seconds!;
      p.time30.timed += 1;
    }
    if (t >= nowMs - 7 * DAY) {
      p.last7[e.kind] += 1;
      if (timed) {
        p.time7.seconds += e.seconds!;
        p.time7.timed += 1;
      }
    }
    if (!p.lastActive || e.at > p.lastActive) p.lastActive = e.at;
  }
  const rows = [...people.values()].sort((a, b) => a.name.localeCompare(b.name));
  const active = (k: "last7" | "last30") => rows.filter((r) => USAGE_KINDS.some((u) => r[k][u] > 0)).length;
  const totals = (k: "last7" | "last30") => USAGE_KINDS.reduce((acc, u) => ({ ...acc, [u]: rows.reduce((t, r) => t + r[k][u], 0) }), zero());
  return { rows, active7: active("last7"), active30: active("last30"), people: rows.length, totals7: totals("last7"), totals30: totals("last30") };
}

/**
 * One sign-in, recorded twice (0327): the web password form logs it in login_attempts and Supabase opens a session for
 * it. A password record and a session record for the same person within SAME_SIGN_IN_MS are one sign-in; a session with
 * no password record (Google, Microsoft, the mobile app) is its own; a password record whose session was later removed
 * (signed out) still counts. Pure, so the rule is tested.
 */
export const SAME_SIGN_IN_MS = 2 * 60_000;
export function mergeSignIns(rows: Array<{ userId: string; at: string; source: "session" | "password" | string }>): Array<{ personId: string; at: string }> {
  const out: Array<{ personId: string; at: string }> = [];
  const byPerson = new Map<string, typeof rows>();
  for (const r of rows) byPerson.set(r.userId, [...(byPerson.get(r.userId) ?? []), r]);
  for (const [personId, list] of byPerson) {
    const sessions = list.filter((r) => r.source === "session").map((r) => Date.parse(r.at)).sort((a, b) => a - b);
    const used = new Set<number>();
    for (const p of list.filter((r) => r.source === "password").sort((a, b) => a.at.localeCompare(b.at))) {
      const t = Date.parse(p.at);
      const match = sessions.findIndex((s, i) => !used.has(i) && Math.abs(s - t) <= SAME_SIGN_IN_MS);
      if (match >= 0) used.add(match);
      out.push({ personId, at: p.at });
    }
    sessions.forEach((s, i) => {
      if (!used.has(i)) out.push({ personId, at: new Date(s).toISOString() });
    });
  }
  return out;
}
