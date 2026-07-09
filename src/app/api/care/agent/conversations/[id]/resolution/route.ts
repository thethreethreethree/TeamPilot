import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import {
  captureResolution,
  fetchAgentConversation,
} from "@/lib/data/care";
import { requireCareAgent } from "@/lib/api/careAgentAuth";

/**
 * POST /api/care/agent/conversations/[id]/resolution
 *
 * Captures the resolution learning for a conversation. Called from
 * the resolution-capture form when an agent marks a conversation
 * resolved. Two questions:
 *   - What was the actual issue? (issue_summary)
 *   - What worked? (what_worked)
 * Optional category drives pattern detection downstream.
 *
 * Also marks the conversation status='resolved' if the form was
 * submitted from the "resolve" path — the trigger from 0036 then
 * schedules a durability check 7 days out.
 */

const Body = z.object({
  issueSummary: z.string().min(5).max(2000),
  whatWorked: z.string().min(5).max(2000),
  category: z.string().max(120).optional(),
  precedentResolutionId: z.string().uuid().optional(),
  alsoMarkResolved: z.boolean().optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!auth.companyId) {
    return NextResponse.json({ error: "Agent only." }, { status: 403 });
  }

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  // Defense-in-depth: verify the conversation belongs to the
  // caller's company before capturing a resolution against it.
  // Otherwise a forged conversation id from a peer tenant could
  // get a resolution attached (RLS on support_resolutions would
  // catch it, but explicit check makes the boundary auditable
  // and avoids the WRITE attempt entirely).
  const detail = await fetchAgentConversation(id);
  if (!detail) {
    return NextResponse.json(
      { error: "Conversation not found." },
      { status: 404 }
    );
  }
  if (detail.conversation.companyId !== auth.companyId) {
    return NextResponse.json(
      { error: "Conversation not found." },
      { status: 404 }
    );
  }

  // §3.4 (audit 2026-07-09): captureResolution now THROWS on a DB error (was a silent
  // null → HTTP 200, i.e. success-on-failure that also silently skipped the §3.5
  // durability-check schedule). Catch it — plus the two secondary writes below, which
  // also swallowed errors — so a failed capture surfaces as a real error instead of a
  // phantom "captured". The category stamp / mark-resolved are best-effort denorm/status
  // updates; a failure there shouldn't lose the (already-succeeded) resolution, so they
  // are checked but only logged, not thrown.
  try {
    const resolution = await captureResolution({
      conversationId: id,
      companyId: auth.companyId,
      capturedBy: auth.agentId,
      issueSummary: body.issueSummary,
      whatWorked: body.whatWorked,
      category: body.category ?? null,
      precedentResolutionId: body.precedentResolutionId ?? null,
    });

    if (body.category) {
      // Also stamp the category on the conversation for fast filtering
      // (pattern detection page reads from here directly). Best-effort:
      // the resolution is already captured; log a stamp failure, don't fail the call.
      const { error: catErr } = await auth.sb
        .from("support_conversations")
        .update({ resolution_outcome_category: body.category })
        .eq("id", id);
      if (catErr) {
        // eslint-disable-next-line no-console
        console.error(`[care.resolution] category stamp failed id=${id}: ${catErr.message}`);
      }
    }

    if (body.alsoMarkResolved) {
      const { error: resErr } = await auth.sb
        .from("support_conversations")
        .update({ status: "resolved" })
        .eq("id", id);
      if (resErr) {
        // eslint-disable-next-line no-console
        console.error(`[care.resolution] mark-resolved failed id=${id}: ${resErr.message}`);
      }
    }

    return NextResponse.json({ resolution });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `[care.resolution] capture failed id=${id}:`,
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(
      {
        error:
          "Couldn't save the resolution. Nothing was captured — please retry so it lands on the record.",
      },
      { status: 500 }
    );
  }
}
