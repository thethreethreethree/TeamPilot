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

  // WRITE-ONCE (audit 2026-07-09): the review surface PROMISES the user "you don't
  // edit prior reviews" (§A18 — the label IS the defense), and the UI enforces it by
  // hiding the button once durability is set. But this route had NO server-side guard:
  // any same-company caller could PATCH the same id repeatedly, silently OVERWRITING
  // observed_outcome/durability — corrupting the one field §3.5 names by name
  // ("resolution durability — did it reopen?"). A false immutability label over a
  // mutable write is the §3.4 failure the constitution exists to prevent. Enforce the
  // promised write-once: a resolution is reviewed exactly once. (If it later reopens,
  // that is recorded here as durability="reopened" at review time — reviews are meant
  // to run AFTER the durability window, when the signal exists.)
  const { data: existing } = await supabase
    .from("resolutions")
    .select("id, reviewed_at")
    .eq("id", id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json(
      { error: "That resolution isn't accessible, or no longer exists." },
      { status: 404 }
    );
  }
  if (existing.reviewed_at) {
    return NextResponse.json(
      {
        error:
          "This resolution has already been reviewed. Reviews are recorded once and then locked (§3.1) — a prior review can't be edited.",
      },
      { status: 409 }
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
    // Race guard: only write if still unreviewed. A concurrent double-submit that
    // passed the check above still lands exactly one review (the second matches 0 rows).
    .is("reviewed_at", null)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // §3.4 / strictUpdate (audit 2026-07-09): assert the review actually landed. RLS
  // scopes resolutions to the caller's company, so an id outside it matches 0 rows —
  // report it rather than a phantom "reviewed" (the same false-ok class already fixed
  // in the problems route). With the write-once guard above, 0 rows here means a
  // concurrent review won the race.
  if (!updated || updated.length === 0) {
    return NextResponse.json(
      { error: "This resolution was just reviewed by someone else." },
      { status: 409 }
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
      const mentions = extractFileMentions(observedOutcome);
      if (mentions.length > 0) {
        // Batch the visibility + not-deprecated check into ONE query (was an
        // N+1: a SELECT per mention). RLS still scopes this .in(), so a file the
        // user can't SELECT is excluded — same guarantee as the per-file check.
        // Behavior preserved: one citation event PER MENTION (not deduped), via
        // a visible-set filter. Same file-cite pattern as topic-decisions + chats.
        const ids = [...new Set(mentions.map((m) => m.fileId))];
        const { data: visibleFiles } = await supabase
          .from("files")
          .select("id")
          .in("id", ids)
          .is("deprecated_at", null);
        const visible = new Set((visibleFiles ?? []).map((f) => f.id as string));
        const rows = mentions
          .filter((m) => visible.has(m.fileId))
          .map((m) => ({
            company_id: companyId,
            actor: auth.user.id,
            kind: "asset.file.cited",
            subject: `file:${m.fileId}`,
            payload: { file_id: m.fileId, cited_in: `resolution:${id}` },
          }));
        if (rows.length > 0) await supabase.from("events").insert(rows);
      }
    }
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({ ok: true });
}
