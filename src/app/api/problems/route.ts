import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

async function getCtx() {
  if (!supabaseEnabled) return { error: "Live mode required." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Not authenticated" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (!profile?.company_id) return { error: "Complete onboarding first." };
  return { supabase, companyId: profile.company_id };
}

/**
 * POST /api/problems — create a draft problem hypothesis.
 * Body: { kind, title, diagnosis?, signalIds?: string[] }
 *
 * Draft problems do NOT pass the Understanding Gate yet — they are a notepad for
 * a hypothesis being assembled. Linking signals + writing the diagnosis is the
 * work that earns the right to surface. When the user later updates status to
 * 'surfaceable' or 'surfaced', the DB trigger evaluates the gate; failure there
 * is the structural protection §3.2 demands.
 */
export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: 400 });

  const body = await req.json();
  const { kind, title, diagnosis, signalIds } = body;
  if (typeof kind !== "string" || !kind.trim()) {
    return NextResponse.json({ error: "kind is required" }, { status: 400 });
  }
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from("problems")
    .insert({
      company_id: ctx.companyId,
      kind,
      title,
      diagnosis: diagnosis ?? null,
      status: "draft",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (Array.isArray(signalIds) && signalIds.length > 0) {
    const links = signalIds.map((sid: string) => ({
      problem_id: data.id,
      signal_id: sid,
      weight: 1.0,
    }));
    const { error: linkErr } = await ctx.supabase
      .from("problem_signals")
      .insert(links);
    if (linkErr) {
      return NextResponse.json({ error: linkErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ problemId: data.id });
}

/**
 * PATCH /api/problems — update title/diagnosis OR transition status.
 * If status is provided, the DB trigger enforces the Understanding Gate. The
 * application does not bypass this — a 500 from this endpoint with the trigger
 * exception message is the gate refusing to admit the change. That's the correct
 * behavior.
 */
export async function PATCH(req: NextRequest) {
  const ctx = await getCtx();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: 400 });

  const body = await req.json();
  const { id, title, diagnosis, status, dismissalReason } = body;
  if (typeof id !== "string") {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof title === "string") patch.title = title;
  if (typeof diagnosis === "string") patch.diagnosis = diagnosis;
  if (typeof status === "string") patch.status = status;
  if (status === "dismissed" && typeof dismissalReason === "string") {
    patch.dismissal_reason = dismissalReason;
    patch.dismissed_at = new Date().toISOString();
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  // Per TT.md A21 audit (2026-06-18) HIGH finding — until this fix, the
  // route returned { ok: true } even when zero rows were updated. RLS
  // silently dropping a cross-tenant problem-id (or a deleted problem)
  // was indistinguishable from success. Honest fix: select() the
  // updated row(s) and verify count > 0; otherwise 404.
  const { data: updated, error } = await ctx.supabase
    .from("problems")
    .update(patch)
    .eq("id", id)
    .select("id");

  if (error) {
    // Distinguish gate refusals from real errors for the UI.
    const isGateHold = /Understanding Gate/i.test(error.message);
    return NextResponse.json(
      { error: error.message, gateHold: isGateHold },
      { status: isGateHold ? 422 : 500 }
    );
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json(
      {
        error:
          "Problem not found, or you don't have permission to modify it.",
      },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}

/**
 * POST /api/problems/[id]/signals — link signal_ids to a problem.
 * (Implemented here as a body action for simplicity; could be a sub-route.)
 */
export async function PUT(req: NextRequest) {
  const ctx = await getCtx();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: 400 });

  const { id, signalIds } = await req.json();
  if (typeof id !== "string" || !Array.isArray(signalIds)) {
    return NextResponse.json(
      { error: "id and signalIds[] are required" },
      { status: 400 }
    );
  }

  const links = signalIds.map((sid: string) => ({
    problem_id: id,
    signal_id: sid,
    weight: 1.0,
  }));
  const { error } = await ctx.supabase.from("problem_signals").insert(links);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
