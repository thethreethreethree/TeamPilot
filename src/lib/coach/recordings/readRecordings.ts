import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { bandFor } from "../pitchScore/storePitchScore";
import {
  keyMoments,
  momentCoverage,
  timedLines,
  type KeyMoment,
  type TimedLine,
} from "./keyMoments";
import type { Grade } from "../pitchScore/rubric";

/**
 * The Recordings tab's reads — guide Step 4, items 1, 3, 4, 5.
 *
 * Two shapes, deliberately separate: a LIST that is cheap enough to render a rep's whole history,
 * and a DETAIL that pulls the elements, events, comments and transcript for one recording. The
 * list is what a manager scans; the detail is what they open. Loading the second for every row of
 * the first is the read that gets slow silently.
 *
 * EVERYTHING IS READ THROUGH THE CALLER'S CLIENT. `pitch_scores`, `pitch_score_elements`,
 * `pitch_score_events`, `recording_comments` and `coaching_transcript_segments` are all RLS-scoped
 * to own-row-or-company-manager, so the policy is the access rule and this module does not
 * duplicate it (§2.2).
 */

export type PitchRecordingRow = {
  pitchId: string;
  repId: string;
  recordedAt: string;
  durationS: number | null;
  outcome: "sold" | "follow_up" | "no_sale" | null;
  total: number;
  band: string | null;
  /** False when the pitch did not reach Discovery or scored under 40 base. Shown as "Not counted". */
  qualifying: boolean;
  notQualifyingReason: string | null;
  /** Guide item 1: "number of pattern moments". */
  patternMoments: number;
  /** No audio means no player. A dead play button is worse than a disabled one. */
  hasAudio: boolean;
};

export type PitchRecordingDetail = {
  pitchId: string;
  repId: string;
  recordedAt: string;
  durationS: number | null;
  audioUrl: string | null;
  total: number;
  base: number;
  bonus: number;
  violations: number;
  band: string | null;
  outcome: PitchRecordingRow["outcome"];
  moments: KeyMoment[];
  coverage: ReturnType<typeof momentCoverage>;
  lines: TimedLine[];
  /** True when the transcript exists only as flat text, so lines cannot be placed. */
  linesApproximate: boolean;
};

const num = (v: unknown): number => (typeof v === "number" ? v : Number(v ?? 0) || 0);

type PitchRow = {
  id: string;
  rep_id: string;
  session_id: string | null;
  recorded_at: string;
  duration_s: number | null;
  audio_url: string | null;
  transcript: string | null;
  outcome: PitchRecordingRow["outcome"];
  base: number | string;
  bonus: number | string;
  violations: number | string;
  total: number | string;
  qualifying: boolean;
  not_qualifying_reason: string | null;
};

const LIST_LIMIT = 100;

/**
 * A rep's recordings, newest first — guide item 1.
 *
 * `patternMoments` counts the rep's OPEN patterns that this pitch actually missed, not every miss
 * in it. The board's list says "3 pattern moments" beside a recording, and a manager opening it
 * expects three brown markers; counting all misses would promise markers that are not there.
 */
export async function readPitchRecordings(
  args: { repId: string; limit?: number },
  db?: SupabaseClient
): Promise<{ rows: PitchRecordingRow[]; capped: boolean; total: number } | null> {
  const supabase = db ?? (await createServerClient());
  const limit = args.limit ?? LIST_LIMIT;

  /**
   * `count: "exact"` rides on the same request, so the page and the true total cannot disagree.
   *
   * WHY A TOTAL AT ALL. The design's list header reads "RECENT RECORDINGS · 7 all time", and
   * `rows.length` cannot supply that number: this read is bounded, and the surface already says so
   * ("Showing the most recent 100"). For any rep with more, `rows.length` is 100, and "100 all
   * time" would be the exact false claim three of today's builds removed — a page presented as
   * the whole set.
   */
  const { data, error, count } = await supabase
    .from("pitch_scores")
    .select(
      "id, rep_id, session_id, recorded_at, duration_s, audio_url, outcome, base, bonus, violations, total, qualifying, not_qualifying_reason",
      { count: "exact" }
    )
    .eq("rep_id", args.repId)
    .order("recorded_at", { ascending: false })
    .limit(limit);
  if (error || !data) return null;

  const pitches = data as PitchRow[];
  if (pitches.length === 0) return { rows: [], capped: false, total: count ?? 0 };

  // The rep's OPEN patterns, so a miss on one of those items is a pattern moment.
  const { data: patternData } = await supabase
    .from("patterns")
    .select("item_id")
    .eq("rep_id", args.repId)
    .is("fixed_at", null);
  const openItems = new Set((patternData ?? []).map((p: { item_id: string }) => p.item_id));

  // One read of the missed elements across every listed pitch, rather than one per row.
  const { data: missed } = await supabase
    .from("pitch_score_elements")
    .select("pitch_id, element_id")
    .in("pitch_id", pitches.map((p) => p.id))
    .eq("grade", "missed");

  const patternCount = new Map<string, number>();
  for (const m of (missed ?? []) as Array<{ pitch_id: string; element_id: string }>) {
    if (!openItems.has(m.element_id)) continue;
    patternCount.set(m.pitch_id, (patternCount.get(m.pitch_id) ?? 0) + 1);
  }

  return {
    rows: pitches.map((p) => ({
      pitchId: p.id,
      repId: p.rep_id,
      recordedAt: p.recorded_at,
      durationS: p.duration_s,
      outcome: p.outcome,
      total: num(p.total),
      band: p.qualifying ? bandFor(num(p.total)) : null,
      qualifying: p.qualifying,
      notQualifyingReason: p.not_qualifying_reason,
      patternMoments: patternCount.get(p.id) ?? 0,
      hasAudio: Boolean(p.audio_url),
    })),
    capped: pitches.length >= limit,
    // `count` is null when PostgREST declines to count. The page length is the fallback, and in
    // that case it is equal by construction rather than by assumption.
    total: count ?? pitches.length,
  };
}

/**
 * One recording, with everything the player needs — guide items 3, 4 and 5.
 *
 * The transcript has two possible sources and they are not equal. `coaching_transcript_segments`
 * carries speaker, seq and a wall clock, so its lines can be placed against the recording exactly.
 * `pitch_scores.transcript` is a flattened copy with neither. When the segments exist the panel is
 * exact; when only the flat text does, `linesApproximate` says so rather than the surface guessing.
 */
export async function readPitchRecordingDetail(
  args: { pitchId: string },
  db?: SupabaseClient
): Promise<PitchRecordingDetail | null> {
  const supabase = db ?? (await createServerClient());

  const { data, error } = await supabase
    .from("pitch_scores")
    .select(
      "id, rep_id, session_id, recorded_at, duration_s, audio_url, transcript, outcome, base, bonus, violations, total, qualifying, not_qualifying_reason"
    )
    .eq("id", args.pitchId)
    .maybeSingle();
  if (error || !data) return null;
  const pitch = data as PitchRow;

  const [elementsRes, eventsRes, commentsRes, patternsRes] = await Promise.all([
    supabase
      .from("pitch_score_elements")
      .select("id, element_id, grade, points, timestamp_s, evidence")
      .eq("pitch_id", pitch.id),
    supabase
      .from("pitch_score_events")
      .select("id, type, item_id, points, timestamp_s, evidence")
      .eq("pitch_id", pitch.id),
    supabase
      .from("recording_comments")
      .select("id, timestamp_s, body, created_at")
      .eq("pitch_id", pitch.id)
      .order("timestamp_s", { ascending: true }),
    supabase.from("patterns").select("item_id").eq("rep_id", pitch.rep_id).is("fixed_at", null),
  ]);

  const moments = keyMoments({
    elements: ((elementsRes.data ?? []) as Array<Record<string, unknown>>).map((e) => ({
      id: String(e.id),
      elementId: String(e.element_id),
      grade: e.grade as Grade,
      points: num(e.points),
      timestampS: e.timestamp_s === null || e.timestamp_s === undefined ? null : num(e.timestamp_s),
      evidence: (e.evidence as string | null) ?? null,
    })),
    events: ((eventsRes.data ?? []) as Array<Record<string, unknown>>).map((e) => ({
      id: String(e.id),
      type: e.type as "bonus" | "violation",
      itemId: String(e.item_id),
      points: num(e.points),
      timestampS: e.timestamp_s === null || e.timestamp_s === undefined ? null : num(e.timestamp_s),
      evidence: (e.evidence as string | null) ?? null,
    })),
    patternItemIds: ((patternsRes.data ?? []) as Array<{ item_id: string }>).map((p) => p.item_id),
    comments: ((commentsRes.data ?? []) as Array<Record<string, unknown>>).map((c) => ({
      id: String(c.id),
      timestampS: num(c.timestamp_s),
      body: String(c.body),
      authorLabel: `Comment · ${new Date(String(c.created_at)).toLocaleDateString()}`,
    })),
  });

  // Exact lines when the session's segments exist; flat text otherwise.
  let lines: TimedLine[] = [];
  let approximate = true;
  if (pitch.session_id) {
    const { data: segs } = await supabase
      .from("coaching_transcript_segments")
      .select("speaker, text, seq, spoken_at")
      .eq("session_id", pitch.session_id)
      .order("seq", { ascending: true });
    if (segs && segs.length > 0) {
      lines = timedLines(
        (segs as Array<Record<string, unknown>>).map((s) => ({
          speaker: String(s.speaker),
          text: String(s.text),
          seq: num(s.seq),
          spokenAt: (s.spoken_at as string | null) ?? null,
        })),
        pitch.recorded_at
      );
      // Exact only if at least one line could actually be placed.
      approximate = lines.every((l) => l.atSeconds === null);
    }
  }
  if (lines.length === 0 && pitch.transcript) {
    lines = pitch.transcript
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean)
      .map((text) => ({ speaker: "unknown" as const, text, atSeconds: null }));
    approximate = true;
  }

  return {
    pitchId: pitch.id,
    repId: pitch.rep_id,
    recordedAt: pitch.recorded_at,
    durationS: pitch.duration_s,
    audioUrl: pitch.audio_url,
    total: num(pitch.total),
    base: num(pitch.base),
    bonus: num(pitch.bonus),
    violations: num(pitch.violations),
    band: pitch.qualifying ? bandFor(num(pitch.total)) : null,
    outcome: pitch.outcome,
    moments,
    coverage: momentCoverage(moments),
    lines,
    linesApproximate: approximate,
  };
}
