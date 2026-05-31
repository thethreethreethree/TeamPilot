import { NextRequest, NextResponse } from "next/server";
import { proposeDecisionDialogue } from "@/lib/claude";

/**
 * Guide-don't-overtake decision route. See docs/GUIDE_DONT_OVERTAKE.md.
 *
 * The user's diagnosis and proposal are REQUIRED. Missing either is a 400 — the
 * structural interrupt that prevents the System from speaking before the user does.
 */
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

    const raw = await proposeDecisionDialogue({
      situation,
      userDiagnosis,
      userProposal,
    });
    const parsed = JSON.parse(raw);
    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
