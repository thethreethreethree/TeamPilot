import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminRole } from "@/lib/roles";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";
import { assertValidManager, TreeError, type Person } from "@/lib/coach/remote/access";

/**
 * POST /api/team/set-manager — set who a team member reports to (RSS Phase 0 step 3; Gong F2.4).
 * Body: { memberId, managerId | null }. null clears it (top of the tree / not set yet).
 *
 * Beside team/set-role and built the same way: company-admin only, service role because `manager_id` is a
 * guarded privileged column (0272 extends the 0090/0091 guard — a rep must not pick their own manager),
 * and company-pinned on both the read and the write (INV15/29).
 *
 * TWO CHECKS, ONE RULE. `assertValidManager` (src/lib/coach/remote/access.ts) refuses self, another
 * company and loops so the admin gets a sentence; the 0272 `rss_guard_manager` trigger refuses the same
 * three in the database, so a write that bypasses this route still cannot make a loop.
 *
 * Setting managers changes NO visibility yet: existing policies switch to the tree per company in Phase 0
 * step 8, after that company's managers are set (docs/rss/docs/07-BUILD-ORDER.md).
 */
export const maxDuration = 15;

const Body = z.object({
  memberId: z.string().uuid(),
  managerId: z.string().uuid().nullable(),
});

const MISSING_COLUMN = new Set(["42703", "PGRST204"]);

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "team-set-manager", windowMs: 60_000, max: 60 });
  if (limited) return limited;

  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a team admin can set managers." }, { status: 403 });

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const sb = createAdminClient();

  // The whole company's tree, so loops are checked against the real chain. Company-pinned.
  const { data: rows, error: readErr } = await sb
    .from("profiles")
    .select("id, company_id, manager_id, role, sales_coach_role, status")
    .eq("company_id", ctx.companyId);
  if (readErr) {
    if (MISSING_COLUMN.has(String(readErr.code))) {
      return NextResponse.json({ error: "Reporting lines are waiting on database migration 0272." }, { status: 503 });
    }
    // eslint-disable-next-line no-console
    console.error(`[team/set-manager] read failed company=${ctx.companyId}: ${readErr.message}`);
    return NextResponse.json({ error: "Couldn't load your team." }, { status: 500 });
  }

  const people: Person[] = ((rows ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    companyId: String(r.company_id),
    managerId: (r.manager_id as string | null) ?? null,
    isCompanyAdmin: isAdminRole(r.role as string | null),
    isSalesCoachManager: isSalesCoachManager({
      role: (r.role as string | null) ?? null,
      sales_coach_role: (r.sales_coach_role as string | null) ?? null,
      company_id: String(r.company_id),
    }),
  }));

  const member = people.find((p) => p.id === body.memberId);
  if (!member) return NextResponse.json({ error: "Member not found in your company." }, { status: 404 });
  if (body.managerId) {
    const mgr = (rows ?? []).find((r) => String((r as Record<string, unknown>).id) === body.managerId) as
      | Record<string, unknown>
      | undefined;
    if (!mgr) return NextResponse.json({ error: "That manager isn't in your company." }, { status: 404 });
    if (mgr.status === "removed") {
      return NextResponse.json({ error: "That person has been removed from the team." }, { status: 409 });
    }
  }

  try {
    assertValidManager(body.memberId, body.managerId, people);
  } catch (e) {
    // A fixed sentence: a loop's TreeError names an internal user id, which is not for the client (CWE-209).
    if (e instanceof TreeError) return NextResponse.json({ error: "That would create a reporting loop or an invalid manager." }, { status: 409 });
    throw e;
  }

  const { error } = await sb
    .from("profiles")
    .update({ manager_id: body.managerId })
    .eq("id", body.memberId)
    .eq("company_id", ctx.companyId); // tenant scope on the write itself
  if (error) {
    // eslint-disable-next-line no-console
    console.error(`[team/set-manager] update failed member=${body.memberId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't update the reporting line." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, managerId: body.managerId });
}
