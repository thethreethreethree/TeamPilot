import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import { requireCareAgent } from "@/lib/api/careAgentAuth";

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
      .in("status", ["open", "in_conversation", "awaiting_customer"]);
    for (const c of convs ?? []) {
      const id = c.assigned_agent_id as string | null;
      if (!id) continue;
      loadByAgent.set(id, (loadByAgent.get(id) ?? 0) + 1);
    }
  }

  return NextResponse.json({
    agents: (profiles ?? []).map((r) => {
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
  await ctx.sb
    .from("profiles")
    .update({ is_support_agent: body.isSupportAgent })
    .eq("id", body.id)
    .eq("company_id", ctx.companyId);
  return NextResponse.json({ ok: true });
}
