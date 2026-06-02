import { NextRequest, NextResponse } from "next/server";
import { traceRipples } from "@/lib/diagnosis/rippleTrace";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody, RippleTraceSchema } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { LlmError } from "@/lib/llm/errors";

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "ripple-trace",
    windowMs: 60_000,
    max: 10,
  });
  if (limited) return limited;

  const body = await readBody(req, RippleTraceSchema);
  if (body instanceof NextResponse) return body;

  try {
    const companyId = (await getCurrentCompanyId()) ?? undefined;
    const ripples = await traceRipples({
      problemTitle: body.problemTitle,
      diagnosis: body.diagnosis,
      candidateAction: body.candidateAction,
      contextSummary: body.contextSummary ?? "",
      companyId,
    });
    return NextResponse.json({ ripples });
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
