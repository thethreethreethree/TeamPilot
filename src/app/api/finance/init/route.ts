import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { readBody } from "@/lib/api/validate";

/**
 * POST /api/finance/init — bootstrap a company's finances (settings + standard COA) via the
 * fin_init_company RPC (migration 0119). The RPC is configure-gated (controller/cfo, or a platform
 * admin via the bridge), so authorization lives in the DB, not here. Idempotent (the RPC uses
 * on-conflict-do-nothing).
 */
const BodySchema = z.object({ baseCurrency: z.string().length(3).optional() }).strict();

export async function POST(req: NextRequest) {
  if (!supabaseEnabled) {
    return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  }
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const body = await readBody(req, BodySchema);
  if (body instanceof NextResponse) return body;

  const { error } = await sb.rpc("fin_init_company", {
    p_base_currency: (body.baseCurrency ?? "USD").toUpperCase(),
  });
  if (error) {
    // Not-authorized / missing-migration both surface here; log detail server-side, return a clean
    // message (don't leak the raw DB error to the client).
    console.error("[finance/init] fin_init_company failed:", error.message);
    return NextResponse.json(
      { error: "Couldn't initialize finance. You may not have permission, or the finance module isn't available." },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}
