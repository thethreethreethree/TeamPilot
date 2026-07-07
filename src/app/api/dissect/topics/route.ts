import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { createClient } from "@/lib/supabase/server";
import { saveDissectTopic, listDissectTopics } from "@/lib/data/dissect";
import { MAX_SOURCE_CHARS } from "@/lib/dissect/engine";

/**
 * GET  /api/dissect/topics        — list the caller's saved dissections.
 * POST /api/dissect/topics        — save the current topic (Save the topic).
 *
 * Owner-private (§A10). company_id / user_id are server-derived in the data
 * layer, never taken from the request. Saved topics are append-only (§3.1) —
 * there is no update/delete route by design (Close keeps a saved topic; only an
 * UNSAVED thread is discarded, and that never reaches the server).
 */

export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const topics = await listDissectTopics();
  return NextResponse.json({ topics });
}

const SaveBody = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(MAX_SOURCE_CHARS),
  summary: z.string().max(8000).nullable().optional(),
  // The dissection object, echoed from the client's ephemeral state. Stored as
  // jsonb; shape is validated on read via the engine's parser, so accept loosely.
  dissect: z.unknown().optional(),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "dissect-save",
    windowMs: 60_000,
    max: 30,
  });
  if (limited) return limited;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await readBody(req, SaveBody);
  if (body instanceof NextResponse) return body;

  const id = await saveDissectTopic({
    title: body.title,
    sourceText: body.content,
    summary: body.summary ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dissect: (body.dissect as any) ?? null,
  });
  if (!id) {
    // §3.4 — never report a save that didn't land.
    return NextResponse.json(
      { error: "Could not save the topic. Please try again." },
      { status: 500 }
    );
  }
  return NextResponse.json({ id });
}
