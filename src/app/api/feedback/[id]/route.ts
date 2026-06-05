import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { readBody, FeedbackStatusPatchSchema } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";

/**
 * PATCH /api/feedback/[id] — status transition.
 *
 * Triage actions: open → triaged → in_progress → resolved / declined.
 * Or → duplicate (with required duplicate_of pointer).
 *
 * The 0018 trigger emits a `feedback.status_changed` event on each
 * transition, so the journey is preserved on the §3.1 record. Per
 * §3.5, transitions to 'resolved' are tracked for durability — if a
 * similar report comes back within N days, the "fix" is considered
 * reopened.
 *
 * Role gating: any company member can submit feedback (POST). Status
 * transitions are restricted to admins at the application layer. We
 * could enforce this in RLS but the role taxonomy is still settling
 * (see docs/AMD-* future); keeping the gate in the route lets us
 * evolve roles without re-migrating RLS.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, {
    id: "feedback-patch",
    windowMs: 60_000,
    max: 60,
  });
  if (limited) return limited;

  const { id } = await params;
  if (!supabaseEnabled) {
    return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (!profile?.company_id) {
    return NextResponse.json(
      { error: "Complete onboarding first." },
      { status: 400 }
    );
  }
  if (profile.role !== "admin" && profile.role !== "CEO" && profile.role !== "COO") {
    return NextResponse.json(
      { error: "Only admins can triage feedback." },
      { status: 403 }
    );
  }

  const body = await readBody(req, FeedbackStatusPatchSchema);
  if (body instanceof NextResponse) return body;

  // Set the appropriate timestamp + actor field for the status the
  // admin chose. The trigger uses these to populate the event payload.
  const update: Record<string, unknown> = { status: body.status };
  if (body.status === "triaged") {
    update.triaged_by = auth.user.id;
    update.triaged_at = new Date().toISOString();
  }
  if (body.status === "resolved" || body.status === "declined") {
    update.resolved_by = auth.user.id;
    update.resolved_at = new Date().toISOString();
    update.resolution_note = body.resolution_note ?? null;
  }
  if (body.status === "duplicate") {
    if (!body.duplicate_of) {
      return NextResponse.json(
        { error: "duplicate_of is required when status='duplicate'." },
        { status: 400 }
      );
    }
    update.duplicate_of = body.duplicate_of;
  }

  const { data, error } = await supabase
    .from("feedback")
    .update(update)
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .select("id, status")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Update failed." },
      { status: 500 }
    );
  }
  return NextResponse.json({ id: data.id, status: data.status });
}
