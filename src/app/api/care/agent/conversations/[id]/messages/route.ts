import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import {
  captureCoPilotEdit,
  fetchAgentConversation,
  postAgentMessage,
} from "@/lib/data/care";
import { createAdminClient } from "@/lib/supabase/admin";
import { gradeCareAgentReply } from "@/lib/care/grader";
import { dispatchOutboundEmailReply } from "@/lib/care/email/outbound";
import { requireCareAgent } from "@/lib/api/careAgentAuth";

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

// LLM route: longer serverless budget than Vercel's short default (awaits an LLM call via a lib helper).
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  // Defense-in-depth: verify the conversation belongs to the
  // caller's company before writing anything (the post +
  // Co-Pilot corpus capture below). RLS catches it; route-level
  // makes it explicit. F7 fix: this also makes the second
  // profile fetch below unnecessary — auth.companyId is already
  // resolved.
  const detail = await fetchAgentConversation(id);
  if (!detail) {
    return NextResponse.json(
      { error: "Conversation not found." },
      { status: 404 }
    );
  }
  if (!auth.companyId || detail.conversation.companyId !== auth.companyId) {
    return NextResponse.json(
      { error: "Conversation not found." },
      { status: 404 }
    );
  }

  // §A16 direction 2 plumbing — when the agent's reply was
  // drafted via Co-Pilot, persist the Co-Pilot reasoning on the
  // message row so the Coach grader can read it. coPilotInvoked
  // is independent: it's set whenever the agent invoked Co-Pilot,
  // even if reasoning came back empty.
  const coPilotInvoked = !body.isInternalNote && !!body.aiDraft;
  const msg = await postAgentMessage({
    conversationId: id,
    body: body.body,
    agentId: auth.agentId,
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
  // teaches the Co-Pilot the company's voice over time. F7 fix:
  // use auth.companyId from the shared helper instead of
  // re-fetching the profile (which was redundant + skipped the
  // company-match check the new explicit verify above enforces).
  if (!body.isInternalNote && body.aiDraft && auth.companyId) {
    try {
      await captureCoPilotEdit({
        conversationId: id,
        companyId: auth.companyId,
        agentId: auth.agentId,
        aiDraft: body.aiDraft,
        aiReasoning: body.aiReasoning ?? null,
        agentSent: body.body,
      });
    } catch (e) {
      // §3.6 observability (audit 2026-07-09): this captures the agent's edit of an
      // AI Co-Pilot draft — the corpus that TEACHES the Co-Pilot the company's voice
      // (§3.5 learning). A silent prod failure = the learning degrades INVISIBLY, the
      // exact anti-§3.6 shape. Log in ALL environments (was dev-only), matching this
      // codebase's push-sender / loop-breaker discipline. Non-fatal: the agent's reply
      // already landed; only the training capture missed.
      // eslint-disable-next-line no-console
      console.error(
        `[care] co-pilot edit capture failed conv=${id}:`,
        e instanceof Error ? e.message : e
      );
    }
  }

  // Coach grading — async, best-effort, never blocks the response.
  // Only grade public agent replies (not internal notes). The grade
  // is asymmetric: agent + leader see it; customer never does.
  // §A16 direction 2: the grader receives co_pilot_reasoning from
  // the message row (which we just persisted) so deliberate shape
  // choices are honored.
  if (!body.isInternalNote && msg) {
    // after() (not void): survive the post-response serverless freeze.
    after(() =>
      gradeMessageAsync({
        conversationId: id,
        messageId: msg.id,
        agentReply: body.body,
        coPilotReasoning: msg.coPilotReasoning,
      })
    );
  }

  // Phase 4 outbound email dispatch — if the conversation source
  // is 'email', dispatch the agent's public reply through the
  // email provider so the customer receives it in their inbox.
  // Internal notes never dispatch (they're agent-only). Async +
  // best-effort: dispatch failures are surfaced via a follow-up
  // event the agent can see, but they don't block the response.
  // §A14 verified branches: source=email, source=embedded_widget
  // (no dispatch), source=web_widget (no dispatch), internal note
  // (no dispatch regardless of source).
  let emailDispatchPromised = false;
  if (!body.isInternalNote && msg) {
    // Use the already-fetched detail.conversation.source instead
    // of re-querying the row. Saves a round-trip and removes the
    // stale `sb` reference (auth.sb is available if needed).
    if (detail.conversation.source === "email") {
      emailDispatchPromised = true;
      // after() is CRITICAL here: this is the OUTBOUND SEND of the agent's reply.
      // As a bare void it would be abandoned when the serverless instance freezes
      // post-response — the customer would never receive the agent's email.
      after(() =>
        dispatchOutboundEmailReply({
          conversationId: id,
          messageId: msg.id,
        })
          .then((r) => {
            // §3.4 observability (audit 2026-07-09): a silent outbound failure means
            // the CUSTOMER never received the agent's reply while the agent believes
            // they did (emailDispatchPromised:true). dispatchOutboundEmailReply RETURNS
            // { ok:false } on both the config skip (POSTMARK unset) AND a real Postmark/
            // runtime failure — previously IGNORED, and the .catch only logged in dev,
            // so a customer-facing channel failed into a production black hole. Log the
            // named cause in ALL environments, matching this codebase's push-sender /
            // loop-breaker discipline. (Agent-visible surfacing is a follow-up; the send
            // is fire-and-forget after the response, so the floor is an operator log.)
            if (!r.ok) {
              // eslint-disable-next-line no-console
              console.error(
                `[care] outbound email dispatch FAILED conv=${id} msg=${msg.id}: ${r.error}`
              );
            }
          })
          .catch((e) => {
            // eslint-disable-next-line no-console
            console.error(
              `[care] outbound email dispatch threw conv=${id} msg=${msg.id}:`,
              e instanceof Error ? e.message : e
            );
          })
      );
    }
  }

  return NextResponse.json({ message: msg, emailDispatchPromised });
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
