import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * Unit economics & break-even (0176).
 *
 * `break_even_revenue` is NULL whenever it is undefined, and `undefined_because` explains why in words.
 *
 * That pairing is the point. The conventional implementation divides fixed costs by the contribution ratio
 * unconditionally — and when the contribution margin is NEGATIVE it still returns a large, finite,
 * plausible-looking target. The founder reads "hit £480,000 and we're fine" at the exact moment the truth
 * is "every additional sale makes the loss bigger; there is no volume that saves you."
 *
 * It is the most dangerous number in a financial system because it is wrong in the direction of ACTION: it
 * does not merely mislead, it instructs. So the API carries the refusal AND its reason, and the UI is
 * required to render the reason rather than an empty cell.
 */
export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ months: [], projects: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const [be, ue] = await Promise.all([
    sb
      .from("fin_break_even")
      .select("month, revenue, variable_cost, fixed_cost, contribution, contribution_ratio, break_even_revenue, undefined_because")
      .order("month", { ascending: false })
      .limit(12),
    sb
      .from("fin_unit_economics")
      .select("project_id, project_name, revenue, variable_cost, contribution, contribution_ratio, loses_money_per_sale")
      .order("revenue", { ascending: false }),
  ]);

  if (be.error) return NextResponse.json({ error: "Could not compute break-even." }, { status: 500 });

  return NextResponse.json({ months: be.data ?? [], projects: ue.data ?? [] });
}
