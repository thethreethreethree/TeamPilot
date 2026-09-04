import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Coach v5 — Cross-Conversation Memory
 *
 * Builds a compact "pattern history" snapshot the Coach injects into
 * its system prompt so the LLM can:
 *   1. Recognize recurring coaching patterns on this user (§1.1
 *      data-as-asset across conversations, not just within one).
 *   2. Calibrate tone — don't repeat the same pep talk if the user
 *      has heard it five times.
 *   3. Name the pattern when it's recurring instead of treating each
 *      occurrence as fresh — "this is the third time you've reached
 *      for absolute language under a deadline."
 *
 * Constitutional grounding:
 *   - §1.6 close-the-loop: prior coachings become inputs to the
 *     next coaching, not transient noise.
 *   - §3.6 make learning visible: when the Coach references prior
 *     work it inherently demonstrates the System knows the user
 *     better than it did a month ago.
 *
 * Memory sources (all already on the §3.1 chain):
 *   - coach.message_graded     — every sent message gets a grade
 *     (productive / neutral / needs_guidance / withheld). Tracks
 *     the user's communication baseline.
 *   - coach.analyze_returned   — emitted by the analyze route on
 *     every analysis. Tracks classification + principle cited.
 *     New as of cross-conversation memory Sprint 1; older history
 *     gracefully empties.
 */

export type CoachMemoryPattern = {
  /** Principle name as cited by the Coach (e.g. "OFNR Model",
   *  "Contrasting Statement"). The grouping key. */
  principle: string;
  /** Book the principle came from (e.g. "Nonviolent Communication
   *  — Rosenberg"). */
  book?: string;
  /** How many times this principle was cited to the user in the
   *  memory window. */
  citedCount: number;
  /** ISO timestamp of the most recent citation. The Coach uses this
   *  to choose between "starting" and "recurring" framings. */
  lastCitedAt: string;
};

export type CoachMemoryGradeMix = {
  productive: number;
  neutral: number;
  needsGuidance: number;
};

export type CoachMemorySnapshot = {
  /** Total analyze calls in the memory window. 0 means the user is
   *  new (or analyze events were not being emitted yet). */
  totalAnalyses: number;
  /** Top recurring patterns, descending by citedCount. Capped at 5
   *  so the prompt stays compact. */
  patterns: CoachMemoryPattern[];
  /** Grade mix of sent messages in the memory window. Gives the
   *  Coach a sense of the user's communication baseline. */
  recentGradeMix: CoachMemoryGradeMix;
  /** Total sent messages graded in the window (sum of the mix). */
  totalGraded: number;
};

const EMPTY_SNAPSHOT: CoachMemorySnapshot = {
  totalAnalyses: 0,
  patterns: [],
  recentGradeMix: { productive: 0, neutral: 0, needsGuidance: 0 },
  totalGraded: 0,
};

const MEMORY_WINDOW_DAYS = 30;
const MAX_PATTERNS = 5;

/**
 * Load the current user's coach memory snapshot. Always returns a
 * snapshot, even if Supabase is unavailable or the user has no
 * history — falls back to the empty shape so callers don't need to
 * branch on auth/network failure.
 *
 * PASS THE CALLER'S CLIENT WHEN THERE IS ONE — the 4 September fix.
 *
 * This resolved its own client with `createClient()`, which reads a session from
 * COOKIES. `care/extension/coach` authenticates with a BEARER token and sends no
 * cookies, so `auth.getUser()` saw nobody and this returned EMPTY_SNAPSHOT —
 * silently, with no error anywhere. `renderMemoryForPrompt` then returned null
 * ("not enough signal — better silent than wrong"), so EVERY extension coach call
 * ran as if the user had never been coached before.
 *
 * The memory was in the database the whole time; the client could not see it.
 * That is an unknown dressed as a zero, and the thing it quietly switched off is
 * the accumulated-behaviour thesis in §3.4 — the coach deriving its behaviour
 * from each team's own data — for every extension user.
 *
 * The fallback stays for the genuine cases (no session, Supabase down). What
 * changed is that a caller who KNOWS who is asking can now say so. Omitting `db`
 * keeps the cookie behaviour exactly, so no web caller changes.
 */
export async function loadCoachMemory(
  /** The caller's own RLS client. Omit for the cookie session (web). */
  db?: SupabaseClient,
): Promise<CoachMemorySnapshot> {
  try {
    const supabase = db ?? (await createClient());
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return EMPTY_SNAPSHOT;

    const since = new Date(
      Date.now() - MEMORY_WINDOW_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    // RLS limits the SELECT to the user's own company; the per-row
    // actor filter narrows to THIS user's events (so admins don't
    // see the wrong baseline when they coach themselves).
    const { data: rows, error } = await supabase
      .from("events")
      .select("kind, payload, created_at")
      .eq("actor", auth.user.id)
      .in("kind", ["coach.analyze_returned", "coach.message_graded"])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error || !rows) return EMPTY_SNAPSHOT;

    return aggregate(rows);
  } catch {
    return EMPTY_SNAPSHOT;
  }
}

type EventRow = {
  kind: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};

function aggregate(rows: EventRow[]): CoachMemorySnapshot {
  const patternMap = new Map<string, CoachMemoryPattern>();
  let totalAnalyses = 0;
  const mix: CoachMemoryGradeMix = {
    productive: 0,
    neutral: 0,
    needsGuidance: 0,
  };
  let totalGraded = 0;

  for (const r of rows) {
    if (r.kind === "coach.analyze_returned") {
      totalAnalyses += 1;
      const p = r.payload ?? {};
      const principleName = typeof p.principle === "string" ? p.principle : null;
      const book = typeof p.book === "string" ? p.book : undefined;
      if (!principleName) continue;
      const existing = patternMap.get(principleName);
      if (existing) {
        existing.citedCount += 1;
        // rows arrive newest-first, so the first seen is the latest
      } else {
        patternMap.set(principleName, {
          principle: principleName,
          book,
          citedCount: 1,
          lastCitedAt: r.created_at,
        });
      }
    } else if (r.kind === "coach.message_graded") {
      const grade = (r.payload ?? {}).grade;
      if (grade === "productive") {
        mix.productive += 1;
        totalGraded += 1;
      } else if (grade === "neutral") {
        mix.neutral += 1;
        totalGraded += 1;
      } else if (grade === "needs_guidance") {
        mix.needsGuidance += 1;
        totalGraded += 1;
      }
      // "withheld" doesn't count toward the baseline.
    }
  }

  const patterns = Array.from(patternMap.values())
    .sort((a, b) => b.citedCount - a.citedCount)
    .slice(0, MAX_PATTERNS);

  return {
    totalAnalyses,
    patterns,
    recentGradeMix: mix,
    totalGraded,
  };
}

/**
 * Render the snapshot as a compact, prompt-friendly section the
 * Coach injects into its system prompt. Returns null when there
 * isn't enough history to be useful (the LLM should treat this user
 * as new rather than hallucinate patterns from sparse data).
 *
 * Target: 3-8 short lines so the prompt stays small.
 */
export function renderMemoryForPrompt(
  snapshot: CoachMemorySnapshot
): string | null {
  if (snapshot.totalAnalyses < 3 && snapshot.totalGraded < 5) {
    // Not enough signal — better silent than wrong.
    return null;
  }

  const lines: string[] = [];
  lines.push(
    `USER PATTERN HISTORY (last ${MEMORY_WINDOW_DAYS} days — your prior coachings on this user, drawn from the chain):`
  );

  if (snapshot.patterns.length > 0) {
    lines.push("Recurring patterns you've already named to them:");
    for (const p of snapshot.patterns) {
      const ago = daysAgo(p.lastCitedAt);
      const agoLabel =
        ago === 0
          ? "today"
          : ago === 1
            ? "yesterday"
            : `${ago} days ago`;
      lines.push(
        `  - "${p.principle}"${
          p.book ? ` (${p.book})` : ""
        } — cited ${p.citedCount}× · last ${agoLabel}`
      );
    }
  }

  if (snapshot.totalGraded > 0) {
    const total = snapshot.totalGraded;
    const pct = (n: number) => Math.round((n / total) * 100);
    lines.push(
      `Recent sent-message grade mix (n=${total}): ${pct(
        snapshot.recentGradeMix.productive
      )}% productive · ${pct(
        snapshot.recentGradeMix.neutral
      )}% neutral · ${pct(snapshot.recentGradeMix.needsGuidance)}% needs-guidance.`
    );
  }

  lines.push(
    "USE THIS:",
    "- If a pattern below recurs in this draft, NAME the recurrence (don't pretend it's the first time).",
    "- If the user has heard the same principle 3+ times, vary the framing — same teaching, fresh angle.",
    "- Never reveal raw counts to the user verbatim — that reads as surveillance."
  );

  return lines.join("\n");
}

function daysAgo(iso: string): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  const diffMs = Date.now() - then;
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}
