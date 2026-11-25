import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hiddenFrom } from "@/lib/coach/remote/hidePhrases";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { recordAudit } from "@/lib/audit/recordAudit";
import { activeGrant } from "@/lib/coach/remote/callGrants";
import { assetUrlToStoragePath, signAssetUrl } from "@/lib/storage/assets";
import { activeTrims, type TrimRow } from "@/lib/coach/remote/trim";

/**
 * GET /api/coach/remote/shared/[id] — the read-only view of ONE call for someone an admin granted access to (0336, F3.8).
 * Only with an ACTIVE grant for this viewer in this company (activeGrant); otherwise 404 — the call's existence is not
 * confirmed. Returns the call's label, date and rep, the current transcript, the Highlights (key points, next steps),
 * the signed audio and the trimmed ranges to skip. Every open is audited (call.view_granted). Service role, every
 * statement pinned to the company — no RLS policy on the call's own tables is widened.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "shared-call", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;
  const admin = createAdminClient();
  let grant;
  try {
    grant = await activeGrant(admin, ctx.companyId, id, ctx.userId);
  } catch (e) {
    console.error(`[shared-call] grant read failed session=${id}: ${e instanceof Error ? e.message : String(e)}`);
    return NextResponse.json({ error: "Couldn't open the call." }, { status: 500 });
  }
  if (!grant) return NextResponse.json({ error: "You don't have access to this call." }, { status: 404 });
  // A call hidden by a company phrase (0337) stays hidden from a grantee too: only its rep and admins can read it.
  try {
    if ((await hiddenFrom(admin, [id], ctx.userId)).has(id)) return NextResponse.json({ error: "This call is hidden by a company rule." }, { status: 404 });
  } catch (e) {
    console.error(`[shared-call] hidden check failed session=${id}: ${e instanceof Error ? e.message : String(e)}`);
    return NextResponse.json({ error: "Couldn't open the call." }, { status: 500 });
  }

  const [sess, segs, brief, trims] = await Promise.all([
    admin.from("coaching_sessions").select("id, agent_id, client_label, started_at, audio_asset_url").eq("id", id).eq("company_id", ctx.companyId).maybeSingle(),
    admin.from("coaching_transcript_segments_current").select("speaker, text, seq").eq("session_id", id).order("seq", { ascending: true }),
    admin.from("remote_call_briefs").select("key_points, next_steps, transcript_version").eq("session_id", id).eq("company_id", ctx.companyId).order("transcript_version", { ascending: false }).limit(1),
    admin.from("recording_trims").select("id, start_ms, end_ms").eq("session_id", id).eq("company_id", ctx.companyId),
  ]);
  const trimIds = ((trims.data ?? []) as Array<{ id: string }>).map((t) => String(t.id));
  const restores = trimIds.length
    ? await admin.from("recording_trim_restores").select("trim_id").eq("company_id", ctx.companyId).in("trim_id", trimIds)
    : { data: [], error: null };
  const failed = [sess, segs, brief, trims, restores].find((r) => r.error);
  if (failed?.error || !sess.data) {
    console.error(`[shared-call] read failed session=${id}: ${failed?.error?.message ?? "no session"}`);
    return NextResponse.json({ error: "Couldn't open the call." }, { status: 500 });
  }
  const s = sess.data as { agent_id: string; client_label: string | null; started_at: string; audio_asset_url: string | null };
  const { data: rep } = await admin.from("profiles").select("full_name").eq("id", s.agent_id).eq("company_id", ctx.companyId).maybeSingle();
  const path = assetUrlToStoragePath(s.audio_asset_url);
  const audioUrl = path ? await signAssetUrl({ storagePath: path, expiresInSeconds: 3600 }) : null;
  const b = ((brief.data ?? []) as Array<{ key_points: Array<{ text: string }>; next_steps: Array<{ text: string }> }>)[0];
  await recordAudit(admin, { companyId: ctx.companyId, actorId: ctx.userId, action: "call.view_granted", objectType: "coaching_session", objectId: id, meta: { grantId: grant.id } });
  return NextResponse.json({
    call: { label: s.client_label, startedAt: s.started_at, repName: (rep?.full_name as string | null) ?? null },
    reason: grant.reason,
    audioUrl,
    trims: activeTrims((trims.data ?? []) as TrimRow[], ((restores.data ?? []) as Array<{ trim_id: string }>).map((r) => String(r.trim_id))).map((t) => ({ startMs: t.start_ms, endMs: t.end_ms })),
    transcript: ((segs.data ?? []) as Array<{ speaker: string; text: string; seq: number }>).map((x) => ({ speaker: x.speaker, text: x.text, seq: x.seq })),
    highlights: b ? { keyPoints: (b.key_points ?? []).map((k) => k.text), nextSteps: (b.next_steps ?? []).map((k) => k.text) } : null,
  });
}
