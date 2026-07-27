import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";
import { getSalesKnowledgeBase } from "@/lib/coach/v5/salesKnowledgeBase";

/**
 * Sales Coach → Settings context (Phase 4).
 *
 * Returns the current user's account + Sales Coach role, whether they're
 * a manager (admin tabs), and the methodology-corpus status (admin-
 * relevant). §A10 — everything here is the user's own / their config,
 * shown to them. §3.4 — corpus status is the real loaded state, not a
 * fabricated metric.
 */
export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { data: profile } = await sb
    .from("profiles")
    .select("full_name, role, sales_coach_role")
    .eq("id", auth.user.id)
    .maybeSingle();

  const role = (profile?.role as string | null) ?? null;
  const salesCoachRole = (profile?.sales_coach_role as string | null) ?? null;
  const isManager = isSalesCoachManager({ role, sales_coach_role: salesCoachRole, company_id: null });

  // Methodology corpus status (admin-relevant, real loaded state).
  const kb = getSalesKnowledgeBase();
  const corpus = {
    loaded: kb.length > 0,
    words: kb ? kb.split(/\s+/).filter(Boolean).length : 0,
  };

  return NextResponse.json({
    account: {
      fullName: profile?.full_name ?? null,
      companyRole: role,
      salesCoachRole,
    },
    isManager,
    corpus,
  });
}
