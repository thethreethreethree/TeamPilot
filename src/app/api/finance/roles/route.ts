import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";

/**
 * Finance roles + APPROVAL LIMITS (migration 0157).
 *
 * GET  /api/finance/roles — who holds which finance role, and each approver's ceiling.
 * POST /api/finance/roles — grant a role and/or set an approval limit. Controller/CFO only (RLS).
 *
 * WHY THIS ROUTE MATTERS MORE THAN IT LOOKS
 * 0157 built the spend-limit control and enforces it in a DB trigger. But an unset limit is NULL, and
 * NULL means UNLIMITED. So until someone can actually SET a limit, every approver in the company is
 * unlimited and the control — correctly built, correctly enforced — does precisely nothing. A control
 * with no way to configure it is not a control; it is a control-shaped absence. This route is what makes
 * 0157 real.
 *
 * THE ONE THING THIS ROUTE MUST NOT DO
 * It must not let an approver set their own ceiling. It doesn't — but not because of a check in this
 * file. fin_roles' RLS write policy requires fin_can_configure() (controller/CFO), and fin_can_approve()
 * (approver/controller/cfo) is a strictly wider set. So a plain approver's write is refused by the
 * DATABASE. That is deliberate: a guard in this route could be bypassed by a direct PostgREST call, and
 * "enforced at the API layer" is the exact marker of the privilege-escalation class the constitution
 * names. The route uses the RLS client precisely so the refusal happens where it cannot be routed around.
 *
 * A limit of NULL is unlimited; 0 would mean "may approve nothing", which is a different and legitimate
 * statement. The schema allows both, so the API must not silently coerce one into the other.
 */

export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ roles: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data, error } = await sb
    .from("fin_roles")
    .select("user_id, role, approval_limit, granted_at")
    .order("role");

  // An empty list here would read as "nobody has a finance role", which is a claim with real
  // consequences (it looks like the company is unconfigured). If the read failed, say so.
  if (error) return NextResponse.json({ error: "Could not load finance roles." }, { status: 500 });
  return NextResponse.json({ roles: data ?? [] });
}

const UpsertSchema = z
  .object({
    userId: z.string().uuid(),
    role: z.enum(["viewer", "accountant", "approver", "controller", "cfo"]),
    // Explicit null = unlimited. Omitted = leave whatever is there alone. These are different intents and
    // the API keeps them distinct rather than collapsing both into "no value".
    approvalLimit: z.number().nonnegative().finite().nullable().optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  if (!supabaseEnabled) return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const companyId = await getCurrentCompanyId();
  if (!companyId) return NextResponse.json({ error: "No company." }, { status: 400 });

  const b = await readBody(req, UpsertSchema);
  if (b instanceof NextResponse) return b;

  const row: Record<string, unknown> = {
    company_id: companyId,
    user_id: b.userId,
    role: b.role,
    granted_by: auth.user.id,
  };
  // Only touch approval_limit when the caller actually expressed an intent about it. Writing `null`
  // unconditionally would silently REMOVE an existing ceiling every time someone merely re-granted a
  // role — turning a routine role change into a silent grant of unlimited approval authority.
  if (b.approvalLimit !== undefined) row.approval_limit = b.approvalLimit;

  const { data, error } = await sb
    .from("fin_roles")
    .upsert(row, { onConflict: "company_id,user_id" })
    .select("user_id")
    .maybeSingle();

  // RLS refusal must be visible. A silent ok here would tell a controller the limit is live when nothing
  // was written — and the approver would keep approving without a ceiling.
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  if (!data) {
    return NextResponse.json(
      { error: "Not saved — only a controller or CFO may grant finance roles or set approval limits." },
      { status: 403 },
    );
  }
  return NextResponse.json({ ok: true });
}
