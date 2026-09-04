import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";
import { removeRecordingAudio } from "@/lib/coach/v5/removeRecordingAudio";

/**
 * POST /api/coach/sales-session/[id]/delete-recording — remove one recording's audio, on request.
 *
 * WHY THIS EXISTS. Until now the product had NO way to delete a specific recording. Not for a representative, not
 * for a manager, not for an administrator: the only removal was the nightly retention job. That was found while
 * writing the privacy policy — the founder described a policy ("a rep cannot delete their own; managers and
 * admins can") and the code implemented neither half of it. This is the half that grants the control.
 *
 * AUTHZ: MANAGERS AND ADMINISTRATORS ONLY, and the owning representative is deliberately NOT included. That is
 * the founder's stated rule, and unlike most authz choices it is asymmetric on purpose: a recording is evidence of
 * how a call was handled, and a rep who could delete their own worst call could curate what their manager sees.
 * `save-recording` reaches the opposite conclusion for the opposite reason — keeping a call harms nobody.
 *
 * WHAT IS DELETED, AND WHAT IS NOT. The audio bytes, and the orphaned chunk objects. The TRANSCRIPT, the scores
 * and the coaching notes stay: they are what the rep's skill profile is built from, and deleting them would
 * silently rewrite months of somebody's measured progress. This mirrors the retention job, which drops the
 * recording rather than the coaching.
 *
 * THE DELETION IS ORDERED BYTES-FIRST, POINTER-SECOND, and never the other way round. Clearing the column first
 * would leave the audio alive and unreachable if the storage call then failed — a recording of a real customer
 * that nobody can find and nothing will ever clean up. `removeRecordingAudio` refuses to report success unless
 * the bytes are actually gone, and this route refuses to clear the pointer unless it did.
 *
 * ADMIN CLIENT FOR THE WRITE, authz enforced in code first — the same pattern and the same reason as
 * `save-recording`: a `sales_coach_role=admin` manager is not covered by the `coaching_sessions` RLS update
 * policy (owner + company-admin only), so the check above the write is what makes the write safe.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "coach-delete-recording", windowMs: 60_000, max: 20 });
  if (limited) return limited;

  const { id } = await context.params;
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: profile } = await sb
    .from("profiles")
    .select("company_id, role, sales_coach_role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const companyId = profile?.company_id as string | undefined;
  if (!companyId) {
    return NextResponse.json({ error: "Complete onboarding first." }, { status: 403 });
  }

  // Read BEFORE checking the role, so a cross-company caller gets the same 404 a manager would — never a 403
  // that confirms another tenant's session exists.
  const admin = createAdminClient();
  const { data: session } = await admin
    .from("coaching_sessions")
    .select("id, company_id, audio_asset_url")
    .eq("id", id)
    .maybeSingle();
  if (!session || session.company_id !== companyId) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  if (
    !isSalesCoachManager({
      role: profile?.role ?? null,
      sales_coach_role: profile?.sales_coach_role ?? null,
      company_id: companyId,
    })
  ) {
    // Named plainly rather than hidden behind a generic refusal: a rep who tries this is not doing anything
    // wrong, and "you cannot" without "who can" leaves them with nowhere to go.
    return NextResponse.json(
      { error: "Only a manager or an administrator can delete a recording." },
      { status: 403 },
    );
  }

  const audioAssetUrl = session.audio_asset_url as string | null;
  if (!audioAssetUrl) {
    // Already gone — by the nightly rule, or by an earlier delete. The end state the caller asked for already
    // holds, so this is a success rather than an error, and it is idempotent for a double-tap.
    return NextResponse.json({ deleted: true, alreadyGone: true });
  }

  const removal = await removeRecordingAudio(admin.storage, {
    audioAssetUrl,
    companyId: session.company_id as string | null,
    sessionId: session.id as string,
  });

  if (!removal.ok) {
    if (removal.reason === "malformed-pointer") {
      // We cannot tell whether the object exists, so we must not clear the pointer and claim a deletion. This is
      // a data-integrity signal worth a log line rather than a silent 500.
      console.error("[delete-recording] unrecognised audio_asset_url shape on session", id);
      return NextResponse.json(
        { error: "This recording is stored in a way we cannot delete automatically. It has been flagged." },
        { status: 409 },
      );
    }
    console.error("[delete-recording] storage refused:", removal.message);
    return NextResponse.json({ error: "Couldn't delete the recording. Nothing was changed." }, { status: 500 });
  }

  // The bytes are gone. Only now does the pointer go, and `recording_saved` goes with it — leaving a deleted
  // recording flagged as "saved" would show a Saved badge on a session with no audio behind it.
  const { data: updated, error } = await admin
    .from("coaching_sessions")
    .update({ audio_asset_url: null, recording_saved: false, recording_saved_by: null, recording_saved_at: null })
    .eq("id", id)
    .eq("company_id", companyId)
    .select("id");
  if (error) {
    // The audio is already gone at this point, so this is a pointer left behind rather than a failed deletion.
    // Said honestly: retrying is safe and will converge, because the removal treats a missing object as success.
    console.error("[delete-recording] audio removed but the row was not cleared:", error);
    return NextResponse.json(
      { error: "The recording was deleted but the session still refers to it. Try again." },
      { status: 500 },
    );
  }
  if (!updated || updated.length === 0) {
    // Zero rows means the row moved or vanished between the read and the write. Reporting success would be a
    // phantom on a deletion control.
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  return NextResponse.json({ deleted: true, chunksRemoved: removal.chunksRemoved });
}
