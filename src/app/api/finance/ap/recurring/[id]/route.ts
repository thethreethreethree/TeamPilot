import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { readBody } from "@/lib/api/validate";

/**
 * POST /api/finance/ap/recurring/[id] —
 *   { action: "generate" }         — fin_generate_recurring_bill → a draft bill id.
 *   { action: "toggle", active }   — activate/deactivate the template.
 */
const BodySchema = z
  .object({ action: z.enum(["generate", "toggle"]), active: z.boolean().optional() })
  .strict();

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

  if (body.action === "toggle") {
    const { error } = await sb
      .from("fin_recurring_bills")
      .update({ is_active: body.active ?? true })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const { data, error } = await sb.rpc("fin_generate_recurring_bill", { p_template_id: id });
  if (error) {
    console.error("[ap/recurring/generate] failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, billId: data });
}
