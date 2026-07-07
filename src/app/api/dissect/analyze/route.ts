import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { generateConversationDissect } from "@/lib/dissect/engine";

/**
 * POST /api/dissect/analyze
 *
 * Summarize + dissect a pasted conversation (problem-solving lens). EPHEMERAL —
 * nothing is persisted here; the result lives in the client's per-chat state
 * until the user chooses "Save the topic". Auth-gated + rate-limited; the LLM
 * cost context is the caller's company. Degrades honestly (§3.4): a thin paste
 * returns hasSignal:false, never a fabricated problem.
 */

const Body = z.object({
  content: z.string().min(1).max(20000),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "dissect-analyze",
    windowMs: 60_000,
    max: 15,
  });
  if (limited) return limited;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const companyId = (await getCurrentCompanyId()) ?? undefined;
  const dissect = await generateConversationDissect({
    companyId,
    sourceText: body.content,
  });

  return NextResponse.json({ dissect });
}
