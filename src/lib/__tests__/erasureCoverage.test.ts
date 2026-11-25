import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * LEGAL ERASURE REACHES EVERY TABLE THAT HOLDS A CALL'S WORDS (CLAUDE.md §3.1.1; 2026-11-23).
 *
 * rss_erase_sessions (0285) covered the tables of its day. Macro Mode (0303) added call briefs, checklist reviews and
 * follow-up drafts keyed to a call, and erasing a customer left their words there until 0316. This reads every
 * migration: a table keyed to a call (session_id → coaching_sessions, or a column referencing one of those tables)
 * that has a text or jsonb column must either appear in the LATEST rss_erase_sessions body or be listed below with
 * why it holds no customer words.
 */
const NO_CUSTOMER_WORDS: Record<string, string> = {
  coaching_sessions: "the call row itself — erasure blanks its client_label/territory/approach/offer and keeps the facts",
  pitch_scores: "blanked by rss_erase_sessions (transcript, audio_url) — it is in the body via pitch_ids",
  pitch_score_elements: "blanked by rss_erase_sessions (evidence)",
  pitch_score_events: "blanked by rss_erase_sessions (evidence)",
  transcript_line_edits: "0311: line numbers, versions and editor only — no words",
  recording_trims: "times only",
  call_hides: "0337: which company phrase hid the call — the admin's own rule text, copied at hide time so the record says why; no transcript words are stored (the match is computed, not quoted)",
  call_access_grants: "0336: who was given access and the admin's own reason — a person's retyped note, the stated 0285 exclusion (like comments); the call's words stay in the erased tables the shared view reads",
  remote_prospect_calls: "a link between ids",
  agent_point_ledger: "reason enum and a score snapshot (bands, points) — no words",
  ai_usage: "engine, provider, model and token counts — no words",
  gamification_calibration: "score numbers — no words",
  session_failures: "technical failure code and error detail — no call words",
  training_scenarios: "retired by rss_erase_sessions since 0317 (founder: 'Retire them'); it appears in the body, this entry only documents why the text itself stays",
};

const DIR = join(process.cwd(), "supabase/migrations");
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const sql = files.map((f) => readFileSync(join(DIR, f), "utf8"));

function latestEraseBody(): string {
  let body = "";
  for (const s of sql) {
    const i = s.indexOf("create or replace function public.rss_erase_sessions");
    if (i >= 0) body = s.slice(i, s.indexOf("$$;", i));
  }
  return body;
}

function callTables(): Array<{ name: string; file: string }> {
  const out: Array<{ name: string; file: string }> = [];
  files.forEach((f, idx) => {
    const re = /create table if not exists (?:public\.)?([a-z_]+)\s*\(([\s\S]*?)\n\);/g;
    for (const m of sql[idx]!.matchAll(re)) {
      const [, name, body] = m;
      const keyedToCall = /session_id\s+uuid[^,\n]*references\s+(?:public\.)?coaching_sessions/.test(body!);
      const hasText = /\n\s+[a-z_]+\s+(text|jsonb)\b/.test(body!);
      if (keyedToCall && hasText) out.push({ name: name!, file: f });
    }
  });
  return out;
}

describe("legal erasure covers every call-keyed table with text", () => {
  it("finds the tables it is meant to judge", () => {
    const names = callTables().map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["coaching_transcript_segments", "remote_call_briefs", "remote_followup_drafts", "call_notes"]));
  });
  it("each is erased by the latest rss_erase_sessions, or listed with why it holds no customer words", () => {
    const body = latestEraseBody();
    expect(body.length).toBeGreaterThan(1000);
    const missing = callTables().filter((t) => !new RegExp(`\\b${t.name}\\b`).test(body) && !(t.name in NO_CUSTOMER_WORDS));
    expect(missing).toEqual([]);
  });
});
