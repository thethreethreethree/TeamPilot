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

  const { error } = await supabase
    .from("resolutions")
    .update({
      observed_outcome: observedOutcome,
      durability,
      reviewed_at: new Date().toISOString(),
      reviewer: auth.user.id,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
