import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";

/**
 * POST /api/coach/sales-session/door-log/capture-diag — record WHY a DoorLog pitch produced no audio
 * (founder 2026-08-23). The recorder used to swallow every failure, so a "recorded no audio" was unexplainable
 * and each fix was a guess. The client now reports the recorder's own ground-truth observations here on any
 * zero-audio outcome; we append a `doorlog.capture_failed` event so the real cause (mic track ended/muted, a
 * MediaRecorder error, the tab backgrounded, the wake lock denied, the chosen mimeType, duration, UA) is on the
 * record and queryable — instead of assumed.
 *
 * Authenticated + company-pinned (INV15: the service-role write fixes company_id to the CALLER'S own company, so
 * a diag can never be attributed to another tenant). Best-effort telemetry: never blocks the rep's flow.
 */
const Body = z.object({
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  diag: z.object({
    sawData: z.boolean().optional(),
    // TOTAL bytes across all data events — THE signal that distinguishes a real-audio capture from a tiny stub
    // (iOS webm produced sub-1KB stubs read as sawData=true). Was being stripped by this schema, blinding diagnosis.
    capturedBytes: z.number().int().nonnegative().max(2_000_000_000).optional(),
    chunkCount: z.number().int().nonnegative().max(100_000).optional(),
    chunksUploaded: z.number().int().nonnegative().max(100_000).optional(),
    durationMs: z.number().nonnegative().max(86_400_000).optional(),
    mimeType: z.string().max(120).optional(),
    recorderError: z.string().max(300).nullable().optional(),
    trackEnded: z.boolean().optional(),
    trackMuted: z.boolean().optional(),
    trackReadyState: z.string().max(40).optional(),
    wakeLockGranted: z.boolean().optional(),
    hiddenDuringRecording: z.number().int().nonnegative().max(100_000).optional(),
    ua: z.string().max(500).optional(),
  }),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "door-log-capture-diag", windowMs: 60_000, max: 60 });
  if (limited) return limited;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const companyId = (await getCurrentCompanyId()) ?? undefined;
  if (!companyId) return NextResponse.json({ error: "No company context." }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid diagnostics." }, { status: 400 });

  try {
    await createAdminClient()
      .from("events")
      .insert({
        company_id: companyId, // pinned to the caller's company, never client-supplied (INV15)
        actor: auth.user.id,
        kind: "doorlog.capture_failed",
        subject: `rep:${auth.user.id}`,
        payload: { ...parsed.data.diag, localDate: parsed.data.localDate ?? null },
      });
  } catch (e) {
    // Best-effort: a telemetry write failure must never surface to the rep. Log it (CWE-209: no raw error out).
    console.error(`[door-log capture-diag] insert failed:`, e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
  return NextResponse.json({ ok: true });
}
