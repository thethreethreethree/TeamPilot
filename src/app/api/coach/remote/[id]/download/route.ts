import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { treeAllowsRep } from "@/lib/api/treeAccess";
import { recordAudit } from "@/lib/audit/recordAudit";
import { getSession, getSessionTranscript } from "@/lib/data/salesCoach";
import { assetUrlToStoragePath, signAssetUrl } from "@/lib/storage/assets";
import { audioBaseIso } from "@/lib/coach/v5/segmentTiming";

/**
 * GET /api/coach/remote/[id]/download?kind=audio|transcript — a manager downloads one call (RSS Phase 5, F9.15;
 * docs/rss/docs/05-ROUTES.md). Managers only, through the same access as every manager action on a call: the call is
 * opened with the CALLER's client (RLS + the reporting tree), it must be in their company, and treeAllowsRep must
 * allow the rep. Every download is written to the audit log ("session.download").
 *
 * TRIMS ARE A PRIVACY PROMISE. The transcript comes from coaching_transcript_segments_current, which already hides
 * trimmed lines. The audio FILE still holds them (the player skips them), so a call with an active trim is not
 * downloadable as audio — handing out the raw file would hand out what a manager trimmed away.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "remote-download", windowMs: 60_000, max: 30 });
  if (limited) return limited;
  const mgr = await requireSalesCoachManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not a call id." }, { status: 400 });
  const kind = req.nextUrl.searchParams.get("kind");
  if (kind !== "audio" && kind !== "transcript") return NextResponse.json({ error: "kind must be audio or transcript." }, { status: 400 });

  const db = callerScopedDb(req) ?? (await createClient());
  const session = await getSession(id, db);
  if (!session || session.companyId !== mgr.companyId) return NextResponse.json({ error: "Session not found or not accessible." }, { status: 404 });
  if (!(await treeAllowsRep(req, session.agentId))) return NextResponse.json({ error: "Session not found or not accessible." }, { status: 404 });

  const name = (session.clientLabel ?? "call").replace(/[^\w.-]+/g, "_").slice(0, 60) || "call";
  const day = session.startedAt.slice(0, 10);

  if (kind === "transcript") {
    // The current version, trims already removed (the view), read as the caller.
    const lines = await getSessionTranscript(id, db);
    if (lines.length === 0) return NextResponse.json({ error: "This call has no transcript yet." }, { status: 404 });
    const base = Date.parse(audioBaseIso(session.startedAt, session.audioStartedAt) ?? session.startedAt);
    const who = (s: string) => (s === "agent" ? "Rep" : s === "customer" ? "Customer" : "Unclear");
    const text = lines
      .map((l) => {
        const at = l.spokenAt && Number.isFinite(base) ? `[${mmss(Date.parse(l.spokenAt) - base)}] ` : "";
        return `${at}${who(l.speaker)}: ${l.text}`;
      })
      .join("\n");
    await recordAudit(createAdminClient(), { companyId: mgr.companyId, actorId: mgr.userId, action: "session.download", objectType: "coaching_session", objectId: id, meta: { kind } });
    return new NextResponse(`${session.clientLabel ?? "Call"} — ${day}\n\n${text}\n`, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}-${day}-transcript.txt"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const path = assetUrlToStoragePath(session.audioAssetUrl);
  if (!path) return NextResponse.json({ error: "This call has no recording to download." }, { status: 404 });
  const admin = createAdminClient();
  const { data: trims, error: tErr } = await admin.from("recording_trims").select("id").eq("company_id", mgr.companyId).eq("session_id", id);
  if (tErr) {
    console.error(`[download] trim read failed session=${id}: ${tErr.message}`);
    return NextResponse.json({ error: "Couldn't check this call's trims, so nothing was downloaded." }, { status: 500 });
  }
  const trimIds = ((trims ?? []) as Array<{ id: string }>).map((t) => String(t.id));
  if (trimIds.length > 0) {
    const { data: restored, error: rErr } = await admin.from("recording_trim_restores").select("trim_id").eq("company_id", mgr.companyId).in("trim_id", trimIds);
    if (rErr) {
      console.error(`[download] restore read failed session=${id}: ${rErr.message}`);
      return NextResponse.json({ error: "Couldn't check this call's trims, so nothing was downloaded." }, { status: 500 });
    }
    if (((restored ?? []) as unknown[]).length < trimIds.length) {
      return NextResponse.json(
        { error: "This call has trimmed sections, so its audio can't be downloaded whole. The transcript download leaves them out." },
        { status: 409 },
      );
    }
  }
  const url = await signAssetUrl({ storagePath: path, expiresInSeconds: 120 });
  if (!url) return NextResponse.json({ error: "Couldn't prepare the download." }, { status: 502 });
  await recordAudit(admin, { companyId: mgr.companyId, actorId: mgr.userId, action: "session.download", objectType: "coaching_session", objectId: id, meta: { kind } });
  // ?json=1 → the link as JSON, so the panel can show a refusal's reason in place instead of a raw error page.
  if (req.nextUrl.searchParams.get("json") === "1") return NextResponse.json({ url });
  return NextResponse.redirect(url, 302);
}
