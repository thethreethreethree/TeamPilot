import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { readBody } from "@/lib/api/validate";

/**
 * POST /api/finance/periods/[id] — { action: "close" | "reopen" | "lock" } via the 0117 RPCs
 * (fin_close_period / fin_reopen_period / fin_lock_period). Authority (controller/cfo; lock = cfo)
 * is enforced in the DB.
 */
const BodySchema = z.object({ action: z.enum(["close", "reopen", "lock"]) }).strict();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseEnabled) return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  const { id } = await params;
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await readBody(req, BodySchema);
  if (body instanceof NextResponse) return body;

  const rpc =
    body.action === "close" ? "fin_close_period" : body.action === "reopen" ? "fin_reopen_period" : "fin_lock_period";
  const { error } = await sb.rpc(rpc, { p_period_id: id });
  if (error) {
    console.error(`[finance/periods/${body.action}] failed:`, error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
