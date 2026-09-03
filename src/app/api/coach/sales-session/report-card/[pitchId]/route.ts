import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";

/**
 * GET /api/coach/sales-session/report-card/[pitchId] — one pitch's detail for the Report Card drill-down:
 * transcript + per-pitch analysis (summary, strengths, improvements, scores). RLS-scoped (rep+manager,
 * Q4) — reading via the user client means a rep sees only their own; a manager sees the team's. Read-only.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ pitchId: string }> }
) {
  const sb = callerScopedDb(req) ?? (await createClient());
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { pitchId } = await context.params;

  // RLS gates the pitch read to owner-or-manager; a non-null row proves access (mirrors the coach
  // sales-session readback discipline — no separate ownership check needed, RLS is the gate here).
  const { data: pitch } = await sb
    .from("pitches")
    .select("id, name, status, error, recorded_at, duration_ms, door_knocks!inner(outcome)")
    .eq("id", pitchId)
    .maybeSingle();
  if (!pitch) {
    return NextResponse.json({ error: "Pitch not found or not accessible." }, { status: 404 });
  }

  const [{ data: tr }, { data: an }] = await Promise.all([
    sb.from("pitch_transcripts").select("text, word_count").eq("pitch_id", pitchId).maybeSingle(),
    sb
      .from("pitch_analyses")
      .select("summary, strengths, improvements, scores")
      .eq("pitch_id", pitchId)
      .maybeSingle(),
  ]);

  const knock = pitch.door_knocks as unknown as { outcome: string } | { outcome: string }[];
  return NextResponse.json({
    id: pitch.id as string,
    name: pitch.name as string,
    status: pitch.status as string,
    error: (pitch.error as string | null) ?? null,
    recordedAt: pitch.recorded_at as string,
    durationMs: (pitch.duration_ms as number | null) ?? null,
    outcome: (Array.isArray(knock) ? knock[0]?.outcome : knock?.outcome) ?? "unknown",
    transcript: (tr?.text as string | undefined) ?? null,
    analysis: an
      ? {
          summary: an.summary as string,
          strengths: (an.strengths as string[]) ?? [],
          improvements: (an.improvements as string[]) ?? [],
          scores: (an.scores as Record<string, number>) ?? {},
        }
      : null,
  });
}
