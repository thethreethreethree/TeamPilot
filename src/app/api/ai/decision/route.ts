import { NextResponse } from "next/server";

/**
 * Deprecated — superseded by /api/ai/decision-dialogue.
 *
 * The old route generated canned Safe / Balanced / Aggressive tiers — that
 * framing presupposes the answer space exists independent of the user, which is
 * the §3.3 overtake. The replacement requires the user's diagnosis and proposal
 * first; the System engages, adds perspective, suggests, compares.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Deprecated. Use POST /api/ai/decision-dialogue with { situation, userDiagnosis, userProposal }. See docs/GUIDE_DONT_OVERTAKE.md.",
    },
    { status: 410 }
  );
}
