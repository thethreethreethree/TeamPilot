import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * Ledger integrity check (0178).
 *
 * Run this after a restore — and on a schedule, so that corruption arriving any other way is caught in
 * days rather than at year-end.
 *
 * Every check here asserts something that should be IMPOSSIBLE: constraints and triggers already enforce
 * them. If one ever fails, something has bypassed the database's own guarantees, and that is worth knowing
 * on the day it happens rather than the day an auditor finds it.
 */
export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ checks: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data, error } = await sb.rpc("fin_integrity_check");

  // A check that could not RUN is not a check that PASSED. On this surface above all others, rendering an
  // error as an empty (green) list would hand back exactly the false reassurance the feature exists to
  // destroy.
  if (error) {
    console.error("[finance/integrity] check could not run:", error);
    return NextResponse.json(
      { error: "The integrity check could not run (see server logs). This is NOT a pass." },
      { status: 500 },
    );
  }
  return NextResponse.json({ checks: data ?? [] });
}
