import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import { createClient } from "@/lib/supabase/server";

async function requireCompanyAdmin() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return { error: "Not authenticated.", status: 401 } as const;
  const { data: profile } = await sb
    .from("profiles")
    .select("role, company_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  const isCompanyAdmin =
    profile?.role === "CEO" ||
    profile?.role === "COO" ||
    profile?.role === "admin";
  if (!isCompanyAdmin || !profile?.company_id) {
    return { error: "Company admin only.", status: 403 } as const;
  }
  return { sb, companyId: profile.company_id };
}

export async function GET() {
  const ctx = await requireCompanyAdmin();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const { data } = await ctx.sb
    .from("profiles")
    .select("id, full_name, role, is_support_agent")
    .eq("company_id", ctx.companyId)
    .order("full_name", { ascending: true });

  return NextResponse.json({
    agents: (data ?? []).map((r) => ({
      id: r.id as string,
      fullName: (r.full_name as string | null) ?? null,
      role: (r.role as string | null) ?? null,
      isSupportAgent: !!r.is_support_agent,
    })),
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
