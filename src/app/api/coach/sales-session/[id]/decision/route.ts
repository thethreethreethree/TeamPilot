import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { getSession } from "@/lib/data/salesCoach";

/**
 * POST /api/coach/sales-session/[id]/decision (audit F1, 2026-06-27)
 *
 * Persist a session decision dialogue as an append-only chain event
 * (coach.session_decision, subject sales_session:<id>) — the same
 * mechanism Coach debriefs + sales reviews use (§A21, §3.1). Closes the
 * audit gap where the session decision dialogue discarded the agent's
 * reasoning while the chat/topic decision dialogue persists it (§1.1
 * data-as-asset).
 *
 * Best-effort, fire-and-forget from the client: the dialogue still
 * showed even if persistence fails.
 */

const BodySchema = z.object({
  situation: z.string().min(1).max(20_000),
  userDiagnosis: z.string().min(1).max(20_000),
  userProposal: z.string().min(1).max(20_000),
  systemResponse: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, {
    id: "sales-session-decision",
    windowMs: 60_000,
    max: 20,
  });
  if (limited) return limited;

  const { id } = await context.params;
  const body = await readBody(req, BodySchema);
  if (body instanceof NextResponse) return body;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const companyId = (await getCurrentCompanyId()) ?? undefined;
  if (!companyId) {
    return NextResponse.json({ error: "No company context." }, { status: 403 });
  }
  const session = await getSession(id);
  if (!session) {
    return NextResponse.json(
      { error: "Session not found or not accessible." },
      { status: 404 }
    );
  }

  try {
    await supabase.from("events").insert({
      company_id: companyId,
      actor: auth.user.id,
      kind: "coach.session_decision",
      subject: `sales_session:${id}`,
      payload: {
        situation: body.situation,
        user_diagnosis: body.userDiagnosis,
        user_proposal: body.userProposal,
        system_response: body.systemResponse ?? null,
      },
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
  return NextResponse.json({ ok: true });
}
