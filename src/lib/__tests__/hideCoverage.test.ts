import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A HIDDEN CALL IS HIDDEN EVERYWHERE IT HAS ROWS (0337/0339/0341, Gong ledger F33.8).
 *
 * A company phrase hides a call from all but its rep and admins through a restrictive SELECT rule (`rss_not_hidden`)
 * on each table that holds the call's rows. 0337 covered the call and its words; a signed-in replay then showed its
 * comments, tracker hits, stats and library items still readable (0339), and its AI reads in `events` (0341). So a
 * new table keyed to a call must either carry the rule or be listed below with why it may stay visible. Reads every
 * migration: a table with `session_id uuid … references coaching_sessions`, or `pitch_id uuid … references
 * pitch_scores`, that has a text or jsonb column.
 */
const MAY_STAY_VISIBLE: Record<string, string> = {
  call_hides: "the hide record itself — the call page reads it to say why a call is hidden",
  call_access_grants: "0336: who was given access and the admin's reason; the granted view refuses a hidden call (hiddenFrom)",
  feedback_requests: "the rep's own request; lists that show it (coaching inbox, metrics) drop hidden calls via hiddenFrom",
  agent_point_ledger: "points — no call words; like the facts legal erasure keeps (§3.1.1)",
  gamification_calibration: "a manager's own blind scores — no call words; the pool and submit refuse hidden calls",
  session_failures: "processing reason codes for operators — no call words",
  ai_usage: "token counts and model names — no call words",
  coaching_retranscribe_cache: "service-role cache, no authenticated read policy",
  training_scenarios: "a scenario drafted from a call with personal details stripped; it stands on its own",
};

const DIR = join(process.cwd(), "supabase/migrations");
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const sql = files.map((f) => readFileSync(join(DIR, f), "utf8"));
const all = sql.join("\n");

function callTables(): string[] {
  const out = new Set<string>();
  for (const s of sql) {
    const re = /create table if not exists (?:public\.)?([a-z_]+)\s*\(([\s\S]*?)\n\);/g;
    for (const m of s.matchAll(re)) {
      const [, name, body] = m;
      const keyed =
        /session_id\s+uuid[^,\n]*references\s+(?:public\.)?coaching_sessions/.test(body!) ||
        /pitch_id\s+uuid[^,\n]*references\s+(?:public\.)?pitch_scores/.test(body!);
      const hasText = /\n\s+[a-z_]+\s+(text|jsonb)\b/.test(body!);
      if (keyed && hasText) out.add(name!);
    }
  }
  return [...out].sort();
}
const guarded = (t: string) => new RegExp(`create policy rss_not_hidden on public\\.${t}\\b`).test(all);

describe("a hidden call is hidden in every table that holds its rows", () => {
  it("finds the tables it is meant to judge", () => {
    expect(callTables()).toEqual(expect.arrayContaining(["remote_call_briefs", "tracker_hits", "recording_comments", "call_notes"]));
  });
  it("each carries the rss_not_hidden rule (plain SQL the audit can read), or is listed with why it may stay visible", () => {
    const missing = callTables().filter((t) => !guarded(t) && !(t in MAY_STAY_VISIBLE));
    expect(missing).toEqual([]);
  });
  it("the call row, its transcript and its AI reads in events are guarded", () => {
    for (const t of ["coaching_sessions", "coaching_transcript_segments", "events"]) expect(guarded(t), t).toBe(true);
  });
  it("no listed exception is guarded already, or names a table the check doesn't judge (a stale list hides a decision)", () => {
    expect(Object.keys(MAY_STAY_VISIBLE).filter(guarded)).toEqual([]);
    const judged = new Set(callTables());
    expect(Object.keys(MAY_STAY_VISIBLE).filter((t) => !judged.has(t))).toEqual([]);
  });
});

describe("a call's AI reads follow the call's access (0348, founder picker 2026-11-26)", () => {
  it("events about a call or a score are readable only through the call's / score's own read rule", () => {
    const last = [...all.matchAll(/create policy rss_call_events_follow_call on public\.events[\s\S]*?;/g)].pop()?.[0] ?? "";
    expect(last).toMatch(/as restrictive for select/);
    expect(last).toMatch(/subject in \(select 'sales_session:' \|\| s\.id::text from public\.coaching_sessions s\)/);
    expect(last).toMatch(/subject in \(select 'pitch:' \|\| p\.id::text from public\.pitch_scores p\)/);
    // dropped later without being recreated?
    const dropAt = all.lastIndexOf("drop policy if exists rss_call_events_follow_call on public.events");
    expect(all.lastIndexOf("create policy rss_call_events_follow_call on public.events")).toBeGreaterThan(dropAt);
  });
});
