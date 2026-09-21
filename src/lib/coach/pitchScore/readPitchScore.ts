import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { BONUSES_BY_ID, ELEMENTS_BY_ID, SECTIONS, VIOLATIONS_BY_ID, type SectionId } from "./rubric";
import { replayDisputes, type DisputeEventRow, type DisputeRow } from "./readDisputes";

/**
 * Read back a stored Pitch Score with its evidence — the other half of storePitchScore.
 *
 * Read through the CALLER's client, not the service role. `pitch_scores` RLS already says who may see
 * a score (the rep who gave it, or a manager in the same company), and reading with the service
 * role would replace that rule with whatever the route remembered to check. A phone caller sends
 * a Bearer token and no cookie, so the default client would read as anonymous, find nothing, and
 * report an honest-looking "not scored yet" for a pitch that exists — the confident-zero shape
 * this codebase has an invariant against.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO: recompute anything. Section totals come from the stored
 * verdict, not from summing the element rows, because on an objection-free pitch those rows are
 * at raw rubric weight and Delivery was scaled — summing them would show a number that disagrees
 * with the score on the same screen. That is the defect 0254 exists to fix, and re-introducing it
 * on the read side would defeat the fix entirely.
 */

export type PitchElementRow = {
  elementId: string;
  /** The rubric's label, resolved here so every screen shows the same words. */
  label: string;
  section: SectionId | null;
  grade: "hit" | "partial" | "missed";
  /** Raw rubric weight. NOT scaled — see sectionPoints for the figure that sums to base. */
  points: number;
  maxPoints: number | null;
  timestampS: number | null;
  evidence: string | null;
};

export type PitchEventRow = {
  type: "bonus" | "violation" | "rejected_bonus";
  itemId: string;
  points: number;
  timestampS: number | null;
  evidence: string | null;
  confidence: number | null;
};

export type PitchOverrideRow = {
  id: string;
  itemType: "element" | "bonus" | "violation";
  itemId: string;
  /** The rubric's label for the item, so the row reads without a lookup. */
  itemLabel: string;
  oldValue: string | null;
  newValue: string;
  /** Required by the table's CHECK — an unexplained correction cannot be stored. */
  reason: string;
  actorId: string;
  appliedAt: string;
};

export type StoredPitch = {
  id: string;
  repId: string;
  sessionId: string | null;
  recordedAt: string;
  durationS: number | null;
  audioUrl: string | null;
  outcome: string | null;
  base: number;
  bonus: number;
  violations: number;
  total: number;
  band: string | null;
  qualifying: boolean;
  notQualifyingReason: string | null;
  deliveryScaled: boolean;
  rubricVersion: string;
  /** Per-section totals as the scorer decided them, post-scaling. These sum to `base`. */
  sectionPoints: { id: SectionId; label: string; points: number; maxPoints: number }[];
  elements: PitchElementRow[];
  events: PitchEventRow[];
  /**
   * Manager corrections applied to this pitch, newest first.
   *
   * Read by the REP as well as the manager, and that is the whole point. The rubric requires the
   * change to be logged; a log the person whose score changed cannot see is not a log, it is a
   * silent correction — the exact thing an audit trail exists to rule out. `pitch_score_overrides`
   * RLS grants select to the rep or a manager for that reason.
   */
  overrides: PitchOverrideRow[];
  /**
   * The rep's own disputes on this pitch, with any manager reply.
   *
   * Here rather than on a separate endpoint because the answer is only useful beside the grade it
   * is about — a rep who has to go somewhere else to find out whether anyone replied will assume
   * nobody did. Replayed by the SAME function the manager's queue uses, so the two sides cannot
   * disagree about whether a thread is still open.
   */
  disputes: DisputeRow[];
};

const num = (v: unknown): number => (typeof v === "number" ? v : Number(v ?? 0) || 0);

export async function readPitchScore(
  sessionId: string,
  client?: SupabaseClient
): Promise<StoredPitch | null> {
  const sb = client ?? (await createServerClient());

  const { data: pitch, error } = await sb
    .from("pitch_scores")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) {
    // Classified, not swallowed into a value. An error read as "no pitch" would tell a rep their
    // pitch was never scored when in fact the read failed — the error-as-no-data class this
    // codebase has an invariant against. Null is returned only after the error is on the record.
    // eslint-disable-next-line no-console
    console.error(`[readPitchScore] read failed session=${sessionId}: ${error.message}`);
    return null;
  }
  if (!pitch) return null;

  const pitchId = pitch.id as string;

  const [{ data: elementRows }, { data: eventRows }, { data: overrideRows }, { data: disputeEvents }] =
    await Promise.all([
    sb.from("pitch_score_elements").select("*").eq("pitch_id", pitchId),
    sb.from("pitch_score_events").select("*").eq("pitch_id", pitchId),
    // Through the CALLER's client, like everything else here. `events` RLS is company-wide, but
    // the caller has already proven they may see THIS pitch, and the subject filter keeps the read
    // to this pitch's threads. Ascending, because the replay needs answers before disputes.
    sb
      .from("pitch_score_overrides")
      .select("id, item_type, item_id, old_value, new_value, reason, actor_id, created_at")
      .eq("pitch_id", pitchId)
      .order("created_at", { ascending: false })
      .limit(100),
    sb
      .from("events")
      .select("id, actor, kind, subject, payload, created_at")
      .eq("subject", `pitch:${pitchId}`)
      .in("kind", ["coach.pitch_score_disputed", "coach.pitch_score_answered"])
      .order("created_at", { ascending: true })
      .limit(200),
  ]);

  // Rubric order, not insertion order. The model returns elements in whatever order it graded
  // them; a rep reading their pitch back expects Introduction before Close.
  const order = new Map([...ELEMENTS_BY_ID.keys()].map((id, i) => [id, i]));
  const elements: PitchElementRow[] = (elementRows ?? [])
    .map((r): PitchElementRow => {
      const def = ELEMENTS_BY_ID.get(r.element_id as string);
      return {
        elementId: r.element_id as string,
        label: def?.label ?? (r.element_id as string),
        section: def?.section ?? null,
        grade: r.grade as PitchElementRow["grade"],
        points: num(r.points),
        maxPoints: def?.points ?? null,
        timestampS: r.timestamp_s == null ? null : num(r.timestamp_s),
        evidence: (r.evidence as string | null) ?? null,
      };
    })
    .sort((a, b) => (order.get(a.elementId) ?? 999) - (order.get(b.elementId) ?? 999));

  const events: PitchEventRow[] = (eventRows ?? []).map((r) => ({
    type: r.type as PitchEventRow["type"],
    itemId: r.item_id as string,
    points: num(r.points),
    timestampS: r.timestamp_s == null ? null : num(r.timestamp_s),
    evidence: (r.evidence as string | null) ?? null,
    confidence: r.confidence == null ? null : num(r.confidence),
  }));

  const overrides: PitchOverrideRow[] = (overrideRows ?? []).map((r) => ({
    id: String(r.id),
    itemType: r.item_type as PitchOverrideRow["itemType"],
    itemId: r.item_id as string,
    // Labelled from the rubric, falling back to the raw id for an item a later rubric retired —
    // the correction happened and hiding it would leave points nothing on screen explains.
    itemLabel:
      ELEMENTS_BY_ID.get(r.item_id as string)?.label ??
      BONUSES_BY_ID.get(r.item_id as string)?.label ??
      VIOLATIONS_BY_ID.get(r.item_id as string)?.label ??
      (r.item_id as string),
    oldValue: (r.old_value as string | null) ?? null,
    newValue: r.new_value as string,
    reason: (r.reason as string) ?? "",
    actorId: String(r.actor_id ?? ""),
    appliedAt: String(r.created_at),
  }));

  // Answers first, then disputes newest-first — the order replayDisputes expects, and the order
  // a rep reads their own threads in.
  const raw = (disputeEvents ?? []) as DisputeEventRow[];
  const disputes = replayDisputes(
    [...raw.filter((r) => r.kind === "coach.pitch_score_answered"),
     ...raw.filter((r) => r.kind === "coach.pitch_score_disputed").reverse()],
    { includeAnswered: true }
  );

  // The stored verdict, presented in rubric order with labels. A pitch stored before 0254 has no
  // section_points; it gets an empty list rather than a re-summed guess, because a wrong
  // reconciliation is worse on this screen than an absent one.
  const stored = (pitch.section_points ?? null) as Record<string, unknown> | null;
  const sectionPoints = stored
    ? SECTIONS.map((s) => ({
        id: s.id,
        label: s.label,
        points: num(stored[s.id]),
        maxPoints: s.maxPoints,
      }))
    : [];

  return {
    id: pitchId,
    repId: pitch.rep_id as string,
    sessionId: (pitch.session_id as string | null) ?? null,
    recordedAt: pitch.recorded_at as string,
    durationS: pitch.duration_s == null ? null : num(pitch.duration_s),
    audioUrl: (pitch.audio_url as string | null) ?? null,
    outcome: (pitch.outcome as string | null) ?? null,
    base: num(pitch.base),
    bonus: num(pitch.bonus),
    violations: num(pitch.violations),
    total: num(pitch.total),
    band: (pitch.band as string | null) ?? null,
    qualifying: pitch.qualifying === true,
    notQualifyingReason: (pitch.not_qualifying_reason as string | null) ?? null,
    deliveryScaled: pitch.delivery_scaled === true,
    rubricVersion: pitch.rubric_version as string,
    sectionPoints,
    elements,
    events,
    overrides,
    disputes,
  };
}
