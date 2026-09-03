import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveApiAuth, resolveApiUserId } from "@/lib/api/resolveApiAuth";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { getCurrentSalesCorpus } from "@/lib/data/salesCoach";
import { dissectCoachV5 } from "@/lib/claude";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import {
  buildMaterialSystemPrompt,
  buildMaterialUserMessage,
  parseCoachingMaterial,
} from "@/lib/coach/v5/coachingMaterial";

/**
 * POST /api/coach/sales-session/coaching-material — a short coaching guide for a skill, generated from the company's
 * own methodology (founder 2026-08-27). Any authenticated rep (self-serve learning alongside practice). Reuses
 * dissectCoachV5 + the corpus. §3.4: a malformed/empty generation returns {material:null} and the client shows an
 * honest "couldn't load" state — never a fabricated guide.
 *
 * Accepts a mobile Bearer token as well as the web cookie session (founder 2026-09-04) — the last of the 26 coach
 * routes the native app calls that it could not previously reach. resolveApiAuth returns the caller's companyId, so
 * the route needs no cookie-scoped DB read (the corpus + generator take companyId as a parameter).
 */

const Body = z.object({ focus: z.string().trim().min(1).max(600) });

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "coach-coaching-material", windowMs: 60_000, max: 20 });
  if (limited) return limited;

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const ctx = await resolveApiAuth(req); // web cookie OR mobile Bearer (native app reuses this route)
  if (!ctx) {
    // WHY THIS IS NOT `if (!ctx) return 401`. resolveApiAuth returns null for BOTH "nobody is signed in" and
    // "signed in with no company" — both auth paths refuse a company-less caller by returning null rather than a
    // context with a null companyId (resolveApiAuth: `if (!profile || !profile.company_id …) return null`;
    // getCurrentAuthContext: `if (!profile?.company_id) return null`).
    //
    // So a `if (!ctx.companyId) return 403` written after it is UNREACHABLE, and every company-less caller gets
    // 401 "Not authenticated." — the one thing that is definitely untrue of them. They are authenticated; they
    // have no company. Telling them to sign in sends them round a loop that cannot end.
    //
    // resolveApiUserId exists for exactly this: identity only, no company requirement. Its own comment records
    // this same mistake being made once before, on /[id]/outcome, where it was caught only because that route had
    // tests that started returning 401 instead of 200.
    const userId = await resolveApiUserId(req);
    if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    return NextResponse.json({ error: "No company context." }, { status: 403 });
  }
  const companyId = ctx.companyId;

  const corpus = await getCurrentSalesCorpus(companyId).catch(() => null);
  const r = await dissectCoachV5({
    companyId,
    systemPrompt: buildMaterialSystemPrompt(corpus?.content) + CONVERSATION_IS_DATA,
    userMessage: buildMaterialUserMessage(body.focus),
  });
  return NextResponse.json({ material: parseCoachingMaterial(r.text) });
}
