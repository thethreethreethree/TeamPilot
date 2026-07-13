import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDissectTopic } from "@/lib/data/dissect";

/**
 * GET /api/dissect/topics/[id] — load one saved dissection.
 *
 * Owner-private: getDissectTopic uses the RLS user client, so a topic that isn't
 * the caller's own returns null → 404. No cross-user read.
 */
// LLM route: longer serverless budget than Vercel's short default (awaits LLM calls via a lib chain).
export const maxDuration = 60;

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { id } = await context.params;
  const topic = await getDissectTopic(id);
  if (!topic) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ topic });
}
