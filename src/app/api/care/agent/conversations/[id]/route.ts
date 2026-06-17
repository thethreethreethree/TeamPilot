import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import {
  fetchAgentConversation,
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
import { createClient } from "@/lib/supabase/server";

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

async function requireAgent() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return { error: "Not authenticated.", status: 401 } as const;
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
  if (!isAgent) return { error: "Care is agent-only.", status: 403 } as const;
  return { agentId: auth.user.id };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const auth = await requireAgent();
  if ("error" in auth) {
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
  const auth = await requireAgent();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const body = await readBody(req, PatchBody);
  if (body instanceof NextResponse) return body;

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
      const current = await fetchAgentConversation(id);
      if (!current) {
        return NextResponse.json(
          { error: "Conversation not found." },
          { status: 404 }
        );
      }
      const sbCheck = await createClient();
      const { data: profile } = await sbCheck
        .from("profiles")
        .select("role")
        .eq("id", auth.agentId)
        .maybeSingle();
      const isAdmin =
        profile?.role === "CEO" ||
        profile?.role === "COO" ||
        profile?.role === "admin";
      const currentAssignee = current.conversation.assignedAgentId;
      const isUnclaimed = currentAssignee === null;
      const ownsIt = currentAssignee === auth.agentId;
      if (!isAdmin && !ownsIt && !isUnclaimed) {
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
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Action failed.",
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
  const fresh = await fetchAgentConversation(id);
  return NextResponse.json({
    ok: true,
    conversation: fresh?.conversation ?? null,
  });
}
