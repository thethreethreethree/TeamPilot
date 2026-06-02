import { NextRequest, NextResponse } from "next/server";
import { generateOutsideViews } from "@/lib/diagnosis/outsideView";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody, OutsideViewSchema } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { LlmError } from "@/lib/llm/errors";

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "outside-view",
    windowMs: 60_000,
    max: 10,
  });
  if (limited) return limited;

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
