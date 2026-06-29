import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getCurrentSalesCorpus,
  appendSalesCorpusVersion,
} from "@/lib/data/salesCoach";
import { getSalesKnowledgeBase } from "@/lib/coach/v5/salesKnowledgeBase";
import { readBody } from "@/lib/api/validate";

/**
 * Sales Coach → editable methodology corpus (migration 0074).
 *
 * GET  → the company's current custom corpus (or empty), who/when last
 *        saved it, and which source the REVIEW coach is effectively using
 *        right now (custom | books | starter).
 * POST → append a new corpus version (immutable, §3.1).
 *
 * Both manager-gated (company admin OR sales_coach admin). The corpus
 * shapes the post-call REVIEW only; the live-cue path stays lean for
 * latency (§A16) — unchanged here.
 */
async function resolve() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return { ok: false as const, status: 401 as const };
  const { data: profile } = await sb
    .from("profiles")
    .select("role, company_id, sales_coach_role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const role = (profile?.role as string | null) ?? null;
  const isCompanyAdmin = role === "CEO" || role === "COO" || role === "admin";
  const isManager = isCompanyAdmin || profile?.sales_coach_role === "admin";
  return {
    ok: true as const,
    userId: auth.user.id,
    companyId: (profile?.company_id as string | null) ?? null,
    isManager,
  };
}

export async function GET() {
  const ctx = await resolve();
  if (!ctx.ok) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!ctx.companyId) {
    return NextResponse.json({ error: "No company context." }, { status: 403 });
  }
  if (!ctx.isManager) {
    return NextResponse.json(
      { error: "The methodology corpus is managed by admins." },
      { status: 403 }
    );
  }

  const corpus = await getCurrentSalesCorpus(ctx.companyId);

  let updatedByName: string | null = null;
  if (corpus?.createdById) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", corpus.createdById)
      .maybeSingle();
    updatedByName = (data?.full_name as string | null) ?? null;
  }

  // What the review coach actually uses right now (§3.4 — the truth, not
  // an aspiration): custom corpus › built-in books KB › inline starter.
  const effectiveSource = corpus
    ? "custom"
    : getSalesKnowledgeBase()
      ? "books"
      : "starter";

  return NextResponse.json({
    content: corpus?.content ?? "",
    isCustom: !!corpus,
    updatedAt: corpus?.createdAt ?? null,
    updatedByName,
    effectiveSource,
  });
}

const Body = z.object({
  content: z.string().trim().min(1).max(100000),
});

export async function POST(req: NextRequest) {
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const ctx = await resolve();
  if (!ctx.ok) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!ctx.companyId) {
    return NextResponse.json({ error: "No company context." }, { status: 403 });
  }
  if (!ctx.isManager) {
    return NextResponse.json(
      { error: "Only an admin can edit the methodology corpus." },
      { status: 403 }
    );
  }

  const ok = await appendSalesCorpusVersion({
    companyId: ctx.companyId,
    content: body.content,
    createdBy: ctx.userId,
  });
  if (!ok) {
    return NextResponse.json({ error: "Couldn't save." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
