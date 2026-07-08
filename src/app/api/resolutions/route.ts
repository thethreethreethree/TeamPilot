import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * PATCH /api/resolutions — fill in observed_outcome / durability for §3.5
 * measurement. action_taken / reasoning / decided_at are immutable (enforced by
 * the DB trigger from migration 0005). This endpoint can only update the review
 * fields.
 */
export async function PATCH(req: NextRequest) {
  if (!supabaseEnabled) {
    return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id, observedOutcome, durability } = await req.json();
  if (typeof id !== "string") {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  if (typeof observedOutcome !== "string" || observedOutcome.trim().length < 20) {
    return NextResponse.json(
      {
        error:
          "Observed outcome of ≥20 chars is required. State what actually happened — not 'good' or 'bad', the concrete observation.",
      },
      { status: 400 }
    );
  }
  const allowedDurability = ["held", "reopened", "partial", "unknown"];
  if (!allowedDurability.includes(durability)) {
    return NextResponse.json(
      { error: `durability must be one of: ${allowedDurability.join(", ")}` },
      { status: 400 }
    );
  }

  const { data: updated, error } = await supabase
    .from("resolutions")
    .update({
      observed_outcome: observedOutcome,
      durability,
      reviewed_at: new Date().toISOString(),
      reviewer: auth.user.id,
    })
    .eq("id", id)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // §3.4 / strictUpdate (audit 2026-07-09): assert the review actually landed. RLS
  // scopes resolutions to the caller's company, so an id outside it matches 0 rows —
  // report it rather than a phantom "reviewed" (the same false-ok class already fixed
  // in the problems route).
  if (!updated || updated.length === 0) {
    return NextResponse.json(
      { error: "That resolution isn't accessible, or no longer exists." },
      { status: 404 }
    );
  }

  // Asset System v1 — emit asset.file.cited for every @file mention
  // in the observed outcome. Per §1.6 (close the loop): resolution
  // reviews are the canonical close-the-loop moment. Citations from
  // here say "this file informed how I evaluated the outcome" — the
  // strongest asset-value signal in the §4 readout.
  // Per 2026-06-19 audit Finding #4: verify SELECT access on each
  // file before emitting so unauthorized markers can't pollute the
  // citation rate metric.
  try {
    const { extractFileMentions } = await import("@/lib/files/fileMention");
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", auth.user.id)
      .maybeSingle();
    const companyId = (profile?.company_id as string | undefined) ?? null;
    if (companyId) {
      for (const m of extractFileMentions(observedOutcome)) {
        const { data: fileCheck } = await supabase
          .from("files")
          .select("id")
          .eq("id", m.fileId)
          .is("deprecated_at", null)
          .maybeSingle();
        if (!fileCheck) continue;
        await supabase.from("events").insert({
          company_id: companyId,
          actor: auth.user.id,
          kind: "asset.file.cited",
          subject: `file:${m.fileId}`,
          payload: {
            file_id: m.fileId,
            cited_in: `resolution:${id}`,
          },
        });
      }
    }
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({ ok: true });
}
