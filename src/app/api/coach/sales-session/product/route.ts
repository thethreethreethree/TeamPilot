import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getCurrentSalesCorpus,
  appendSalesCorpusVersion,
} from "@/lib/data/salesCoach";
import { readBody } from "@/lib/api/validate";

/**
 * Sales Coach → editable PRODUCT / brand details (migration 0078).
 *
 * The company's product knowledge — what the rep is selling — stored as the
 * 'product' kind in the same append-only corpus store as the methodology
 * (§A21: reuses the corpus data layer; §3.1: each save appends a version).
 * It feeds Prep Time + product-aware coaching (wired in a later build).
 *
 * GET  → the company's current product details (or empty) + who/when saved.
 * POST → append a new product version (immutable).
 * Manager-gated, mirroring the methodology corpus route.
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
      { error: "Product details are managed by admins." },
      { status: 403 }
    );
  }

  const corpus = await getCurrentSalesCorpus(ctx.companyId, "product");

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

  return NextResponse.json({
    content: corpus?.content ?? "",
    isSet: !!corpus,
    updatedAt: corpus?.createdAt ?? null,
    updatedByName,
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
      { error: "Only an admin can edit the product details." },
      { status: 403 }
    );
  }

  const ok = await appendSalesCorpusVersion({
    companyId: ctx.companyId,
    content: body.content,
    createdBy: ctx.userId,
    kind: "product",
  });
  if (!ok) {
    return NextResponse.json({ error: "Couldn't save." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
