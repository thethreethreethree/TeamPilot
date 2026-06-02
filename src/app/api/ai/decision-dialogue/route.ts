import { NextRequest, NextResponse } from "next/server";
import { proposeDecisionDialogue } from "@/lib/claude";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody, DialogueDecisionSchema } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { LlmError } from "@/lib/llm/errors";

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "decision-dialogue",
    windowMs: 60_000,
    max: 10,
  });
  if (limited) return limited;

  const body = await readBody(req, DialogueDecisionSchema);
  if (body instanceof NextResponse) return body;

  try {
    const companyId = (await getCurrentCompanyId()) ?? undefined;
    const r = await proposeDecisionDialogue({ ...body, companyId });
    if (r.suppressed) {
      return NextResponse.json(
        { suppressed: true, reason: r.reason },
        { status: 200 }
      );
    }
    const parsed = JSON.parse(r.text);
    return NextResponse.json({ ...parsed, provider: r.provider, model: r.model });
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
