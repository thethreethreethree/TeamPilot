import { NextResponse } from "next/server";
import { requireCareAgent } from "@/lib/api/careAgentAuth";

/**
 * GET /api/care/agent/team
 *
 * Slim agent roster for assignment UI. Any support agent (or
 * company admin) can call this — it's not sensitive data, just
 * the list of teammates a conversation can be handed off to.
 * The fuller GET /api/care/agent/settings/agents stays
 * admin-only for the agent-management surface (presence,
 * load, channels, max_concurrent edits).
 *
 * Shape — kept minimal so the consumer can render a dropdown
 * without any further filtering:
 *   { agents: [{ id, fullName, isSupportAgent, role }, ...] }
 *
 * Includes everyone in the company so a non-agent CEO/COO can
 * still be assigned (it happens — someone with admin role takes
 * a high-profile conversation personally). The consumer can
 * filter further if it wants.
 */
export async function GET() {
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!auth.companyId) {
    return NextResponse.json(
      { error: "Complete onboarding first." },
      { status: 403 }
    );
  }
  const { data: profiles } = await auth.sb
    .from("profiles")
    .select("id, full_name, role, is_support_agent")
    .eq("company_id", auth.companyId)
    .order("full_name", { ascending: true });
  return NextResponse.json({
    agents: (profiles ?? []).map((r) => ({
      id: r.id as string,
      fullName: (r.full_name as string | null) ?? null,
      role: (r.role as string | null) ?? null,
      isSupportAgent: !!r.is_support_agent,
    })),
  });
}
