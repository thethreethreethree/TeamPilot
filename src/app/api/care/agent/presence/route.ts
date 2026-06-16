import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import {
  fetchAgentPresence,
  fetchTeamPresence,
  setAgentRoutingSettings,
  setAgentStatus,
  touchAgentHeartbeat,
} from "@/lib/data/care";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/care/agent/presence
 *
 * Returns the calling agent's own presence + (for admins) the
 * team aggregate.
 *
 * Per §A10 the self field has feature parity with what the
 * leader sees about this agent. Per §A18 the team field is
 * aggregate counts only (online/away/offline counts, channel
 * coverage, at-capacity count) — no per-agent breakdown by
 * design.
 *
 * Calling this endpoint also touches the agent's heartbeat so
 * 'online' status reflects real presence. The client should
 * call it periodically while the dashboard is open.
 *
 * PUT /api/care/agent/presence
 *
 * Agent updates their own status (online / away / offline).
 * Capacity + channels are admin-controlled — those updates
 * route through PATCH on a separate per-agent admin endpoint
 * (TODO Phase 5 commit 3).
 */
export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { data: profile } = await sb
    .from("profiles")
    .select("is_support_agent, role, company_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  const isAgent =
    profile?.is_support_agent ||
    profile?.role === "CEO" ||
    profile?.role === "COO" ||
    profile?.role === "admin";
  if (!isAgent) {
    return NextResponse.json({ error: "Agent only." }, { status: 403 });
  }
  if (!profile?.company_id) {
    return NextResponse.json(
      { error: "No company on profile." },
      { status: 403 }
    );
  }

  // §A6 — touch the heartbeat so 'online' reflects real activity.
  // No-op if the agent_state row doesn't exist yet (handled by
  // strictMutate inside, returning silently). Best-effort.
  void touchAgentHeartbeat(auth.user.id).catch(() => {
    /* best-effort */
  });

  const self = await fetchAgentPresence(auth.user.id);

  const isLeader =
    profile.role === "CEO" ||
    profile.role === "COO" ||
    profile.role === "admin";

  if (isLeader) {
    const team = await fetchTeamPresence(profile.company_id);
    return NextResponse.json({ self, team });
  }

  return NextResponse.json({ self });
}

const PutBody = z.object({
  // Agent self-update — status only here. Admin updates of
  // capacity/channels go through a separate admin endpoint
  // (planned for commit 3) so the row-level RLS gate is
  // explicit per action surface.
  status: z.enum(["online", "away", "offline"]).optional(),
  // Admin-only — if present, the API will verify the caller is
  // admin in the company before applying. agentId in path can
  // be self or another agent.
  maxConcurrent: z.number().int().min(0).max(50).optional(),
  channels: z.array(z.string().min(1).max(64)).max(20).optional(),
  /** When admin is updating another agent's settings, the target
   *  agent id. Omitted = self (status only). */
  agentId: z.string().uuid().optional(),
});

export async function PUT(req: NextRequest) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { data: profile } = await sb
    .from("profiles")
    .select("is_support_agent, role, company_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  const isAgent =
    profile?.is_support_agent ||
    profile?.role === "CEO" ||
    profile?.role === "COO" ||
    profile?.role === "admin";
  if (!isAgent) {
    return NextResponse.json({ error: "Agent only." }, { status: 403 });
  }

  const body = await readBody(req, PutBody);
  if (body instanceof NextResponse) return body;

  const targetAgentId = body.agentId ?? auth.user.id;
  const isSelf = targetAgentId === auth.user.id;
  const isLeader =
    profile?.role === "CEO" ||
    profile?.role === "COO" ||
    profile?.role === "admin";

  // Status: agents update their own only.
  if (body.status !== undefined) {
    if (!isSelf && !isLeader) {
      return NextResponse.json(
        { error: "Status can only be updated by the agent themselves." },
        { status: 403 }
      );
    }
    try {
      await setAgentStatus({
        agentId: targetAgentId,
        status: body.status,
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Status update failed." },
        { status: 500 }
      );
    }
  }

  // Capacity / channels: leaders only.
  if (
    body.maxConcurrent !== undefined ||
    body.channels !== undefined
  ) {
    if (!isLeader) {
      return NextResponse.json(
        {
          error:
            "Capacity and channels are admin-controlled (CEO / COO / admin).",
        },
        { status: 403 }
      );
    }
    try {
      await setAgentRoutingSettings({
        agentId: targetAgentId,
        maxConcurrent: body.maxConcurrent,
        channels: body.channels,
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Settings update failed." },
        { status: 500 }
      );
    }
  }

  const fresh = await fetchAgentPresence(targetAgentId);
  return NextResponse.json({ ok: true, self: fresh });
}
