import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { readBody } from "@/lib/api/validate";
import {
  getSession,
  getSessionTranscript,
  setSessionStatus,
} from "@/lib/data/salesCoach";

/**
 * Live Sales Coach — single session.
 *
 * GET   → the session + its full diarized transcript (RLS-scoped).
 * PATCH → forward-only status change ('ended' | 'reviewed'),
 *         optionally attaching the stored audio asset pointer.
 */

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const session = await getSession(id);
  if (!session) {
    return NextResponse.json(
      { error: "Session not found or not accessible." },
      { status: 404 }
    );
  }
  const transcript = await getSessionTranscript(id);
  return NextResponse.json({ session, transcript });
}

const PatchSchema = z.object({
  status: z.enum(["ended", "reviewed"]),
  audioAssetUrl: z.string().url().max(2000).optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await readBody(req, PatchSchema);
  if (body instanceof NextResponse) return body;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  // RLS-scoped read gates access: a user can only see sessions in their
  // own company, so a successful getSession authorizes the transition.
  const existing = await getSession(id);
  if (!existing) {
    return NextResponse.json(
      { error: "Session not found or not accessible." },
      { status: 404 }
    );
  }

  const updated = await setSessionStatus({
    sessionId: id,
    status: body.status,
    audioAssetUrl: body.audioAssetUrl,
  });
  if (!updated) {
    return NextResponse.json(
      { error: "Couldn't update the session." },
      { status: 500 }
    );
  }
  return NextResponse.json({ session: updated });
}
