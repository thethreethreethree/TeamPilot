import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import { requireCareAgent } from "@/lib/api/careAgentAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { OPEN_CONVERSATION_STATUSES } from "@/lib/data/care";
import { byOrgRank } from "@/lib/roles";

async function requireCompanyAdmin() {
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return { error: auth.error, status: auth.status } as const;
  }
  if (!auth.isAdmin || !auth.companyId) {
    return { error: "Company admin only.", status: 403 as const } as const;
  }
  return { sb: auth.sb, companyId: auth.companyId };
}

export async function GET() {
  const ctx = await requireCompanyAdmin();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const [{ data: profiles }, { data: states }] = await Promise.all([
    ctx.sb
      .from("profiles")
      .select("id, full_name, role, is_support_agent")
      .eq("company_id", ctx.companyId)
      .order("full_name", { ascending: true }),
    ctx.sb
      .from("care_agent_state")
      .select("agent_id, status, max_concurrent, channels, last_seen_at")
      .eq("company_id", ctx.companyId),
  ]);
  type StateRow = {
    agent_id: string;
    status: string;
    max_concurrent: number;
    channels: string[];
    last_seen_at: string;
  };
  const stateByAgent = new Map<string, StateRow>();
  for (const s of (states ?? []) as StateRow[]) {
    stateByAgent.set(s.agent_id, s);
  }

  // Compute current open-load per agent in a single query.
  const agentIds = (profiles ?? []).map((r) => r.id as string);
  const loadByAgent = new Map<string, number>();
  if (agentIds.length > 0) {
    const { data: convs } = await ctx.sb
      .from("support_conversations")
      .select("assigned_agent_id")
      .in("assigned_agent_id", agentIds)
      .in("status", OPEN_CONVERSATION_STATUSES);
    for (const c of convs ?? []) {
      const id = c.assigned_agent_id as string | null;
      if (!id) continue;
      loadByAgent.set(id, (loadByAgent.get(id) ?? 0) + 1);
    }
  }

  // Order the roster TOP-TO-BOTTOM by org rank (C-Suite → Frontline), then A→Z within a tier (founder 2026-08-29).
  const orderedProfiles = [...(profiles ?? [])].sort(
    byOrgRank((r) => r.role as string | null, (r) => r.full_name as string | null)
  );
  return NextResponse.json({
    agents: orderedProfiles.map((r) => {
      const id = r.id as string;
      const state = stateByAgent.get(id);
      return {
        id,
        fullName: (r.full_name as string | null) ?? null,
        role: (r.role as string | null) ?? null,
        isSupportAgent: !!r.is_support_agent,
        presence: state
          ? {
              status: state.status as "online" | "away" | "offline",
              maxConcurrent: state.max_concurrent,
              channels: state.channels ?? [],
              lastSeenAt: state.last_seen_at,
              currentLoad: loadByAgent.get(id) ?? 0,
            }
          : null,
      };
    }),
  });
}

const Body = z.object({
  id: z.string().uuid(),
  isSupportAgent: z.boolean(),
});

export async function POST(req: NextRequest) {
  const ctx = await requireCompanyAdmin();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  // Service-role write, gated by requireCompanyAdmin above and scoped to the
  // admin's own company. Two reasons it must be service-role, not ctx.sb:
  //  1. is_support_agent is a privileged column frozen against direct
  //     authenticated writes by the 0090 guard trigger; the user client would
  //     be rejected.
  //  2. The self-only RLS UPDATE policy on profiles (0001) would otherwise let
  //     an admin toggle only their OWN row, never a teammate's — the exact
  //     admin-manages-team action this route exists for.
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ is_support_agent: body.isSupportAgent })
    .eq("id", body.id)
    .eq("company_id", ctx.companyId);
  if (error) {
    return NextResponse.json(
      { error: "Could not update the agent." },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
