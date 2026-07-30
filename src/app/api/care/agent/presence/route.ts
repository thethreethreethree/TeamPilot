import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import {
  fetchAgentPresence,
  fetchTeamPresence,
  setAgentRoutingSettings,
  setAgentStatus,
  touchAgentHeartbeat,
} from "@/lib/data/care";
import { requireCareAgent } from "@/lib/api/careAgentAuth";

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
 * Capacity + channels are admin-controlled and handled by this same
 * PUT: when maxConcurrent/channels are present, the handler verifies the
 * caller is a company admin (CEO / COO / admin) before applying them via
 * setAgentRoutingSettings. Status (self) and routing (admin) share one
 * endpoint, each with its own per-action authorization check below.
 */
export async function GET() {
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!auth.companyId) {
    return NextResponse.json(
      { error: "No company on profile." },
      { status: 403 }
    );
  }

  // §A6 — touch the heartbeat so 'online' reflects real activity.
  // No-op if the agent_state row doesn't exist yet (handled by
  // strictMutate inside, returning silently). Best-effort.
  after(() =>
    touchAgentHeartbeat(auth.agentId).catch(() => {
      /* best-effort */
    })
  );

  const self = await fetchAgentPresence(auth.agentId);

  if (auth.isAdmin) {
    const team = await fetchTeamPresence(auth.companyId);
    return NextResponse.json({ self, team });
  }

  return NextResponse.json({ self });
}

const PutBody = z.object({
  // Agent self-update — status. Admin updates of capacity/channels are
  // ALSO accepted here (maxConcurrent/channels below); the handler gates
  // them on company-admin before applying, so status (self) and routing
  // (admin) share one endpoint with an explicit auth check per action.
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
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await readBody(req, PutBody);
  if (body instanceof NextResponse) return body;

  const targetAgentId = body.agentId ?? auth.agentId;
  const isSelf = targetAgentId === auth.agentId;

  // Status: agents update their own only.
  if (body.status !== undefined) {
    if (!isSelf && !auth.isAdmin) {
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
      console.error("[care/agent/presence] setAgentStatus failed:", e);
      return NextResponse.json({ error: "Status update failed." }, { status: 500 });
    }
  }

  // Capacity / channels: leaders only.
  if (
    body.maxConcurrent !== undefined ||
    body.channels !== undefined
  ) {
    if (!auth.isAdmin) {
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
      console.error("[care/agent/presence] setAgentRoutingSettings failed:", e);
      return NextResponse.json({ error: "Settings update failed." }, { status: 500 });
    }
  }

  const fresh = await fetchAgentPresence(targetAgentId);
  return NextResponse.json({ ok: true, self: fresh });
}
