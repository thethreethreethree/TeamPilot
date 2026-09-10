// sync/sessions.ts — reading the signed-in rep's coaching data DIRECTLY from Supabase, under the Row-Level
// Security the backend already enforces. This is the Phase-1 sync path: it needs NO backend change, because the
// existing RLS policies let a user read their own sessions (and a manager read their company's).
//
// WHY direct-Supabase for reads (not an API route): the SELECT policies on coaching_sessions / segments / cues
// already scope to `agent_id = auth.uid()` (owner) OR company-admin/manager. So `supabase.from(...).select()`
// with the user's session returns exactly their rows and nothing else — the same data the web app shows, live,
// with real-time + offline caching available from the client library. No second endpoint to build or secure.
//
// WHAT still goes through the API (not here): anything that RUNS server logic — AI suggestions (coach-api.ts),
// audio transcription, KPI computation. Those reuse the server's single source of truth rather than a second
// copy on the device (the architecture's "consume the verdict, don't re-derive" rule — a re-implemented KPI formula is a
// drift bug waiting to happen). The Bearer shim landed: /api/coach/kpi/me answers
// the app directly (200 with real metrics, checked 4 September), so the KPI screens
// read the server's verdict rather than waiting on anything.

import { supabase } from "../supabase";
import type { CoachingSession, TranscriptSegment, CoachingCue } from "@/types/backend";
import {
  DISSECT_ATTEMPTED,
  DISSECT_GENERATED,
  captureIssueFor,
  latestReasonBySession,
  sessionIdFromSubject,
  type CaptureIssue,
} from '@/lib/capture-issue';

/** The signed-in rep's own sessions, newest first. RLS guarantees these are theirs (or their company's if manager). */
/** How many sessions a page holds. Small enough to paint fast on a cold open. */
export const SESSIONS_PAGE = 50;

/**
 * One page of the rep's sessions, newest first.
 *
 * WHY THIS TAKES AN OFFSET NOW. It used to fetch the 50 most recent and nothing
 * else, with no way to ask for more — so a rep past their fiftieth call could
 * not see or search anything older, and nothing on screen said so. Everything
 * built on the list inherited that quietly: the search box reported "no match"
 * for calls that exist, and the count of calls missing an outcome understated
 * itself, which is worse than useless because it is the number that explains why
 * their KPI board will not fill in.
 *
 * `hasMore` is derived by asking for one row more than the page and seeing
 * whether it arrives. Comparing `data.length === limit` cannot tell a full last
 * page from a page with more behind it, and would leave a rep with exactly 50
 * sessions being offered a "load more" that finds nothing.
 *
 * Offset paging can repeat a row if a session is inserted while the rep is
 * scrolling. The caller de-duplicates by id rather than this pretending it
 * cannot happen.
 */
/**
 * A session, plus how many transcript segments it has.
 *
 * `segmentCount` is NULL when the count could not be read — see below. Null is
 * not zero, and the list is careful to keep them apart.
 */
export type SessionListRow = CoachingSession & {
  segmentCount: number | null;
  /**
   * Why this call has no coach read, when the reason is the recording.
   *
   * NULL means "no issue OR we did not ask" — the two are deliberately the same
   * here, because the only thing this drives is whether to show a chip, and a
   * chip that appears because a side query failed would be worse than no chip.
   * The events read is best-effort for exactly that reason.
   */
  captureIssue: CaptureIssue;
  /**
   * Segments on this call whose speaker is `unknown`, or NULL when it was not read.
   *
   * Recovery saves a dropped call's words as `unknown` when it cannot tell which voice is
   * the rep. Those words score nothing until somebody says whose they are, so this is what
   * lets the list say "waiting on you" instead of the rep never finding out.
   *
   * Null, not zero, when the side query failed — see `needsVoiceAnswer`, which refuses to
   * render a chip from an unknown.
   */
  unattributedCount: number | null;
};

/**
 * The embedded count, asked for in the SAME query.
 *
 * `coaching_transcript_segments.session_id` has a foreign key to
 * `coaching_sessions(id)` and an index on `(session_id, seq)` (migration 0070),
 * so PostgREST can return the count alongside each row without a second round
 * trip and without a sequential scan.
 *
 * It exists so the list can say which calls have come back from the coach. That
 * was the one question a rep asks every day that this screen could not answer:
 * four calls recorded this morning looked identical whether the coaching had
 * arrived or not, and the only way to find out was to open each one.
 */
const WITH_SEGMENT_COUNT = "*, coaching_transcript_segments(count)";

/**
 * The one-sided verdict for a page of sessions.
 *
 * BEST-EFFORT ON PURPOSE. This annotates rows that are already on screen; if the
 * events read fails, every row simply carries `null` and no chip appears. Letting
 * it throw would take down the whole Sessions list to decorate it, which trades a
 * working screen for a badge.
 *
 * TWO READS, NOT A JOIN. `events` has no foreign key to `coaching_sessions` (its
 * `subject` is a text key, `"sales_session:<uuid>"`), so PostgREST cannot embed
 * it. Both are filtered to the ids already fetched, so this stays O(page).
 */
/**
 * Display names for the reps who own a page of sessions.
 *
 * ONLY ASKED FOR IDS THAT ARE NOT THE VIEWER'S, so a rep looking at their own
 * list makes no extra request at all — the common case costs nothing.
 *
 * Best-effort, like the capture-issue read beside it: a failed lookup leaves the
 * map empty and the rows unlabelled, which is the state the screen was in before
 * and is honest. It must never take down a list it exists to annotate.
 */
export async function repNamesFor(agentIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = Array.from(new Set(agentIds.filter((id) => id && id.trim().length > 0)));
  if (ids.length === 0) return out;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids);
    if (error) return out;
    for (const row of data ?? []) {
      const r = row as { id: string; full_name: string | null };
      const name = r.full_name?.trim();
      if (name) out.set(r.id, name);
    }
  } catch {
    // Decoration, never a reason to fail the list.
  }
  return out;
}

/** Attach the one-sided verdict to a page of rows. Never throws. */
async function withCaptureIssues(rows: SessionListRow[]): Promise<SessionListRow[]> {
  const issues = await captureIssuesFor(rows.map((r) => r.id));
  if (issues.size === 0) return rows;
  return rows.map((r) => ({ ...r, captureIssue: issues.get(r.id) ?? null }));
}

/**
 * Attach the unattributed-segment count to a page of rows. Never throws.
 *
 * CHEAP BY CONSTRUCTION, and worth saying why rather than leaving it to be rediscovered:
 * this asks only for segments whose speaker is `unknown`. Every other path in the system
 * writes `agent` or `customer`, so on a healthy company the query matches NOTHING and
 * costs one empty round trip. It only returns rows for calls that were recovered without
 * a confident attribution — which are exactly the calls this chip exists for.
 *
 * On failure every row gets NULL rather than 0. Zero would say "checked, nothing waiting"
 * and silently hide a real question; null says "did not find out" and shows no chip.
 */
async function withVoiceQuestion(rows: SessionListRow[]): Promise<SessionListRow[]> {
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return rows;
  try {
    const { data, error } = await supabase
      .from("coaching_transcript_segments")
      .select("session_id")
      .eq("speaker", "unknown")
      .in("session_id", ids);
    if (error) return rows.map((r) => ({ ...r, unattributedCount: null }));
    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      const id = (row as { session_id?: unknown }).session_id;
      if (typeof id === "string") counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    // A session absent from the result genuinely has none — the query succeeded.
    return rows.map((r) => ({ ...r, unattributedCount: counts.get(r.id) ?? 0 }));
  } catch {
    return rows.map((r) => ({ ...r, unattributedCount: null }));
  }
}

async function captureIssuesFor(sessionIds: string[]): Promise<Map<string, CaptureIssue>> {
  const out = new Map<string, CaptureIssue>();
  if (sessionIds.length === 0) return out;
  const subjects = sessionIds.map((id) => `sales_session:${id}`);

  try {
    const [attempted, generated] = await Promise.all([
      supabase
        .from("events")
        .select("subject, payload, created_at")
        .eq("kind", DISSECT_ATTEMPTED)
        .in("subject", subjects),
      supabase
        .from("events")
        .select("subject")
        .eq("kind", DISSECT_GENERATED)
        .in("subject", subjects),
    ]);
    if (attempted.error || generated.error) return out;

    const withDissect = new Set(
      (generated.data ?? [])
        .map((r) => sessionIdFromSubject((r as { subject: string | null }).subject))
        .filter((id): id is string => id !== null),
    );
    const reasons = latestReasonBySession(
      (attempted.data ?? []).map((r) => {
        const row = r as { subject: string | null; created_at: string | null; payload: unknown };
        const reason = (row.payload as { reason?: unknown } | null)?.reason;
        return {
          subject: row.subject,
          createdAt: row.created_at,
          reason:
            reason === "no_agent_turns" || reason === "no_signal" ? reason : null,
        };
      }),
    );
    for (const id of sessionIds) {
      out.set(id, captureIssueFor(withDissect.has(id), reasons.get(id) ?? null));
    }
  } catch {
    // Decoration, never a reason to fail the list.
  }
  return out;
}

export async function listMySessions(
  limit = SESSIONS_PAGE,
  offset = 0,
): Promise<{ rows: SessionListRow[]; hasMore: boolean }> {
  /**
   * TRY THE EMBEDDED COUNT, FALL BACK TO A PLAIN READ.
   *
   * This is the app's most-used list, and an embedded select depends on things
   * outside this file: the foreign key, PostgREST's schema cache, and the RLS
   * policy on the child table. If any of those is not what it is today, the
   * fallback means a rep still gets their sessions — they simply lose one chip.
   *
   * The fallback returns `segmentCount: null`, NOT zero. Zero would say "checked,
   * nothing there" and put every row into "being analysed" the moment the embed
   * broke — an app-wide false statement caused by a failed query. Null says "we
   * did not find out", and the chip renders nothing.
   */
  const embedded = await supabase
    .from("coaching_sessions")
    .select(WITH_SEGMENT_COUNT)
    .order("started_at", { ascending: false })
    .range(offset, offset + limit); // one extra, deliberately

  if (!embedded.error) {
    const rows = (embedded.data ?? []).map(toListRow);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return { rows: await withVoiceQuestion(await withCaptureIssues(page)), hasMore };
  }

  const { data, error } = await supabase
    .from("coaching_sessions")
    .select("*")
    .order("started_at", { ascending: false })
    .range(offset, offset + limit);
  if (error) throw error;

  const rows = (data ?? []).map((r) => ({
    ...(r as CoachingSession),
    segmentCount: null,
    captureIssue: null as CaptureIssue,
    unattributedCount: null,
  }));
  const hasMore = rows.length > limit;
  return { rows: hasMore ? rows.slice(0, limit) : rows, hasMore };
}

/**
 * Read the embedded count off one row.
 *
 * PostgREST returns an aggregate embed as an ARRAY holding one object —
 * `[{ count: 12 }]` — and returns `[]` rather than `[{count: 0}]` for a session
 * with no segments at all. Both shapes mean a real, checked answer, so an empty
 * array is zero and not unknown. Anything else is unknown, because a shape this
 * function does not recognise is a shape it cannot count.
 */
function toListRow(row: unknown): SessionListRow {
  const r = row as CoachingSession & { coaching_transcript_segments?: unknown };
  const embed = r.coaching_transcript_segments;
  let segmentCount: number | null = null;
  if (Array.isArray(embed)) {
    if (embed.length === 0) {
      segmentCount = 0;
    } else {
      const n = (embed[0] as { count?: unknown })?.count;
      segmentCount = typeof n === "number" && Number.isFinite(n) ? n : null;
    }
  }
  // `captureIssue` is filled in afterwards by the events read; null until then,
  // which is also what it stays if that read fails.
  // `captureIssue` and `unattributedCount` are filled in afterwards by their own reads;
  // null until then, which is also what they stay if those reads fail.
  return { ...(r as CoachingSession), segmentCount, captureIssue: null, unattributedCount: null };
}

/** One session by id (RLS enforces ownership/visibility — a foreign id returns nothing, not someone else's row). */
export async function getSession(id: string): Promise<CoachingSession | null> {
  const { data, error } = await supabase.from("coaching_sessions").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as CoachingSession) ?? null;
}

/**
 * Read every row for a session, a page at a time.
 *
 * WHY NOT ONE UNBOUNDED QUERY. PostgREST applies a server-side row cap
 * (`max-rows`, commonly 1000) whether or not the client asks for a limit, and it
 * does not say when it has applied one — the response simply stops. A long call
 * can produce well over a thousand transcript segments, so an unpaged read would
 * hand the rep a conversation that ends mid-sentence with nothing to indicate
 * anything was missing. Reading in explicit pages until a short one comes back
 * is correct whatever that cap is set to, and needs no knowledge of it.
 *
 * The hard stop exists so a pathological row count cannot spin forever on a
 * phone. It is reported rather than hidden.
 */
const READ_PAGE = 500;
const READ_MAX_PAGES = 40; // 20,000 rows — far past any real call

async function readAllPages<T>(
  table: string,
  sessionId: string,
  orderBy: string,
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  for (let page = 0; page < READ_MAX_PAGES; page++) {
    const from = page * READ_PAGE;
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("session_id", sessionId)
      .order(orderBy, { ascending: true })
      .range(from, from + READ_PAGE - 1);
    if (error) throw error;

    const batch = (data ?? []) as T[];
    rows.push(...batch);
    // A short page is the end. A full one might not be.
    if (batch.length < READ_PAGE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

/** A session's transcript, in order. Append-only on the server, so this only ever grows. */
export async function getTranscript(sessionId: string): Promise<TranscriptSegment[]> {
  const { rows } = await readAllPages<TranscriptSegment>(
    "coaching_transcript_segments",
    sessionId,
    "seq",
  );
  return rows;
}

/** The in-call cues the coach delivered for a session. */
export async function getCues(sessionId: string): Promise<CoachingCue[]> {
  const { rows } = await readAllPages<CoachingCue>("coaching_cues", sessionId, "delivered_at");
  return rows;
}

/**
 * Live updates: subscribe to new sessions for this rep and re-render as they land (e.g. a call recorded on
 * another device syncs in). Returns an unsubscribe function. Realtime respects the same RLS as the reads.
 *
 * ⚠️ PRECONDITION (verify before relying on this): `coaching_sessions` must be in the `supabase_realtime`
 * publication. As of this writing NO migration in the backend adds it, so realtime is very likely OFF for this
 * table — the subscription will connect but NEVER fire. Enable it once (Supabase Dashboard → Database →
 * Replication, or `alter publication supabase_realtime add table public.coaching_sessions;`). Until then,
 * treat realtime as an enhancement and make **stale-while-revalidate polling** (re-call listMySessions on focus /
 * pull-to-refresh) your reliable baseline — do NOT present realtime as guaranteed live.
 */
export function subscribeMySessions(onChange: () => void): () => void {
  const channel = supabase
    .channel("my-coaching-sessions")
    .on("postgres_changes", { event: "*", schema: "public", table: "coaching_sessions" }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Live updates for ONE session: its transcript segments and its coach cues, both
 * of which are append-only and arrive after the call ends (transcription runs on
 * upload). A rep who opens a session the moment it finishes is watching an empty
 * screen that fills in — if realtime is on.
 *
 * ⚠️ THE SAME PRECONDITION AS subscribeMySessions, and it is worth repeating
 * rather than cross-referencing: `transcript_segments` and `coaching_cues` must
 * be in the `supabase_realtime` publication. No migration in the backend adds
 * them, so this will very likely connect and NEVER fire. That is why the screen
 * refetches on focus and on pull as its reliable baseline, and treats this as an
 * enhancement. Do not present it to the owner as guaranteed live.
 *
 * The filter is applied server-side so a rep is not woken for every other rep's
 * transcript; RLS would refuse the rows anyway, but paying to be told about them
 * is waste on a metered connection.
 */
export function subscribeSession(sessionId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`session-${sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "transcript_segments",
        filter: `session_id=eq.${sessionId}`,
      },
      onChange,
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "coaching_cues",
        filter: `session_id=eq.${sessionId}`,
      },
      onChange,
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
