import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { REMOTE_CONTEXTS } from "@/lib/coach/sessionContext";
import { gettingStarted } from "@/lib/coach/remote/gettingStarted";

/**
 * GET /api/coach/remote/getting-started — the caller's own first-week checklist (F36.40). Four existence checks on the
 * caller's OWN rows, through their own client (RLS): a phone/video call, a reviewed Next Meeting checklist, a prospect,
 * a practice attempt. A failed read is an error (500), never "not done yet".
 */
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-getting-started", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const db = callerScopedDb(req) ?? (await createClient());
  const [call, review, prospect, practice] = await Promise.all([
    db.from("coaching_sessions").select("id", { count: "exact", head: true }).eq("agent_id", ctx.userId).in("context", [...REMOTE_CONTEXTS]),
    db.from("remote_checklist_reviews").select("id", { count: "exact", head: true }).eq("reviewed_by", ctx.userId),
    db.from("remote_prospects").select("id", { count: "exact", head: true }).eq("rep_id", ctx.userId),
    db.from("training_attempts").select("id", { count: "exact", head: true }).eq("rep_id", ctx.userId),
  ]);
  const failed = [call, review, prospect, practice].find((r) => r.error);
  if (failed?.error) {
    console.error(`[getting-started] read failed user=${ctx.userId}: ${failed.error.message}`);
    return NextResponse.json({ error: "Couldn't load your checklist." }, { status: 500 });
  }
  return NextResponse.json(
    gettingStarted({
      call: (call.count ?? 0) > 0,
      checklist: (review.count ?? 0) > 0,
      prospect: (prospect.count ?? 0) > 0,
      practice: (practice.count ?? 0) > 0,
    }),
  );
}
