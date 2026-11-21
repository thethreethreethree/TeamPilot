import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A score's history: the archive a re-score writes BEFORE replacing a score, and the provenance every score
 * carries (RSS Phase 0 step 5; Gong F15.15, F15.8; migration 0272).
 *
 * WHY THE ARCHIVE COMES FIRST. `store_pitch_score` (0254:117) updates the pitch row in place and DELETES its
 * evidence rows before inserting the new grading. Without a copy taken first, a re-score erases the evidence a
 * rep may already have disputed. Decision D3 (founder, 2026-11-15): keep the old version, and FLAG earlier
 * manager overrides rather than re-apply them — an override was a judgement about a grade that may no longer
 * exist. So the archive also counts the overrides, and the route hands that count back to the manager.
 *
 * Both writes use the service role (0272 gives these tables no client write policy). The caller has already
 * decided the caller may do this; these functions decide nothing.
 */

const MISSING_TABLE = new Set(["PGRST205", "42P01"]);

export type ArchiveResult =
  | { ok: true; earlierOverrides: number }
  | { ok: false; cause: "not_found" | "not_applied" | "database" };

/** Copy the current score and its evidence into pitch_score_archive. The re-score must not run unless this is ok. */
export async function archivePitchScore(
  admin: SupabaseClient,
  args: { pitchId: string; companyId: string; archivedBy: string; reason: string }
): Promise<ArchiveResult> {
  // A verdict, never an exception: the route refuses the re-score on anything but ok.
  try {
    return await archiveOrThrow(admin, args);
  } catch (err) {
    console.error(`[scoreHistory] archive threw pitch=${args.pitchId}:`, err);
    return { ok: false, cause: "database" };
  }
}

async function archiveOrThrow(
  admin: SupabaseClient,
  args: { pitchId: string; companyId: string; archivedBy: string; reason: string }
): Promise<ArchiveResult> {
  const { pitchId, companyId } = args;
  const [pitchRes, elementsRes, eventsRes, overridesRes, provenanceRes] = await Promise.all([
    admin.from("pitch_scores").select("*").eq("id", pitchId).eq("company_id", companyId).maybeSingle(),
    admin.from("pitch_score_elements").select("*").eq("pitch_id", pitchId).eq("company_id", companyId),
    admin.from("pitch_score_events").select("*").eq("pitch_id", pitchId).eq("company_id", companyId),
    admin
      .from("pitch_score_overrides")
      .select("id", { count: "exact", head: true })
      .eq("pitch_id", pitchId)
      .eq("company_id", companyId),
    // The provenance row is replaced by the re-score, so the version it describes is kept here.
    admin.from("pitch_score_provenance").select("*").eq("pitch_score_id", pitchId).eq("company_id", companyId).maybeSingle(),
  ]);
  const readErr = pitchRes.error ?? elementsRes.error ?? eventsRes.error ?? overridesRes.error;
  // A missing provenance TABLE (0272 not applied) is reported by the insert below; any other read error is real.
  if (provenanceRes.error && !MISSING_TABLE.has(String(provenanceRes.error.code))) {
    console.error(`[scoreHistory] provenance read failed pitch=${pitchId}: ${provenanceRes.error.message}`);
    return { ok: false, cause: "database" };
  }
  if (readErr) {
    console.error(`[scoreHistory] archive read failed pitch=${pitchId}: ${readErr.message}`);
    return { ok: false, cause: "database" };
  }
  const pitch = pitchRes.data as Record<string, unknown> | null;
  if (!pitch) return { ok: false, cause: "not_found" };

  const { error } = await admin.from("pitch_score_archive").insert({
    pitch_score_id: pitchId,
    company_id: companyId,
    rep_id: pitch.rep_id,
    archived_payload: {
      pitch,
      elements: elementsRes.data ?? [],
      events: eventsRes.data ?? [],
      provenance: provenanceRes.error ? null : (provenanceRes.data ?? null),
    },
    archived_by: args.archivedBy,
    reason: args.reason.trim(),
  });
  if (error) {
    if (MISSING_TABLE.has(String(error.code))) return { ok: false, cause: "not_applied" };
    console.error(`[scoreHistory] archive insert failed pitch=${pitchId}: ${error.message}`);
    return { ok: false, cause: "database" };
  }
  return { ok: true, earlierOverrides: overridesRes.count ?? 0 };
}

/**
 * Record what produced a score. Best-effort: the score is already stored and correct, so a failure here is
 * logged, never turned into "your pitch could not be scored". One row per pitch (pitch_score_id is the key),
 * replaced on a re-score — archivePitchScore has already copied the earlier row into the archive payload.
 */
export async function recordProvenance(
  admin: SupabaseClient,
  args: {
    pitchId: string;
    companyId: string;
    repId: string;
    model: string;
    promptVersion: string;
    rubricVersion: string;
    /** Set only for a manager re-score; null/undefined means the automatic first score. */
    rescoredBy?: string | null;
  }
): Promise<boolean> {
  try {
    return await provenanceOrThrow(admin, args);
  } catch (err) {
    // Never thrown into the scorer: a provenance failure must not read as "your pitch could not be scored".
    console.error(`[scoreHistory] provenance threw pitch=${args.pitchId}:`, err);
    return false;
  }
}

async function provenanceOrThrow(admin: SupabaseClient, args: Parameters<typeof recordProvenance>[1]): Promise<boolean> {
  const { error } = await admin.from("pitch_score_provenance").upsert(
    {
      pitch_score_id: args.pitchId,
      company_id: args.companyId,
      rep_id: args.repId,
      model: args.model,
      prompt_version: args.promptVersion,
      rubric_version: args.rubricVersion,
      scored_by_kind: args.rescoredBy ? "manager_rescore" : "auto",
      scored_by: args.rescoredBy ?? null,
    },
    { onConflict: "pitch_score_id" }
  );
  if (error) {
    // Before 0272 the table does not exist; logged so the gap is visible, but scoring carries on.
    console.error(`[scoreHistory] provenance write failed pitch=${args.pitchId}: ${error.message}`);
    return false;
  }
  return true;
}
