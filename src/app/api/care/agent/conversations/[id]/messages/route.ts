import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import {
  captureCoPilotEdit,
  fetchAgentConversation,
  postAgentMessage,
} from "@/lib/data/care";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { gradeCareAgentReply } from "@/lib/care/grader";

/**
 * POST /api/care/agent/conversations/[id]/messages
 *
 * Agent posts a reply to a customer (or an internal note).
 * Internal notes are agent-only — the customer widget never
 * fetches them.
 */

const Body = z.object({
  body: z.string().min(1).max(4000),
  isInternalNote: z.boolean().optional(),
  // When the agent's reply was preceded by an AI Co-Pilot draft,
  // the client passes both the original draft + the reasoning. We
  // capture the (draft, sent) pair into the learning corpus so the
  // Co-Pilot gets sharper for this company over time. Both
  // optional — agents can always type freely.
  aiDraft: z.string().max(8000).optional(),
  aiReasoning: z.string().max(4000).optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { data: profile } = await sb
    .from("profiles")
    .select("is_support_agent, role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const isAgent =
    profile?.is_support_agent ||
    profile?.role === "CEO" ||
    profile?.role === "COO" ||
    profile?.role === "admin";
  if (!isAgent) {
    return NextResponse.json(
      { error: "Care is agent-only." },
      { status: 403 }
    );
  }

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  // §A16 direction 2 plumbing — when the agent's reply was
  // drafted via Co-Pilot, persist the Co-Pilot reasoning on the
  // message row so the Coach grader can read it. coPilotInvoked
  // is independent: it's set whenever the agent invoked Co-Pilot,
  // even if reasoning came back empty.
  const coPilotInvoked = !body.isInternalNote && !!body.aiDraft;
  const msg = await postAgentMessage({
    conversationId: id,
    body: body.body,
    agentId: auth.user.id,
    isInternalNote: !!body.isInternalNote,
    coPilotReasoning:
      coPilotInvoked && body.aiReasoning ? body.aiReasoning : null,
    coPilotInvoked,
  });
  if (!msg) {
    return NextResponse.json(
      { error: "Couldn't post the message." },
      { status: 500 }
    );
  }

  // Capture the Co-Pilot edit if the client sent it. Best-effort —
  // never block the response on this. The accumulated corpus
  // teaches the Co-Pilot the company's voice over time.
  if (!body.isInternalNote && body.aiDraft) {
    const { data: profile } = await sb
      .from("profiles")
      .select("company_id")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (profile?.company_id) {
      try {
        await captureCoPilotEdit({
          conversationId: id,
          companyId: profile.company_id,
          agentId: auth.user.id,
          aiDraft: body.aiDraft,
          aiReasoning: body.aiReasoning ?? null,
          agentSent: body.body,
        });
      } catch (e) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[care] co-pilot edit capture failed", e);
        }
      }
    }
  }

  // Coach grading — async, best-effort, never blocks the response.
  // Only grade public agent replies (not internal notes). The grade
  // is asymmetric: agent + leader see it; customer never does.
  // §A16 direction 2: the grader receives co_pilot_reasoning from
  // the message row (which we just persisted) so deliberate shape
  // choices are honored.
  if (!body.isInternalNote && msg) {
    void gradeMessageAsync({
      conversationId: id,
      messageId: msg.id,
      agentReply: body.body,
      coPilotReasoning: msg.coPilotReasoning,
    });
  }

  return NextResponse.json({ message: msg });
}

/**
 * Fire-and-forget grading. Runs after the response has been sent
 * to the agent. Uses service-role so the UPDATE goes through the
 * append-only block on support_messages — that block targets
 * client-side UPDATEs, not server-side maintenance like grading.
 *
 * Failure paths are silent — a missing grade is not a bug, it's a
 * "withheld" outcome the agent growth surface already accounts for.
 */
async function gradeMessageAsync(args: {
  conversationId: string;
  messageId: string;
  agentReply: string;
  coPilotReasoning: string | null;
}): Promise<void> {
  try {
    const detail = await fetchAgentConversation(args.conversationId);
    if (!detail) return;
    const visible = detail.messages.filter((m) => !m.isInternalNote);
    const lastCustomer = [...visible]
      .reverse()
      .find((m) => m.authorType === "customer");
    if (!lastCustomer) return;

    const contextTurns = visible
      .slice(-8)
      .filter((m) => m.id !== args.messageId)
      .map((m) => {
        const r =
          m.authorType === "customer"
            ? "Customer"
            : m.authorType === "agent"
              ? "Agent (earlier)"
              : "AI (earlier)";
        return `${r}: ${m.body}`;
      })
      .join("\n");

    // Coach v6 — count-based rubric (A11). The grader returns
    // both the structured counts AND a back-compat derived enum
    // so existing UI/aggregations keep working during the
    // transition. §A16 direction 2: pass coPilotReasoning when
    // present so deliberate shape choices aren't penalized.
    const result = await gradeCareAgentReply({
      customerLastMessage: lastCustomer.body,
      agentReply: args.agentReply,
      conversationContext: contextTurns || undefined,
      coPilotReasoning: args.coPilotReasoning,
    });

    const admin = createAdminClient();
    // The preserve_support_message_content trigger (refreshed in
    // migration 0040) allows updates to coach_grade /
    // coach_reason_internal / coach_graded_at / coach_counts.
    // All other columns get silently reverted by the trigger,
    // preserving the §3.1 append-only contract on author/content
    // while still letting the System emit observations.
    await admin
      .from("support_messages")
      .update({
        coach_grade: result.derivedGrade,
        coach_reason_internal: result.reasonInternal || null,
        coach_graded_at: new Date().toISOString(),
        coach_counts: result.counts,
      })
      .eq("id", args.messageId);
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[care] coach grading failed", e);
    }
  }
}
