import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { rateLimit } from "@/lib/api/rateLimit";

/**
 * POST /api/pilot/redeem — redeem a pilot code for the signed-in user.
 * Body: { code: string, companyName: string, fullName?: string }
 * Returns: { companyId, module, landing }
 *
 * The client signs up (supabase.auth.signUp) first, then calls this. The
 * SECURITY DEFINER redeem_pilot_code() (0197) creates the company, attaches the
 * caller as admin, provisions the code's module, skips the §3.4 control window
 * (founder-authorized pilot deviation), and marks the code used (single-use is
 * row-lock enforced in the RPC). Same auth→RPC shape as /api/team/accept.
 */

// Post-redeem landing per module (soft land-in-module). All are reachable by the
// admin regardless; this just drops them where the module lives.
const LANDING: Record<string, string> = {
  elostate: "/dashboard",
  care: "/dashboard/care",
  sales_coach: "/dashboard/sales-coach",
};

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "pilot-redeem", windowMs: 60_000, max: 10 });
  if (limited) return limited;
  if (!supabaseEnabled) {
    return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Sign in first to redeem a code." }, { status: 401 });
  }

  const { code, companyName, fullName } = await req.json().catch(() => ({}));
  if (typeof code !== "string" || code.trim().length === 0) {
    return NextResponse.json({ error: "Access code required." }, { status: 400 });
  }
  if (typeof companyName !== "string" || companyName.trim().length === 0) {
    return NextResponse.json({ error: "Company name required." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("redeem_pilot_code", {
    p_code: code,
    p_company_name: companyName,
    p_full_name: typeof fullName === "string" && fullName.trim() ? fullName : null,
  });
  if (error) {
    // The RPC raises human-readable messages ("already been used", "Invalid access
    // code", "already belongs to a company") — surface them; they're safe to show.
    return NextResponse.json({ error: error.message }, { status: 422 });
  }

  const result = (data ?? {}) as { company_id?: string; module?: string };
  const mod = result.module ?? "elostate";
  return NextResponse.json({
    companyId: result.company_id ?? null,
    module: mod,
    landing: LANDING[mod] ?? "/dashboard",
  });
}
