import { NextRequest, NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { recordAudit } from "@/lib/audit/recordAudit";
import { getSession, getSessionTranscript } from "@/lib/data/salesCoach";
import { generateSessionArtifacts } from "@/lib/coach/v5/generateSessionArtifacts";
import { readCompanyCorrections } from "@/lib/coach/remote/vocabulary";
import { APPLY_BATCH, planReapply, type Line } from "@/lib/coach/remote/vocabularyReapply";

export const maxDuration = 300;

/**
 * POST /api/coach/remote/settings/vocabulary/reapply { apply?: boolean } — the company's "heard as" corrections on PAST
 * calls (2026-11-26, F8.9; founder picker 2026-11-26: "On request, with a count"). Company admins only.
 *   apply false (default) → the count: how many of the last 180 days' finished phone/video calls (newest 500) would
 *     change, and how many lines — nothing is written. Each changed call's AI reads would be redone (one AI pass each).
 *   apply true → up to APPLY_BATCH of those calls get a new transcript version with the corrected lines (0368: the old
 *     version stays as history; refused when the call changed since it was read), then their AI reads are redone after
 *     the response, as a trim does. The rest wait for the next click. Audited.
 * Service role, every statement pinned to the admin's company. Reads and returns counts only, never transcript text.
 */
const DAY = 86_400_000;
const SCAN = 500;

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "vocabulary-reapply", windowMs: 60_000, max: 6 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a company admin can fix past calls." }, { status: 403 });
  let b: { apply?: unknown } = {};
  try {
    b = await req.json();
  } catch {
    b = {};
  }
  const apply = b.apply === true;
  const admin = createAdminClient();
  const corrections = await readCompanyCorrections(admin, ctx.companyId);
  if (corrections === null) return NextResponse.json({ error: "Couldn't read your vocabulary." }, { status: 500 });
  if (corrections.length === 0) return NextResponse.json({ error: "Add what a word is heard as first — there's nothing to fix past calls with." }, { status: 400 });

  const { data: calls, error: cErr } = await admin
    .from("coaching_sessions")
    .select("id")
    .eq("company_id", ctx.companyId)
    .in("context", ["phone", "video"])
    .neq("status", "active")
    .gte("started_at", new Date(Date.now() - 180 * DAY).toISOString())
    .order("started_at", { ascending: false })
    .limit(SCAN);
  if (cErr) {
    console.error(`[vocabulary-reapply] calls read failed company=${ctx.companyId}: ${cErr.message}`);
    return NextResponse.json({ error: "Couldn't read your calls." }, { status: 500 });
  }
  const ids = ((calls ?? []) as Array<{ id: string }>).map((c) => String(c.id));
  const lines: Line[] = [];
  const versionOf = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 25) {
    const { data, error } = await fetchAllPagedResult<{ id: number; session_id: string; seq: number; text: string; version: number }>(
      (from, to) => admin.from("coaching_transcript_segments_current").select("id, session_id, seq, text, version").in("session_id", ids.slice(i, i + 25)).order("id", { ascending: true }).range(from, to),
      { label: "vocabulary reapply lines", maxRows: 500_000 },
    );
    if (error) {
      console.error(`[vocabulary-reapply] lines read failed company=${ctx.companyId}: ${error.message}`);
      return NextResponse.json({ error: "Couldn't read your calls." }, { status: 500 });
    }
    for (const l of data ?? []) {
      lines.push({ session_id: String(l.session_id), seq: Number(l.seq), text: String(l.text ?? "") });
      versionOf.set(String(l.session_id), Math.max(versionOf.get(String(l.session_id)) ?? 0, Number(l.version)));
    }
  }
  const plan = planReapply(lines, corrections);
  const lineCount = plan.reduce((n, c) => n + Object.keys(c.texts).length, 0);
  const counts = { calls: plan.length, lines: lineCount, scanned: ids.length, capped: ids.length >= SCAN };
  if (!apply) return NextResponse.json({ ...counts, batch: Math.min(APPLY_BATCH, plan.length) });

  const done: string[] = [];
  let skipped = 0;
  for (const c of plan.slice(0, APPLY_BATCH)) {
    const { data: v, error } = await admin.rpc("rss_transcript_version_with_texts", { p_session_id: c.sessionId, p_from_version: versionOf.get(c.sessionId) ?? 0, p_texts: c.texts });
    if (error) {
      console.error(`[vocabulary-reapply] version write failed session=${c.sessionId}: ${error.message}`);
      skipped += 1;
    } else if (Number(v) < 0) skipped += 1; // changed since it was read: next click picks it up
    else done.push(c.sessionId);
  }
  await recordAudit(admin, {
    companyId: ctx.companyId,
    actorId: ctx.userId,
    action: "vocabulary.reapply",
    objectType: "company",
    objectId: ctx.companyId,
    meta: { fixed: done.length, skipped, lines: lineCount },
  });
  // The AI reads of each fixed call are redone on its new version (one AI pass each), after the response.
  after(async () => {
    for (const id of done) {
      try {
        const session = await getSession(id, admin);
        if (!session) continue;
        const segments = await getSessionTranscript(id, admin);
        await generateSessionArtifacts({ companyId: ctx.companyId, actorId: ctx.userId, sessionId: id, session, segments });
      } catch (err) {
        console.error(`[vocabulary-reapply] reprocess failed session=${id}:`, err);
      }
    }
  });
  return NextResponse.json({ ...counts, fixed: done.length, skipped, remaining: Math.max(0, plan.length - done.length) });
}
