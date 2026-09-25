import type { SupabaseClient } from "@supabase/supabase-js";

import { getSession, getSessionTranscript } from "@/lib/data/salesCoach";
import { generatePitchScore } from "./generatePitchScore";
import type { PitchScore } from "./scorePitch";
import { storePitchScore } from "./storePitchScore";
import { runDetection } from "@/lib/coach/patterns/runDetection";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Score one recorded sales session, as ONE authority that every caller consumes.
 *
 * WHY THIS EXISTS AS A FUNCTION RATHER THAN A ROUTE BODY.
 *
 * Until now the only way to score a pitch was to POST the route, and the only thing that POSTed
 * the route was a button on one session page. `pitch_scores` therefore held exactly the pitches
 * somebody remembered to grade by hand — which for a real customer was none, while ten modules
 * read that table and the build plan's own flowchart says "nothing can display until pitches are
 * scored" (audit: docs/AUDIT-UNTRIGGERED-ARTIFACTS-2026-09-24.md).
 *
 * There are now three callers — the button, the session-close path, and the backlog drain — and
 * §2.2 is explicit that they must consume a returned VERDICT rather than each re-deriving "can
 * this be scored?" from the raw session. A re-derived gate drifts: the day someone adds a fourth
 * refusal reason to one copy and not the others, a caller scores something it should have refused,
 * or discards a result it already paid an LLM for. That second shape is exactly the 2026-08-14
 * empty-AI outage.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: authenticate. The caller holds the request and its own auth
 * story — the button is owner-or-manager via RLS, the close path is the session's own owner, the
 * drain is admin-gated — and a function that took a "trust me" flag would be the weaker of the two
 * designs. It takes the CLIENT, and whatever that client can see is what gets scored.
 */

/** Every way scoring can end, each mapping to a different thing to tell a human. */
export type ScoreOutcome =
  | {
      ok: true;
      pitchId: string;
      alreadyScored: boolean;
      /**
       * Absent when `alreadyScored` — the score exists in the database and was not recomputed, and
       * inventing a value here would mean re-reading a row no caller has asked for. A caller that
       * needs the numbers reads them back; the button already does exactly that.
       */
      score?: PitchScore;
      timestampsUnavailable?: boolean;
    }
  | {
      ok: false;
      reason: ScoreRefusal;
      /**
       * The sentence a human reads, built HERE because this is where the context exists.
       *
       * NAMED `humanMessage`, NOT `message`, and the rename is load-bearing. INVARIANT 14 flags
       * `error:` set to a `.message` at a 5xx, because that is the shape of a raw exception or a
       * Postgres error leaking schema and RLS detail to a client. This string is curated — it is
       * never an exception's text — but a reader (and the checker) cannot see that from `.message`.
       * Making the safe thing stop LOOKING like the dangerous thing beats an allowlist entry that
       * future readers have to take on trust.
       *
       * The refusal for a huddle used to say "(this is a huddle)" — the session's actual kind —
       * and a static per-reason map loses that. Returning the composed message with the verdict is
       * the §2.2 shape: nobody downstream re-derives wording from a reason code and quietly drops
       * the detail, which is exactly what my first pass at this refactor did.
       */
      humanMessage: string;
    };

export type ScoreRefusal =
  /** No such session, or the caller's RLS cannot see it. Indistinguishable on purpose (IDOR). */
  | "not_found"
  /** A huddle or a meeting. Never scored low — refused, because a score claims how someone SOLD. */
  | "not_a_sales_call"
  /** Nothing the rep said. Will not change on a retry. */
  | "no_agent_turns"
  /** The §3.4 month-1 control gate declined the call. NOT a failure — an account state. */
  | "suppressed"
  | "llm_empty"
  | "parse_failed"
  /** The score was produced and the write did not land. The LLM spend is already gone. */
  | "store_failed"
  /**
   * Something threw. Added 2026-09-24 after the backlog drain died on its first real run.
   *
   * Every other refusal here is a decision this function MADE. This one is the absence of a
   * decision: an exception out of `getSession`, `getSessionTranscript`, `generatePitchScore` or
   * `storePitchScore`, none of which were wrapped. It propagated out of scoreSession, out of the
   * drain's loop, and out of the POST as a 500 — so ONE malformed recording in a backlog of 194
   * stopped the whole run and the only thing the manager saw was "the request failed".
   *
   * Not permanent: a provider blip, a rate limit or a timeout is worth another pass.
   */
  | "errored"
  /**
   * The AI provider refused on BILLING — an `LlmError` of kind `quota` (a 402, "Insufficient Balance").
   *
   * Split out of `errored` on 2026-09-25, from production's own logs: the DeepSeek balance ran out at
   * 2026-09-22 17:00, and every "Score them all" press after it walked all 194 recordings, got 194
   * identical 402s, and told the manager "failed unexpectedly for 194" — a sentence that points at the
   * code and at the recordings, when the truth was one account setting nobody could see.
   *
   * Like `suppressed` it is a property of the ACCOUNT, not of this recording, so a drain halts on it.
   * Unlike `suppressed` it is NOT permanent: a top-up fixes it, and the next press should work.
   */
  | "provider_out_of_credit";

/**
 * A refusal that re-running will never change, so a drain must not keep paying for it.
 *
 * `suppressed` is here and it is the one worth explaining: guidance being off is a deliberate
 * account state (§3.4 month 1 is a control condition), not an error, and retrying it every sweep
 * would be a loop against a decision the product made on purpose.
 */
export const PERMANENT_REFUSALS: ReadonlySet<ScoreRefusal> = new Set([
  "not_found",
  "not_a_sales_call",
  "no_agent_turns",
  "suppressed",
]);

/** What a human should read for each refusal. One string per reason — a generic message here would
 *  collapse "this was a team huddle" and "our scorer broke" into the same sentence. */
export const REFUSAL_MESSAGE: Record<ScoreRefusal, string> = {
  not_found: "Session not found or not accessible.",
  not_a_sales_call: "Only sales calls are scored against the pitch rubric.",
  no_agent_turns: "This recording has no rep speech to grade.",
  suppressed: "AI guidance is off for this account, so pitches are not scored yet.",
  llm_empty: "The scorer returned nothing. This is a fault on our side, not your pitch.",
  parse_failed: "The scorer's answer could not be read. This is a fault on our side.",
  store_failed: "The score could not be saved.",
  errored: "Scoring this recording failed unexpectedly. This is a fault on our side, not your pitch.",
  provider_out_of_credit:
    "The AI provider account is out of credit, so nothing can be scored until it is topped up. " +
    "This is an account setting, not your pitch.",
};

export async function scoreSession(args: {
  sessionId: string;
  companyId: string;
  /** Scoped for identity AND used for the reads — see the route header's note on why both. */
  db: SupabaseClient;
  /**
   * Skip sessions that already have a score. The button passes false (a manager asking again means
   * asking again); the close path and the drain pass true, because re-scoring on every sweep would
   * bill the same pitch forever.
   */
  skipIfScored?: boolean;
}): Promise<ScoreOutcome> {
  /**
   * The public entry point is a THIN GUARD around the real work, and that is the point.
   *
   * A caller that has to wrap this in its own try/catch is a caller re-deriving a decision this
   * function is responsible for (§2.2). The drain had no such wrapper, so the first recording that
   * threw took the entire run with it. Returning `errored` as a verdict means every caller —
   * the drain, the close path, the manual button — gets the same contract: an outcome, never an
   * exception.
   */
  try {
    return await scoreSessionOrThrow(args);
  } catch (err) {
    // Server-side only. The client gets REFUSAL_MESSAGE, never the exception text (CWE-209).
    console.error("[scoreSession] threw", { sessionId: args.sessionId }, err);
    // Read the error's own verdict (LlmError.kind, classified from the HTTP status in llm/errors.ts)
    // rather than re-matching "402" in the message — §2.2. Duck-typed on `kind` so a second copy of the
    // class across a bundle boundary cannot defeat an instanceof.
    if ((err as { kind?: unknown } | null)?.kind === "quota") return refuse("provider_out_of_credit");
    return refuse("errored");
  }
}

async function scoreSessionOrThrow(args: {
  sessionId: string;
  companyId: string;
  db: SupabaseClient;
  skipIfScored?: boolean;
}): Promise<ScoreOutcome> {
  const { sessionId, companyId, db, skipIfScored = false } = args;

  // RLS scopes this to owner-or-manager (0083/0084). A null result IS the IDOR gate: a same-company
  // peer must not be able to score — or learn the existence of — another rep's recording.
  const session = await getSession(sessionId, db);
  if (!session) return refuse("not_found");

  // A huddle is not a pitch. Refused with a reason rather than scored low, because a score is a
  // claim about how someone sold and this conversation was never a sale.
  if (session.sessionKind !== "sales") {
    return refuse(
      "not_a_sales_call",
      `Only sales calls are scored against the pitch rubric (this is a ${session.sessionKind}).`
    );
  }

  if (skipIfScored) {
    const { data: existing } = await db
      .from("pitch_scores")
      .select("id")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (existing?.id) return { ok: true, pitchId: String(existing.id), alreadyScored: true };
  }

  const segments = await getSessionTranscript(sessionId, db);

  const result = await generatePitchScore({
    companyId,
    sessionTitle: session.clientLabel ?? undefined,
    segments,
  });

  // No zero-score failure path. Every one of these is reported, never stored — a blank LLM answer
  // must not become a real-looking 0 on a rep's leaderboard with nothing in the logs.
  // No cast. `PitchScoreFailure` is a strict subset of `ScoreRefusal`, so this widens and the
  // compiler proves it — if a fifth failure reason is ever added over there and not here, this
  // line stops compiling. A cast would have silently accepted it, which is the defect fixed in
  // docs/tbc/2026-09-24-rejected-bonus-blank-tab on the same afternoon this was written.
  if (!result.ok) return refuse(result.failure);

  const pitchId = await storePitchScore({
    companyId,
    // The rep who gave the pitch, never the caller who asked for it scored. Using the caller would
    // file every manager-triggered score against the manager.
    repId: session.agentId,
    // The RECORDING's time, not now(). An upload processed days later has a wall clock nowhere near
    // its own audio, and a leaderboard filtered by week would put the pitch in the wrong week.
    recordedAt: session.startedAt,
    sessionId: session.id,
    durationS: sessionDurationS(session),
    audioUrl: session.audioAssetUrl,
    // Mapped, not forwarded: SalesOutcome has five values and the column allows three.
    outcome: pitchOutcome(session.outcome),
    result,
  });

  if (!pitchId) return refuse("store_failed");

  // Guide Step 5: "Run detection every time a pitch is scored." AFTER the store, deliberately —
  // detection reads `pitch_score_elements`, so the pitch that just landed has to be in the table
  // before it can be part of its own last-10.
  //
  // NEVER fails the caller. The score is saved and correct at this point; if pattern writing breaks
  // the right outcome is a logged error, not telling a rep their pitch could not be scored. The
  // service-role client is required — `patterns` has no insert policy, so a caller-scoped client
  // would write nothing and report success.
  try {
    const detection = await runDetection({ companyId, repId: session.agentId }, createAdminClient());
    if (detection.opened > 0) {
      console.info(
        `[scoreSession] detection opened ${detection.opened} pattern(s) for rep=${session.agentId} (examined ${detection.examined} items)`
      );
    }
  } catch (err) {
    console.error(`[scoreSession] pattern detection failed for rep=${session.agentId}:`, err);
  }

  return {
    ok: true,
    pitchId,
    alreadyScored: false,
    score: result.score,
    timestampsUnavailable: result.timestampsUnavailable,
  };
}

/** A refusal with its sentence. `override` is for the reasons that can say something specific. */
function refuse(reason: ScoreRefusal, override?: string): ScoreOutcome {
  return { ok: false, reason, humanMessage: override ?? REFUSAL_MESSAGE[reason] };
}

/** Prefer the measured audio length; fall back to the wall clock only when the session ended. */
function sessionDurationS(session: {
  audioDurationSeconds: number | null;
  startedAt: string;
  endedAt: string | null;
}): number | null {
  if (session.audioDurationSeconds != null) return session.audioDurationSeconds;
  if (!session.endedAt) return null;
  const ms = Date.parse(session.endedAt) - Date.parse(session.startedAt);
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 1000) : null;
}

/**
 * Map a SalesOutcome onto the three values `pitch_scores.outcome` accepts (0252:99).
 *
 * `no_contact` and `undecided` become NULL rather than being forced into one of the three. A door
 * that was never answered is not a "no_sale" — recording it as one would make the sold-rate a lie,
 * and the sold-rate is one of the two hard metrics the whole product is measured on (§3.5).
 *
 * The mechanical reason is secondary and also true: the column's CHECK allows three values, so
 * forwarding a fourth fails the entire write AFTER the LLM call has been paid for.
 *
 * (Both halves carried over verbatim from the route this was extracted from. The first half was
 * dropped in the first draft of that extraction — the product reason survives a refactor only if
 * somebody moves it on purpose, and a commit hook noticing a vanished §3.5 citation is what
 * caught it.)
 */
function pitchOutcome(outcome: string | null): "sold" | "follow_up" | "no_sale" | null {
  return outcome === "sold" || outcome === "follow_up" || outcome === "no_sale" ? outcome : null;
}
