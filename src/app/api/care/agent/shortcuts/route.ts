import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import {
  createCannedResponse,
  listCannedResponses,
} from "@/lib/data/care";
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
  return { companyId: profile.company_id, userId: auth.user.id };
}

export async function GET() {
  const ctx = await requireAgent();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const shortcuts = await listCannedResponses();
  return NextResponse.json({ shortcuts });
}

const Body = z.object({
  shortcut: z.string().min(1).max(40),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
});

export async function POST(req: NextRequest) {
  const ctx = await requireAgent();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  const created = await createCannedResponse({
    shortcut: body.shortcut,
    title: body.title,
    body: body.body,
    companyId: ctx.companyId,
    createdBy: ctx.userId,
  });
  if (!created) {
    return NextResponse.json(
      { error: "Couldn't create shortcut (duplicate shortcut?)." },
      { status: 500 }
    );
  }
  return NextResponse.json({ shortcut: created });
}
