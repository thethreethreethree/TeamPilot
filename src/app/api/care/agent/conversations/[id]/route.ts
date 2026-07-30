import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import {
  fetchAgentConversation,
  fetchEnrichedConversation,
  claimConversation,
  assignConversationToAgent,
  setConversationStatus,
  setConversationPriority,
  snoozeConversation,
  unsnoozeConversation,
  requestSupervisorGuidance,
  clearSupervisorGuidanceRequest,
  type SupportConversation,
} from "@/lib/data/care";
import { requireCareAgent } from "@/lib/api/careAgentAuth";

/**
 * GET  /api/care/agent/conversations/[id]
 * PATCH /api/care/agent/conversations/[id]
 *
 * Agent-only. GET returns the conversation + all messages
 * (including internal notes). PATCH supports two operations:
 *   - claim: assigns the calling agent + flips ai_responding off
 *   - status: change to in_conversation / awaiting_customer /
 *             resolved / closed
 *
 * RLS already scopes to the company; we additionally gate by
 * is_support_agent OR company-admin role.
 */

const PatchBody = z.object({
  action: z.enum([
    "claim",
    "assign",
    "status",
    "priority",
    "snooze",
    "unsnooze",
    "request_supervisor_guidance",
    "clear_supervisor_guidance",
  ]),
  status: z
    .enum(["open", "in_conversation", "awaiting_customer", "resolved", "closed"])
    .optional(),
  priority: z.enum(["urgent", "high", "normal", "low"]).optional(),
  snoozedUntil: z.string().datetime().optional(),
  // 2026-06-17 — "assign" action takes targetAgentId. null = unassign
  // (return to the Unassigned pool). Permission gate on this action
  // lives in the route handler — see the assign branch below.
  targetAgentId: z.string().uuid().nullable().optional(),
});

// Local requireAgent replaced by the shared requireCareAgent
// helper imported above. See lib/api/careAgentAuth.ts for the
// rationale (deduplication across 22+ routes).

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const data = await fetchAgentConversation(id);
  if (!data) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const body = await readBody(req, PatchBody);
  if (body instanceof NextResponse) return body;

  // Tenant defense-in-depth (audit 2026-07-27). Every SIBLING agent route (co-pilot / messages / read /
  // resolution / dissect / formulate / events / ask-coach) verifies the conversation is in the caller's
  // company at the ROUTE layer; this mutation route did not — it relied purely on the mutation data fns all
  // using the RLS client. That is sound TODAY (verified: claim/assign/status/priority/snooze + the fetch all
  // use createServerClient), but it is exactly the "service-role route missed the tenant check" class that
  // caused a past cross-tenant incident (the CRM vendor bug): a future switch of any one of those fns to the
  // admin client would silently turn this into a cross-tenant mutation. Fetching once + checking company here
  // gates EVERY action branch, so the invariant holds at the route regardless of the data layer. A26/A29.
  const current = await fetchAgentConversation(id);
  if (!current) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }
  if (!auth.companyId || current.conversation.companyId !== auth.companyId) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  try {
    if (body.action === "claim") {
      await claimConversation({ conversationId: id, agentId: auth.agentId });
    } else if (body.action === "assign") {
      // Permission matrix:
      //   - admin (CEO / COO / admin): can assign any conversation
      //     to anyone, including reassigning peer's work.
      //   - regular agent: can assign UNCLAIMED conversations
      //     (assignedAgentId is null — same as picking from the
      //     unassigned queue) and can hand off conversations
      //     they currently OWN.
      //   - regular agent attempting to reassign a peer's
      //     claimed work → 403 (suggests Claim if they want it).
      if (body.targetAgentId === undefined) {
        return NextResponse.json(
          { error: "assign action requires targetAgentId (or null to unassign)." },
          { status: 400 }
        );
      }
      // `current` was fetched + tenant-checked at the top of the handler; reuse it (no second read).
      // isAdmin already resolved by requireCareAgent; no extra profile fetch needed.
      const currentAssignee = current.conversation.assignedAgentId;
      const isUnclaimed = currentAssignee === null;
      const ownsIt = currentAssignee === auth.agentId;
      if (!auth.isAdmin && !ownsIt && !isUnclaimed) {
        return NextResponse.json(
          {
            error:
              "Only admins can reassign someone else's conversation. You can claim it instead.",
          },
          { status: 403 }
        );
      }
      await assignConversationToAgent({
        conversationId: id,
        targetAgentId: body.targetAgentId,
      });
    } else if (body.action === "status") {
      if (!body.status) {
        return NextResponse.json(
          { error: "status action requires a status field." },
          { status: 400 }
        );
      }
      await setConversationStatus({
        conversationId: id,
        status: body.status as SupportConversation["status"],
      });
    } else if (body.action === "priority") {
      if (!body.priority) {
        return NextResponse.json(
          { error: "priority action requires a priority field." },
          { status: 400 }
        );
      }
      await setConversationPriority({
        conversationId: id,
        priority: body.priority,
      });
    } else if (body.action === "snooze") {
      if (!body.snoozedUntil) {
        return NextResponse.json(
          { error: "snooze action requires snoozedUntil." },
          { status: 400 }
        );
      }
      await snoozeConversation({
        conversationId: id,
        until: body.snoozedUntil,
      });
    } else if (body.action === "unsnooze") {
      await unsnoozeConversation(id);
    } else if (body.action === "request_supervisor_guidance") {
      // No extra permission gate — any agent on the company can
      // ask for supervisor input on a conversation they have
      // visibility on. The flag is signal, not authority.
      await requestSupervisorGuidance(id);
    } else if (body.action === "clear_supervisor_guidance") {
      await clearSupervisorGuidanceRequest(id);
    }
  } catch (err) {
    console.error("[care/conversation action] failed:", err);
    return NextResponse.json(
      {
        error: "Action failed.",
        action: body.action,
      },
      { status: 409 }
    );
  }

  // Read-back: return the post-action conversation row so the
  // caller can verify the state actually changed (§1.6 close the
  // loop). The frontend uses this as the source of truth — never
  // assume an action succeeded just because the HTTP status was
  // 2xx.
  //
  // Must be the ENRICHED shape: the client's divergence check reads
  // `fresh.priority` (and could read tags/customer), but priority is an
  // enriched-only field absent from the base mapConversation. Returning
  // the base row made every priority change false-positive as "didn't
  // stick — DB still reads 'undefined'" and force a reload, because
  // undefined !== the expected priority. The enriched read-back carries
  // priority/tags/customer so the §1.6 verification compares like-for-like.
  const fresh = await fetchEnrichedConversation(id);
  return NextResponse.json({
    ok: true,
    conversation: fresh ?? null,
  });
}
