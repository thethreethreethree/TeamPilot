import { NextRequest, NextResponse } from "next/server";
import { analyzeConversationDialogue } from "@/lib/claude";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";

export async function POST(req: NextRequest) {
  try {
    const { conversation, userRead } = await req.json();

    if (typeof conversation !== "string" || !conversation.trim()) {
      return NextResponse.json({ error: "Conversation is required." }, { status: 400 });
    }
    if (typeof userRead !== "string" || !userRead.trim()) {
      return NextResponse.json(
        {
          error:
            "Your read of the conversation is required before the System can respond.",
        },
        { status: 400 }
      );
    }

    const companyId = (await getCurrentCompanyId()) ?? undefined;
    const r = await analyzeConversationDialogue({
      conversation,
      userRead,
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
