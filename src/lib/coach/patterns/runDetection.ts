import type { SupabaseClient } from "@supabase/supabase-js";
import { ELEMENTS_BY_ID, RUBRIC_VERSION } from "../pitchScore/rubric";
import { detectPattern, missedOnly, type MissPredicate, type GradedPitch } from "./detect";
import { readApplicableGrades } from "./readPatterns";

/**
 * Run pattern detection for one rep. Guide Step 5: *"Run detection every time a pitch is scored."*
 *
 * THE GAP THIS CLOSES, stated plainly because it was the worst thing in the build. Pattern
 * Interrupt could read patterns and render them; nothing wrote one. So the board told a rep
 * *"nothing has been missed in 3 or more of your last 10 pitches"* — a claim — when nothing had
 * looked. That is the confident-zero this codebase has an invariant against, one layer up from
 * where the invariant can see it, and on a screen where the wrong answer reads as praise.
 *
 * SERVICE ROLE, DELIBERATELY. `patterns` has no insert policy: a rep cannot open a pattern about
 * themselves and a manager cannot fabricate one. Detection is the only writer, it runs server-side
 * after a score is stored, and `companyId` is passed explicitly because the service role has no
 * RLS to fall back on.
 *
 * IDEMPOTENT BY CONSTRUCTION, not by checking first. The partial unique index
 * `(company_id, rep_id, item_id) where fixed_at is null` means a second run for the same miss
 * cannot create a second row — the insert conflicts and is ignored. That matters because this runs
 * on EVERY scored pitch: a rep with a standing pattern would otherwise accumulate one duplicate
 * per pitch, their chip count would climb on its own, and a manager would coach the same thing
 * five times. Getting this from the schema rather than from a read-then-write also removes the
 * race between two pitches scored seconds apart.
 *
 * A REOPENED PATTERN IS A NEW ROW. The index is partial on `fixed_at is null`, so a fixed pattern
 * does not block a fresh detection of the same item later. That is intended: "fixed in March, back
 * in June" is two events in a rep's history, not one row toggling, and the first one keeps its
 * days-to-fix and its points-recovered credit (§3.1).
 */

export type DetectionResult = {
  /** Items examined — every rubric item this rep has at least one graded instance of. */
  examined: number;
  /** Items that met the threshold this run, including ones already open. */
  detected: number;
  /** Rows the database actually accepted. Lower than `detected` when a pattern was already open. */
  opened: number;
};

/**
 * @param db MUST be a service-role client. A caller-scoped one will silently write nothing,
 *           because there is no insert policy for it to satisfy.
 */
export async function runDetection(
  args: {
    companyId: string;
    repId: string;
    isMiss?: MissPredicate;
    /** Injected for tests; the caller never passes it. */
    gradesByItem?: ReadonlyMap<string, readonly GradedPitch[]>;
  },
  db: SupabaseClient
): Promise<DetectionResult> {
  const isMiss = args.isMiss ?? missedOnly;
  const gradesByItem = args.gradesByItem ?? (await readApplicableGrades({ repId: args.repId }, db));

  const rows: Array<Record<string, unknown>> = [];
  let detected = 0;

  for (const [itemId, graded] of gradesByItem) {
    // Only rubric ELEMENTS for now. Bonuses and violations live in `pitch_score_events`, which has
    // no grade column — a bonus is earned or absent, and "absent" is not a row, so the
    // applicable-is-row-presence rule that makes element detection honest does not hold there.
    // Detecting over them needs the rubric to say which pitches a bonus COULD have applied to,
    // and it does not. Named rather than silently skipped.
    const element = ELEMENTS_BY_ID.get(itemId);
    if (!element) continue;

    const hit = detectPattern(graded, element.points, isMiss);
    if (!hit) continue;
    detected++;

    rows.push({
      company_id: args.companyId,
      rep_id: args.repId,
      item_kind: "element",
      item_id: itemId,
      misses_at_detection: hit.misses,
      applicable_at_detection: hit.applicable,
      cost_per_pitch: hit.costPerPitch,
      strip_at_detection: hit.strip,
      rubric_version: RUBRIC_VERSION,
    });
  }

  if (rows.length === 0) {
    return { examined: gradesByItem.size, detected: 0, opened: 0 };
  }

  // `ignoreDuplicates` is the whole idempotency story: an existing OPEN pattern for this item
  // conflicts on the partial unique index and is left exactly as it was — its frozen detection
  // facts, its coaching history and its first_seen date all survive. Re-detecting must never
  // restate what a pattern looked like when it opened, or "first seen Sep 14" would creep forward
  // every time the rep pitched and the days-open column would never grow.
  const { data, error } = await db
    .from("patterns")
    .upsert(rows, { onConflict: "company_id,rep_id,item_id", ignoreDuplicates: true })
    .select("id");

  if (error) {
    // Logged, not thrown. Detection is a side effect of scoring: a rep whose score saved fine must
    // not be told the pitch failed because a pattern could not be written.
    //
    // §A34 in its literal case, not by analogy. The window between this code deploying and 0258
    // being applied is real and is not controlled by the author who assumes it away — and in that
    // window `patterns` does not exist, so this upsert fails with 42P01 on every scored pitch.
    // A34's rule for a read is DEGRADE to pre-migration semantics; the equivalent for this write
    // is to leave scoring exactly as it was before Pattern Interrupt existed, which is what
    // catching here does. The alternative is every rep in the company unable to score a pitch
    // because a feature they cannot see is not finished installing.
    console.error(
      `[runDetection] failed rep=${args.repId} company=${args.companyId}: ${error.message}`
    );
    return { examined: gradesByItem.size, detected, opened: 0 };
  }

  const opened = data?.length ?? 0;

  // NO 'detected' EVENT, and the reason is the guide rather than an oversight. Its six kinds are
  // coached, drill_assigned, note, rep_reviewed, clip_disputed, fixed — all six are things a HUMAN
  // did. Detection is not one of them: the row's own `first_seen` is when it was found, which is
  // what the board prints ("first seen Sep 14") and what the OPEN column counts days from.
  //
  // Caught by writing the insert and then re-reading 0258's CHECK constraint, which would have
  // rejected 'detected' at runtime — on a path that runs after a score is already saved, so the
  // failure would have been a log line nobody reads rather than a broken request. Worth saying
  // out loud: the earlier draft of this migration DID have a 'detected' kind, it was removed when
  // the guide's list replaced my invented one, and this code was written from the memory of the
  // draft rather than from the file.

  return { examined: gradesByItem.size, detected, opened };
}
