import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { rateLimit } from "@/lib/api/rateLimit";

/**
 * POST /api/pilot/validate — non-consuming check of a pilot access code.
 * Body: { code: string }
 * Returns: { valid: boolean, module?: 'elostate'|'care'|'sales_coach', redeemed?: boolean }
 *
 * Lets the /redeem UI confirm a code + show its module BEFORE the client creates
 * an account, without consuming the code. Backed by the SECURITY DEFINER
 * pilot_code_status() (0197), which returns only {valid, module, redeemed} — no
 * other columns leak. Rate-limited to blunt enumeration (the keyspace is 30^7 with
 * 100 valid codes, so this is defense-in-depth, not the primary barrier).
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "pilot-validate", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  if (!supabaseEnabled) {
    return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  }
  const { code } = await req.json().catch(() => ({}));
  if (typeof code !== "string" || code.trim().length === 0) {
    return NextResponse.json({ error: "Access code required." }, { status: 400 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pilot_code_status", { p_code: code });
  if (error) {
    return NextResponse.json({ error: "Couldn't check that code." }, { status: 500 });
  }
  return NextResponse.json(data ?? { valid: false });
}
