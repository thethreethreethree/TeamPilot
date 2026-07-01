import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import {
  generateWhyPatterns,
  gatherWhyPairs,
  storeWhyPatterns,
  readStoredWhyPatterns,
  MIN_WHYS,
} from "@/lib/coach/v5/salesWhyPatterns";

/**
 * /api/coach/sales-session/why-patterns  (Sessions Phase 4)
 *
 * The current rep's OWN cross-session why patterns (§A18 self-view, §3.6).
 *
 * F1 (§5) — patterns are NO LONGER generated on load. GET serves the last
 * STORED set (cheap: two indexed reads, no LLM) plus a cheap count of
 * available whys, so the card can show "new sessions since — refresh".
 * POST regenerates (the one place that pays for the LLM) and stores the
 * result — fired only by an explicit refresh/generate action.
 */

async function resolve() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return { ok: false as const, status: 401 as const };
  const companyId = (await getCurrentCompanyId()) ?? null;
  if (!companyId) return { ok: false as const, status: 403 as const };
  return { ok: true as const, agentId: auth.user.id, companyId };
}

export async function GET() {
  const ctx = await resolve();
  if (!ctx.ok) {
    return NextResponse.json(
      { error: ctx.status === 401 ? "Not authenticated." : "No company context." },
      { status: ctx.status }
    );
  }
  // Cheap: current available whys + the last stored set. No LLM.
  const [pairs, stored] = await Promise.all([
    gatherWhyPairs({ companyId: ctx.companyId, agentId: ctx.agentId }),
    readStoredWhyPatterns(ctx.agentId),
  ]);
  const whysAvailable = pairs.length;
  return NextResponse.json({
    stored,
    whysAvailable,
    gateMet: whysAvailable >= MIN_WHYS,
    // New whys exist beyond what the stored set analyzed → offer a refresh.
    stale: stored ? whysAvailable > stored.whysAnalyzed : false,
  });
}

export async function POST(req: NextRequest) {
  // The LLM path — rate-limited (a refresh action, not a hot load path).
  const limited = rateLimit(req, {
    id: "sales-why-patterns-generate",
    windowMs: 60_000,
    max: 6,
  });
  if (limited) return limited;

  const ctx = await resolve();
  if (!ctx.ok) {
    return NextResponse.json(
      { error: ctx.status === 401 ? "Not authenticated." : "No company context." },
      { status: ctx.status }
    );
  }

  const result = await generateWhyPatterns({
    companyId: ctx.companyId,
    agentId: ctx.agentId,
  });
  await storeWhyPatterns({
    companyId: ctx.companyId,
    agentId: ctx.agentId,
    result,
  });
  return NextResponse.json({ patterns: result });
}
