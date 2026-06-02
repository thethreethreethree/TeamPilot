import { NextResponse } from "next/server";

/**
 * Deprecated — superseded by /api/ai/conversation-dialogue.
 *
 * The old route asserted a single "decision" and "action plan" from a transcript
 * without first asking the user for their read — a §3.3 overtake. The guide-don't-
 * overtake replacement requires the user's read in the request body. See AMD-003
 * + docs/GUIDE_DONT_OVERTAKE.md.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Deprecated. Use POST /api/ai/conversation-dialogue with { conversation, userRead }. See docs/GUIDE_DONT_OVERTAKE.md.",
    },
    { status: 410 }
  );
}
