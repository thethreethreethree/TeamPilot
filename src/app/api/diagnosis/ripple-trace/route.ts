import { NextRequest, NextResponse } from "next/server";
import { traceRipples } from "@/lib/diagnosis/rippleTrace";

/**
 * §1.5 — Holistic Ripple-Trace.
 *
 * Given a problem + candidate action, returns the affected subjects and the
 * reasoning chain from action to effect. The endpoint refuses to operate
 * without a stated diagnosis — ripple-tracing an unearned problem would be
 * motion without understanding (§0).
 */
export async function POST(req: NextRequest) {
  try {
    const { problemTitle, diagnosis, candidateAction, contextSummary } =
      await req.json();

    if (typeof problemTitle !== "string" || !problemTitle.trim()) {
      return NextResponse.json(
        { error: "Problem title is required." },
        { status: 400 }
      );
    }
    if (typeof diagnosis !== "string" || diagnosis.trim().length < 40) {
      return NextResponse.json(
        {
          error:
            "A stated diagnosis of at least 40 chars is required. The ripple-trace operates on the WHY behind the problem; an empty or thin WHY produces ripples that are guesses, not predictions.",
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

    const ripples = await traceRipples({
      problemTitle,
      diagnosis,
      candidateAction,
      contextSummary: typeof contextSummary === "string" ? contextSummary : "",
    });

    return NextResponse.json({ ripples });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
