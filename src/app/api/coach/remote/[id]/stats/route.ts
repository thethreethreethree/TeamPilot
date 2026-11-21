import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { getSession } from "@/lib/data/salesCoach";
import { loadSessionTiming } from "@/lib/coach/remote/interactionStats";
import { computeInteractionStats, talkTimeLanes } from "@/lib/coach/remote/stats";
import { assetUrlToStoragePath, signAssetUrl } from "@/lib/storage/assets";

/**
 * GET /api/coach/remote/:id/stats — interaction stats and talk-time lanes for one phone/video session, plus the
 * rep's own 30-day averages (RSS Phase 2; docs/rss/docs/06-UI-SPEC.md stat strip). NEVER a Gong benchmark: norms
 * for these calls must come from ELOSTATE's own sessions (docs/04).
 *
 * Read through the caller's client (getSession and the transcript are RLS-scoped; the 0273 reporting tree
 * applies). Computed from loadSessionTiming — the same read the pipeline stores from — so the strip and the
 * stored row cannot disagree. `estimated` says whether any line's end was estimated (older/live calls).
 */
const MISSING = new Set(["PGRST205", "42P01"]);
const DAY = 86_400_000;

type Avg = { talkRatioTime: number | null; longestRepMonologueMs: number | null; longestCustomerStoryMs: number | null; interactivity: number | null; patienceMs: number | null; repQuestionsPerHour: number | null; sessions: number };

function mean(xs: Array<number | null>): number | null {
  const v = xs.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "remote-stats", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;
  const db = callerScopedDb(req) ?? (await createClient());

  const session = await getSession(id, db);
  if (!session) return NextResponse.json({ error: "Session not found or not accessible." }, { status: 404 });

  const timing = await loadSessionTiming(db, id);
  if (!timing) return NextResponse.json({ remote: false });
  if (timing.segments.length === 0) {
    return NextResponse.json({ remote: true, measurable: false, untimed: timing.untimed });
  }
  const stats = computeInteractionStats(timing.segments);
  const lanes = talkTimeLanes(timing.segments);

  // The rep's own last 30 days, latest transcript version per session, this session excluded.
  let averages: Avg | null = null;
  const { data: past, error } = await db
    .from("session_interaction_stats")
    .select("session_id, transcript_version, talk_ratio_time, longest_rep_monologue_ms, longest_customer_story_ms, interactivity, patience_ms, rep_questions_per_hour")
    .eq("rep_id", timing.repId)
    .neq("session_id", id)
    .gte("computed_at", new Date(Date.now() - 30 * DAY).toISOString())
    .order("transcript_version", { ascending: false })
    .limit(500);
  if (error && !MISSING.has(String(error.code))) console.error(`[remote/stats] averages read failed: ${error.message}`);
  if (!error && past) {
    const latest = new Map<string, Record<string, unknown>>();
    for (const r of past as Array<Record<string, unknown>>) if (!latest.has(String(r.session_id))) latest.set(String(r.session_id), r);
    const rows = [...latest.values()];
    if (rows.length > 0) {
      const n = (k: string) => rows.map((r) => (r[k] == null ? null : Number(r[k])));
      averages = {
        talkRatioTime: mean(n("talk_ratio_time")),
        longestRepMonologueMs: mean(n("longest_rep_monologue_ms")),
        longestCustomerStoryMs: mean(n("longest_customer_story_ms")),
        interactivity: mean(n("interactivity")),
        patienceMs: mean(n("patience_ms")),
        repQuestionsPerHour: mean(n("rep_questions_per_hour")),
        sessions: rows.length,
      };
    }
  }

  // The player's audio: the stored pointer is a storage path (upload-recording) or a full URL (session PATCH).
  // Signed only here, after the caller's RLS read proved they may see this session; one hour is a listening session.
  const path = assetUrlToStoragePath(session.audioAssetUrl);
  const audioUrl = path
    ? await signAssetUrl({ storagePath: path, expiresInSeconds: 3600 })
    : session.audioAssetUrl?.startsWith("https://")
      ? session.audioAssetUrl
      : null;

  return NextResponse.json({
    remote: true,
    measurable: true,
    estimated: timing.estimated,
    untimed: timing.untimed,
    stats,
    lanes,
    averages,
    audioUrl,
  });
}
