import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { generateWhyPatterns } from "@/lib/coach/v5/salesWhyPatterns";

/**
 * GET /api/coach/sales-session/why-patterns  (Sessions Phase 4)
 *
 * The current rep's OWN cross-session why patterns (§A18 self-view, §3.6
 * make-learning-visible). Data-gated inside generateWhyPatterns (§4): returns
 * an honest "not enough yet" until enough whys+outcomes have accumulated.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const companyId = (await getCurrentCompanyId()) ?? undefined;
  if (!companyId) {
    return NextResponse.json({ error: "No company context." }, { status: 403 });
  }

  const patterns = await generateWhyPatterns({
    companyId,
    agentId: auth.user.id,
  });
  return NextResponse.json({ patterns });
}
