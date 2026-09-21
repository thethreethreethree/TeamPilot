import { createAdminClient } from "@/lib/supabase/admin";
import { BONUSES_BY_ID, ELEMENTS_BY_ID, VIOLATIONS_BY_ID } from "./rubric";

/**
 * The manager's dispute queue — every "this grade is wrong" a rep has filed.
 *
 * WHY THIS EXISTS. The dispute route shipped appending `coach.pitch_score_disputed` events and
 * nothing read them. The rep was told *"your manager will see it"*, and no manager had anywhere
 * to see it — the same dead end the dispute was built to close, displaced by one step. This is
 * the other half.
 *
 * REPLAYED, NOT STORED AS STATE (§3.1). There is no `disputes` table and there should not be one.
 * A dispute is an event; its current state — open, or answered — is derived by replaying the
 * events for that pitch. A manager's reply will be a second event (`coach.pitch_score_answered`),
 * and "open" means the newest dispute for an item has no answer after it. That keeps the full
 * history intact, which is what makes "changes are logged" a true sentence rather than a claim.
 *
 * Service-role by necessity: `events` RLS is company-wide, so a rep could otherwise read a
 * colleague's dispute. The CALLER's authorisation is checked by the route before this runs — it
 * is manager-only — and the company filter below is the tenant boundary.
 */

export type DisputeRow = {
  id: string;
  pitchId: string;
  sessionId: string | null;
  /** The rep whose score is disputed. Usually, but not always, the person who filed it. */
  repId: string;
  /** Who actually filed it, so a manager-filed dispute is not misattributed to the rep. */
  actorId: string;
  /** The element/bonus/violation, resolved to its rubric label. Null = the whole score. */
  itemId: string | null;
  itemLabel: string | null;
  timestampS: number | null;
  note: string;
  filedAt: string;
  /** True when no answer event follows this dispute for the same item. */
  open: boolean;
  answer: { note: string; actorId: string; answeredAt: string } | null;
};

const DISPUTE_KIND = "coach.pitch_score_disputed";
const ANSWER_KIND = "coach.pitch_score_answered";

/** One label lookup across all three rubric vocabularies — the caller does not know which it is. */
export function labelForItem(itemId: string | null): string | null {
  if (!itemId) return null;
  return (
    ELEMENTS_BY_ID.get(itemId)?.label ??
    BONUSES_BY_ID.get(itemId)?.label ??
    VIOLATIONS_BY_ID.get(itemId)?.label ??
    // A retired id still names something real that happened. Showing the raw id beats hiding the
    // dispute, which would drop a rep's complaint on the floor because the rubric moved on.
    itemId
  );
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const numOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** The raw shape both readers hand to the replay. */
export type DisputeEventRow = {
  id: string | number;
  actor: string | null;
  kind: string;
  subject?: string | null;
  payload: unknown;
  created_at: string;
};

/**
 * Turn dispute and answer events into threads — the ONE place "is this still open" is decided.
 *
 * Pure, and exported, because two readers need the answer and §2.2 forbids the second one working
 * it out again: the manager's queue reads the whole company with the service role, and the rep's
 * Pitch detail reads one pitch through their own client. Two copies of "an answer filed before the
 * dispute does not close it" would drift, and the drift would be invisible — one side would show
 * a thread as handled while the other showed it open, and nobody would get an error.
 *
 * `rows` must contain the answers BEFORE the disputes, and the disputes in the order the caller
 * wants them out.
 */
export function replayDisputes(
  rows: readonly DisputeEventRow[],
  opts: { repId?: string; includeAnswered?: boolean } = {}
): DisputeRow[] {
  // Answers, keyed by the thing they answer. Replayed in ascending time, so the LAST answer for a
  // key wins — a manager who replies twice has changed their mind, and the later reply is current.
  const answers = new Map<string, { note: string; actorId: string; answeredAt: string }>();
  for (const r of rows) {
    if (r.kind !== ANSWER_KIND) continue;
    const p = (r.payload ?? {}) as Record<string, unknown>;
    const pitchId = str(p.pitch_id);
    if (!pitchId) continue;
    answers.set(`${pitchId}::${str(p.item_id) ?? ""}`, {
      note: str(p.note) ?? "",
      actorId: String(r.actor ?? ""),
      answeredAt: String(r.created_at),
    });
  }

  const out: DisputeRow[] = [];
  for (const r of rows) {
    if (r.kind !== DISPUTE_KIND) continue;
    const p = (r.payload ?? {}) as Record<string, unknown>;
    const pitchId = str(p.pitch_id);
    if (!pitchId) continue;

    const repId = str(p.rep_id) ?? "";
    if (opts.repId && repId !== opts.repId) continue;

    const itemId = str(p.item_id);
    const answer = answers.get(`${pitchId}::${itemId ?? ""}`) ?? null;
    // An answer that predates this dispute answers an EARLIER one. Re-filing after a reply opens
    // the thread again, which is the behaviour a rep expects when the first answer did not land.
    const stillOpen = !answer || answer.answeredAt <= String(r.created_at);

    if (!opts.includeAnswered && !stillOpen) continue;

    out.push({
      id: String(r.id),
      pitchId,
      sessionId: str(p.session_id),
      repId,
      actorId: String(r.actor ?? ""),
      itemId,
      itemLabel: labelForItem(itemId),
      timestampS: numOrNull(p.timestamp_s),
      note: str(p.note) ?? "",
      filedAt: String(r.created_at),
      open: stillOpen,
      answer: stillOpen ? null : answer,
    });
  }
  return out;
}

export async function readDisputes(args: {
  companyId: string;
  /** Limit to one rep's disputes. Omitted = the whole company. */
  repId?: string;
  /** Default: only those with no answer yet, which is what a queue is for. */
  includeAnswered?: boolean;
  limit?: number;
}): Promise<DisputeRow[] | null> {
  const admin = createAdminClient();
  const limit = Math.min(args.limit ?? 200, 500);

  // TWO BOUNDED QUERIES, not one big one. The first draft read every dispute AND answer event in
  // one call with a client-side limit of 2,000 rows — which PostgREST silently caps at its
  // max_rows of 1,000, so the replay
  // would have run on a truncated history without saying so. On a busy company that does not just
  // hide old rows: an answer that falls outside the window makes an ANSWERED dispute reappear as
  // open, and a manager re-answers something they already handled.
  //
  // So: take the newest N disputes, then fetch the answers for exactly those pitches. Both bounded,
  // and the replay is complete for every row actually returned.
  const disputeQuery = admin
    .from("events")
    .select("id, actor, kind, subject, payload, created_at")
    .eq("company_id", args.companyId)
    .eq("kind", DISPUTE_KIND)
    .order("created_at", { ascending: false })
    .limit(limit);

  const { data: disputeRows, error } = await disputeQuery;

  if (error) {
    // Classified, not swallowed. An empty queue and a failed read look identical on screen, and
    // "no disputes" is the answer a manager will act on by doing nothing.
    // eslint-disable-next-line no-console
    console.error(`[readDisputes] read failed company=${args.companyId}: ${error.message}`);
    return null;
  }

  const disputes = disputeRows ?? [];
  const subjects = [...new Set(disputes.map((r) => String(r.subject)))];

  let answerRows: typeof disputes = [];
  if (subjects.length > 0) {
    const { data: ans, error: ansError } = await admin
      .from("events")
      .select("id, actor, kind, subject, payload, created_at")
      .eq("company_id", args.companyId)
      .eq("kind", ANSWER_KIND)
      .in("subject", subjects)
      .order("created_at", { ascending: true })
      .limit(1000);

    if (ansError) {
      // Also fatal. Continuing without answers would show every dispute as OPEN — a queue full of
      // work that is already done, which is a worse lie than showing nothing.
      // eslint-disable-next-line no-console
      console.error(`[readDisputes] answer read failed company=${args.companyId}: ${ansError.message}`);
      return null;
    }
    answerRows = ans ?? [];
  }

  // Oldest-first for the replay below; the disputes were fetched newest-first for the bound and
  // are iterated in that order, which is also the order a queue is read.
  const rows = [...answerRows, ...disputes];


  const out = replayDisputes(rows, args);

  // Already newest-first: the dispute query ordered descending and they are iterated in order.
  return out;
}
