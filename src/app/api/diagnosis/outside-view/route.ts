import { NextRequest, NextResponse } from "next/server";
import { generateOutsideViews } from "@/lib/diagnosis/outsideView";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { readBody, OutsideViewSchema } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { LlmError } from "@/lib/llm/errors";

// LLM route: allow a longer LLM/stream budget than Vercel's short default (class-swept
// 2026-07-09 — 50e4ba1 declared maxDuration on finalize/summarize only; this closes the class).
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "outside-view",
    windowMs: 60_000,
    max: 10,
  });
  if (limited) return limited;

  // Auth gate (audit 2026-07-09): require a signed-in user before the LLM call — an
  // anon caller otherwise drives the model on our bill (middleware doesn't cover
  // /api/*; getCurrentCompanyId returns null, not an error, for anon).
  const _authClient = await createClient();
  const { data: _authData } = await _authClient.auth.getUser();
  if (!_authData?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await readBody(req, OutsideViewSchema);
  if (body instanceof NextResponse) return body;

  try {
    const companyId = (await getCurrentCompanyId()) ?? undefined;
    const readings = await generateOutsideViews({
      currentRead: body.currentRead,
      evidenceSummary: body.evidenceSummary,
      count: body.count ?? 3,
      companyId,
    });
    return NextResponse.json({ readings });
  } catch (err) {
    if (err instanceof LlmError) {
      return NextResponse.json(
        { error: err.message, kind: err.kind, provider: err.provider },
        { status: err.kind === "rate_limit" ? 429 : err.status ?? 502 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
