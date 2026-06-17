import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import {
  bulkSetConversationStatus,
  bulkAssignConversations,
  type SupportConversation,
} from "@/lib/data/care";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/care/agent/conversations/bulk
 *
 * Bulk operations on conversations. Mirrors the action-
 * discriminator pattern of PATCH /[id] — same action vocabulary
 * (status / assign), just applied to N ids at once.
 *
 * Actions
 * ───────
 *   - status: set status on all ids
 *     body: { action: "status", ids: string[], status: "open" | ... | "closed" }
 *   - assign: set assigned_agent_id on all ids
 *     body: { action: "assign", ids: string[], targetAgentId: string | null }
 *
 * Permission gates (same matrix as single-action)
 * ───────────────────────────────────────────────
 *   - assign: admin can target any; non-admin filtered to own +
 *     unclaimed before the bulk update. Disallowed ids are
 *     silently dropped (NOT 403'd whole-request — partial bulk
 *     ops are honest by the response.affectedCount).
 *   - status: any agent can change status on any visible
 *     conversation (mirrors single-action setStatus).
 *
 * Response
 * ────────
 * { ok: true, affectedCount: number } where affectedCount is
 * how many rows were actually updated. Less than ids.length
 * means RLS or permission filtering silently dropped some — the
 * client surfaces the difference per AMD-006 layer 3 (composition
 * honesty: don't claim more than you delivered).
 */

const BulkBody = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("status"),
    ids: z.array(z.string().uuid()).min(1).max(200),
    status: z.enum([
      "open",
      "in_conversation",
      "awaiting_customer",
      "resolved",
      "closed",
    ]),
  }),
  z.object({
    action: z.literal("assign"),
    ids: z.array(z.string().uuid()).min(1).max(200),
    targetAgentId: z.string().uuid().nullable(),
  }),
]);

async function requireAgent() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user)
    return { error: "Not authenticated.", status: 401 } as const;
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
  if (!isAgent)
    return { error: "Care is agent-only.", status: 403 } as const;
  const isAdmin =
    profile?.role === "CEO" ||
    profile?.role === "COO" ||
    profile?.role === "admin";
  return { agentId: auth.user.id, isAdmin };
}

export async function POST(req: NextRequest) {
  const auth = await requireAgent();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const body = await readBody(req, BulkBody);
  if (body instanceof NextResponse) return body;

  if (body.action === "status") {
    const affectedCount = await bulkSetConversationStatus({
      ids: body.ids,
      status: body.status as SupportConversation["status"],
    });
    return NextResponse.json({ ok: true, affectedCount });
  }

  // assign
  let ids = body.ids;
  if (!auth.isAdmin) {
    // Non-admin: filter to only conversations the caller is
    // permitted to reassign. Same matrix as the single-action
    // route — own + unclaimed only. Disallowed ids are silently
    // dropped from the bulk update (the client gets affectedCount
    // back and can show "3 of 5 assigned" if relevant).
    const sb = await createClient();
    const { data: allowed } = await sb
      .from("support_conversations")
      .select("id")
      .in("id", body.ids)
      .or(`assigned_agent_id.is.null,assigned_agent_id.eq.${auth.agentId}`);
    ids = (allowed ?? []).map((r) => r.id as string);
  }
  const affectedCount = await bulkAssignConversations({
    ids,
    targetAgentId: body.targetAgentId,
  });
  return NextResponse.json({
    ok: true,
    affectedCount,
    requestedCount: body.ids.length,
  });
}
