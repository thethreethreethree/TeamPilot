import { NextRequest, NextResponse } from "next/server";
import { traceRipples } from "@/lib/diagnosis/rippleTrace";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";

export async function POST(req: NextRequest) {
  try {
    const { problemTitle, diagnosis, candidateAction, contextSummary } =
      await req.json();

    if (typeof problemTitle !== "string" || !problemTitle.trim()) {
      return NextResponse.json({ error: "Problem title is required." }, { status: 400 });
    }
    if (typeof diagnosis !== "string" || diagnosis.trim().length < 40) {
      return NextResponse.json(
        {
          error:
            "A stated diagnosis of at least 40 chars is required. Ripple-tracing an empty WHY produces guesses, not predictions.",
        },
        { status: 400 }
      );
    }
    if (typeof candidateAction !== "string" || !candidateAction.trim()) {
      return NextResponse.json(
        { error: "A candidate action is required to ripple-trace." },
        { status: 400 }
      );
    }

    const companyId = (await getCurrentCompanyId()) ?? undefined;
    const ripples = await traceRipples({
      problemTitle,
      diagnosis,
      candidateAction,
      contextSummary: typeof contextSummary === "string" ? contextSummary : "",
      companyId,
    });

    return NextResponse.json({ ripples });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
