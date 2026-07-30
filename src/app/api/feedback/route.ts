import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { readBody, FeedbackCreateSchema } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { emitMentionEvents } from "@/lib/mentions/emit";

/**
 * POST /api/feedback — submit a new feedback record.
 *
 * Per §1.1, every input is a permanent asset. This route lands rows
 * into the `feedback` table which is append-only at the SQL layer
 * (migration 0018). The insert trigger emits a `feedback.submitted`
 * event into the §3.1 chain, where signal_sources mappings derive
 * `user_friction` signals from bug + friction reports.
 *
 * Auth required: the floating button on public pages prompts login
 * first. Anonymous feedback is intentionally not supported per the
 * user's design preference (every entry tied to a real person).
 *
 * GET /api/feedback — list feedback for the current company. Used by
 * the admin inbox + by users to see the journey of their own reports.
 */

async function getCompanyContext() {
  if (!supabaseEnabled) {
    return { error: "Live mode required.", status: 400 as const };
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return { error: "Not authenticated", status: 401 as const };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (!profile?.company_id) {
    return { error: "Complete onboarding first.", status: 400 as const };
  }
  return { supabase, companyId: profile.company_id, userId: auth.user.id };
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "feedback",
    windowMs: 60_000,
    max: 20,
  });
  if (limited) return limited;

  const ctx = await getCompanyContext();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const body = await readBody(req, FeedbackCreateSchema);
  if (body instanceof NextResponse) return body;

  const { data, error } = await ctx.supabase
    .from("feedback")
    .insert({
      company_id: ctx.companyId,
      author_id: ctx.userId,
      kind: body.kind,
      title: body.title,
      body: body.body ?? "",
      page_path: body.page_path,
      viewport: body.viewport ?? {},
      payload: body.payload ?? {},
      parent_id: body.parent_id ?? null,
    })
    .select("id, status, created_at")
    .single();

  if (error || !data) {
    if (error) console.error("[feedback POST] failed to insert feedback:", error);
    return NextResponse.json(
      { error: "Couldn't submit feedback." },
      { status: 500 }
    );
  }

  // Mentions become §3.1 chain events so a "mentions about me"
  // surface can derive from the audit trail later. Non-fatal: if
  // this fails we keep the feedback row.
  await emitMentionEvents({
    supabase: ctx.supabase,
    companyId: ctx.companyId,
    actorId: ctx.userId,
    bodyText: body.body ?? "",
    sourceKind: "feedback",
    sourceId: data.id,
  });

  return NextResponse.json({
    id: data.id,
    status: data.status,
    created_at: data.created_at,
  });
}

export async function GET(req: NextRequest) {
  const ctx = await getCompanyContext();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const kind = url.searchParams.get("kind");
  const mineOnly = url.searchParams.get("mine") === "1";

  let q = ctx.supabase
    .from("feedback")
    .select(
      "id, kind, title, body, page_path, payload, status, author_id, parent_id, triaged_at, resolved_at, resolution_note, duplicate_of, created_at"
    )
    .eq("company_id", ctx.companyId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (status) q = q.eq("status", status);
  if (kind) q = q.eq("kind", kind);
  if (mineOnly) q = q.eq("author_id", ctx.userId);

  const { data, error } = await q;
  if (error) {
    console.error("[feedback GET] failed to load feedback:", error);
    return NextResponse.json({ error: "Couldn't load feedback." }, { status: 500 });
  }
  return NextResponse.json({ feedback: data ?? [] });
}
