/**
 * Incremental transcript persistence — the fix for the 2026-08-21 capture-loss crisis (52% of sessions stored
 * ZERO transcript). Root cause: the live transcript lived only in a client ref and was written to the DB in ONE
 * batch on Stop→/finalize; any un-clean end (tab close, nav-away, crash, >64KB keepalive, or the rep never
 * Stopping) lost everything. This selects the turns to flush to /api/coach/sales-session/[id]/segments DURING
 * the call, so a dropped session keeps what was captured.
 *
 * The transcript table is APPEND-ONLY with unique(session_id, seq): once a seq is written its label can't change.
 * So we flush a turn ONLY once it is SETTLED (pending=false — the label won't be refined again). Video/earbud-
 * locked turns are final at commit; in-person turns settle after the /attribute round-trip. Turns still pending
 * are held back and flushed on stop / tab-close (with their provisional label — better than losing them). Pure +
 * unit-tested; the live hook is thin wiring over this.
 */

export type FlushSpeaker = "agent" | "customer" | "unknown";

export interface FlushTurn {
  text: string;
  speaker: FlushSpeaker;
  /** True while the LLM /attribute may still refine the label; false once the label is final. */
  pending?: boolean;
  /** Why the label was chosen (video-mic | manual | content | pitch | loudness) — persisted for diagnosability. */
  source?: string;
}

export interface FlushSegment {
  speaker: FlushSpeaker;
  text: string;
  seq: number;
  source?: string;
}

/**
 * Pick the segments to persist now: SETTLED (not pending), non-empty, and not already flushed. `seq` is the
 * turn's index in the transcript (matches the finalize payload, so the unique constraint dedups re-sends).
 * @param includePending when true (stop / tab-close), also flush still-pending turns with their current label —
 *        the session is ending, so a provisional label beats losing the turn entirely.
 */
export function selectUnflushedSegments(
  turns: FlushTurn[],
  flushed: ReadonlySet<number>,
  includePending = false,
): FlushSegment[] {
  const out: FlushSegment[] = [];
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i]!;
    if (flushed.has(i)) continue;
    if (!includePending && t.pending) continue;
    if (!t.text || !t.text.trim()) continue;
    out.push({ speaker: t.speaker, text: t.text, seq: i, ...(t.source ? { source: t.source } : {}) });
  }
  return out;
}
