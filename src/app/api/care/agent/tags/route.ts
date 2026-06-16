import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import { createTag, listTags } from "@/lib/data/care";
import { createClient } from "@/lib/supabase/server";

async function requireAgent() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return { error: "Not authenticated.", status: 401 } as const;
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
  if (!isAgent || !profile?.company_id) {
    return { error: "Agent only.", status: 403 } as const;
  }
  return { companyId: profile.company_id };
}

export async function GET() {
  const ctx = await requireAgent();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const tags = await listTags();
  return NextResponse.json({ tags });
}

const Body = z.object({
  name: z.string().min(1).max(60),
  color: z.string().min(1).max(20),
});

export async function POST(req: NextRequest) {
  const ctx = await requireAgent();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  const tag = await createTag({
    name: body.name,
    color: body.color,
    companyId: ctx.companyId,
  });
  if (!tag) {
    return NextResponse.json(
      { error: "Couldn't create tag." },
      { status: 500 }
    );
  }
  return NextResponse.json({ tag });
}
