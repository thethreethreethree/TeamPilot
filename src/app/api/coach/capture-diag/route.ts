import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";

/**
 * POST /api/coach/capture-diag — record WHY a coach recorder (live sales / meeting / C.A.R.E voice) produced
 * no/little audio (founder 2026-08-23, capture-blindness class sweep). Recorders used to swallow every failure,
 * so a zero-audio session was unexplainable and each fix was a guess. The client reports the recorder's
 * ground-truth observations here; we append a `coach.capture_failed` event so the real cause (mic track
 * ended/muted, a MediaRecorder error, backgrounding, wake-lock denied, mimeType, duration, UA) is on the record.
 *
 * Authenticated + company-PINNED (INV15: company_id is the caller's own, never client-supplied). Best-effort:
 * never blocks the user's flow. (DoorLog's pre-session pitch flow has its own /door-log/capture-diag; this is the
 * session-scoped one for the other three recorders.)
 */
const Body = z.object({
  surface: z.enum(["live", "meeting", "care", "doorlog"]),
  sessionId: z.string().max(200).optional(),
  diag: z.object({
    sawData: z.boolean().optional(),
    chunkCount: z.number().int().nonnegative().max(1_000_000).optional(),
    chunksUploaded: z.number().int().nonnegative().max(1_000_000).optional(),
    durationMs: z.number().nonnegative().max(86_400_000).optional(),
    mimeType: z.string().max(120).optional(),
    recorderError: z.string().max(300).nullable().optional(),
    trackEnded: z.boolean().optional(),
    trackMuted: z.boolean().optional(),
    trackReadyState: z.string().max(40).optional(),
    wakeLockGranted: z.boolean().optional(),
    hiddenDuringRecording: z.number().int().nonnegative().max(1_000_000).optional(),
    ua: z.string().max(500).optional(),
  }),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "coach-capture-diag", windowMs: 60_000, max: 60 });
  if (limited) return limited;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const companyId = (await getCurrentCompanyId()) ?? undefined;
  if (!companyId) return NextResponse.json({ error: "No company context." }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid diagnostics." }, { status: 400 });

  // Subject scopes the event to its session when there is one; otherwise to the reporting user.
  const subject = parsed.data.sessionId ? `coaching_session:${parsed.data.sessionId}` : `rep:${auth.user.id}`;
  try {
    await createAdminClient()
      .from("events")
      .insert({
        company_id: companyId, // pinned to the caller's company, never client-supplied (INV15)
        actor: auth.user.id,
        kind: "coach.capture_failed",
        subject,
        payload: { surface: parsed.data.surface, ...parsed.data.diag },
      });
  } catch (e) {
    console.error(`[coach capture-diag] insert failed:`, e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
  return NextResponse.json({ ok: true });
}
