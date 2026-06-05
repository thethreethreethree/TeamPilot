import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * GET /api/smoke-test/active
 *
 * Returns the currently active smoke test version for the caller's
 * company plus the caller's own results against each item. Other
 * testers' results are NOT returned (RLS scopes selects to own_id);
 * aggregate views are reconstructed in the admin inbox via a separate
 * service-role route.
 *
 * Response shape:
 *   {
 *     version: { id, label, items: [...] } | null,
 *     myResults: { [item_id]: latest_result_row }
 *   }
 *
 * If no version is active, returns version=null. The smoke-test page
 * renders an empty-state explaining that the admin hasn't published
 * one yet.
 */
export async function GET() {
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

  const { data: version } = await supabase
    .from("smoke_test_versions")
    .select("id, label, items, created_at")
    .eq("company_id", profile.company_id)
    .eq("is_active", true)
    .maybeSingle();

  if (!version) {
    return NextResponse.json({ version: null, myResults: {} });
  }

  // Each test item has its full history (re-tests append new rows).
  // We surface the latest result per item_id to the tester so the UI
  // can show "you marked this pass on date X" without ambiguity.
  const { data: results } = await supabase
    .from("smoke_test_results")
    .select("id, item_id, status, notes, feedback_id, created_at")
    .eq("version_id", version.id)
    .eq("tester_id", auth.user.id)
    .order("created_at", { ascending: false });

  const myResults: Record<string, unknown> = {};
  for (const r of results ?? []) {
    // First (most recent) wins — subsequent older rows ignored.
    if (!myResults[r.item_id as string]) {
      myResults[r.item_id as string] = r;
    }
  }

  return NextResponse.json({ version, myResults });
}
