import { NextRequest, NextResponse } from "next/server";
import { proposeDecisionDialogue } from "@/lib/claude";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";

export async function POST(req: NextRequest) {
  try {
    const { situation, userDiagnosis, userProposal } = await req.json();

    if (typeof situation !== "string" || !situation.trim()) {
      return NextResponse.json({ error: "Situation is required." }, { status: 400 });
    }
    if (typeof userDiagnosis !== "string" || !userDiagnosis.trim()) {
      return NextResponse.json(
        {
          error:
            "Your diagnosis is required before the System can respond. State what you think is going on first.",
        },
        { status: 400 }
      );
    }
    if (typeof userProposal !== "string" || !userProposal.trim()) {
      return NextResponse.json(
        {
          error:
            "Your proposal is required before the System can respond. State what you would do and why first.",
        },
        { status: 400 }
      );
    }

    const companyId = (await getCurrentCompanyId()) ?? undefined;
    const r = await proposeDecisionDialogue({
      situation,
      userDiagnosis,
      userProposal,
      companyId,
    });
    if (r.suppressed) {
      return NextResponse.json(
        { suppressed: true, reason: r.reason },
        { status: 200 }
      );
    }
    const parsed = JSON.parse(r.text);
    return NextResponse.json({ ...parsed, provider: r.provider, model: r.model });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
