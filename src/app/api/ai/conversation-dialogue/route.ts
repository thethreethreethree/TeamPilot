import { NextRequest, NextResponse } from "next/server";
import { analyzeConversationDialogue } from "@/lib/claude";

/**
 * Guide-don't-overtake conversation route. The user's read is REQUIRED — without it,
 * the System would be asserting what the meeting meant before the human stated what
 * they thought, which is the §3.3 overtake we are eliminating.
 */
export async function POST(req: NextRequest) {
  try {
    const { conversation, userRead } = await req.json();

    if (typeof conversation !== "string" || !conversation.trim()) {
      return NextResponse.json(
        { error: "Conversation transcript is required." },
        { status: 400 }
      );
    }
    if (typeof userRead !== "string" || !userRead.trim()) {
      return NextResponse.json(
        {
          error:
            "Your read of the conversation is required before the System can respond. State what you think was decided and what the action items are first.",
        },
        { status: 400 }
      );
    }

    const raw = await analyzeConversationDialogue({ conversation, userRead });
    const parsed = JSON.parse(raw);
    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
