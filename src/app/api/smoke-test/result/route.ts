import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { readBody, SmokeTestResultSchema } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { emitMentionEvents } from "@/lib/mentions/emit";

/**
 * POST /api/smoke-test/result — submit a single test item result.
 *
 * §3.1 append-only: a re-test by the same tester inserts a NEW row
 * rather than updating the prior one. The trigger emits a smoke_test
 * .{pass,fail,unable} event into the chain for every insert; fail
 * and unable derive signals via the 0018 signal_sources mappings.
 *
 * Notes are required for fail + unable per UI; the API also enforces
 * a minimum 5 chars on those paths so the chain accumulates real
 * substance, not empty markers.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "smoke-test-result",
    windowMs: 60_000,
    max: 60,
  });
  if (limited) return limited;

  if (!supabaseEnabled) {
    return NextResponse.json(
      { error: "Live mode required." },
      { status: 400 }
    );
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (!profile?.company_id) {
    return NextResponse.json(
      { error: "Complete onboarding first." },
      { status: 400 }
    );
  }

  const body = await readBody(req, SmokeTestResultSchema);
  if (body instanceof NextResponse) return body;

  // Substance gate — fail / unable without notes is empty signal.
  if (
    (body.status === "fail" || body.status === "unable") &&
    (body.notes?.trim().length ?? 0) < 5
  ) {
    return NextResponse.json(
      {
        error:
          "Notes (≥5 chars) are required for fail or unable so the chain captures real substance.",
      },
      { status: 400 }
    );
  }

  // Verify the version exists + is in this company (defense-in-depth
  // beyond RLS; helps return a clear error rather than a 0-row insert).
  const { data: version } = await supabase
    .from("smoke_test_versions")
    .select("id, company_id")
    .eq("id", body.version_id)
    .maybeSingle();
  if (!version || version.company_id !== profile.company_id) {
    return NextResponse.json(
      { error: "Version not found." },
      { status: 404 }
    );
  }

  const { data, error } = await supabase
    .from("smoke_test_results")
    .insert({
      company_id: profile.company_id,
      version_id: body.version_id,
      item_id: body.item_id,
      tester_id: auth.user.id,
      status: body.status,
      notes: body.notes ?? "",
      feedback_id: body.feedback_id ?? null,
    })
    .select("id, status, created_at")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Insert failed." },
      { status: 500 }
    );
  }

  // @mentions in the notes become §3.1 chain events tying tester →
  // tagged teammate → this result row. Non-fatal on failure.
  await emitMentionEvents({
    supabase,
    companyId: profile.company_id,
    actorId: auth.user.id,
    bodyText: body.notes ?? "",
    sourceKind: "smoke_test_result",
    sourceId: data.id,
  });

  return NextResponse.json({ id: data.id, status: data.status });
}
