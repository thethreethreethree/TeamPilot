import { NextRequest, NextResponse } from "next/server";
import { listAccounts } from "@/lib/crm/data";
import { requireVendorAdmin } from "@/lib/crm/vendorAuth";
import { rateLimit } from "@/lib/api/rateLimit";
import type { CrmLifecycleStage } from "@/lib/crm/types";

/**
 * GET /api/admin/crm/accounts
 *
 * Vendor-side CRM list endpoint. Returns the joined
 * crm_account_summary view. Super-admin gated — non-admins
 * see 403 with an honest message.
 *
 * Query params:
 *   q              search across company_name + primary_contact_email
 *   stage          filter to one CrmLifecycleStage
 *   limit          default 200, max 500
 *
 * Per CLAUDE.md §3.4 — billing fields surface but the active
 * state for all accounts is "not_collecting" / "control_month"
 * until billing goes live. Honest by default.
 */

const VALID_STAGES: CrmLifecycleStage[] = [
  "trial",
  "control_month",
  "activated",
  "paying",
  "at_risk",
  "churned",
  "archived",
];

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "admin-crm-accounts",
    windowMs: 60_000,
    max: 60,
  });
  if (limited) return limited;

  // Vendor-admin only: admin AND company === vendor company (audit 2026-07-07,
  // CRITICAL). The prior check was ctx.isAdmin alone — any customer admin passed
  // and this endpoint returns EVERY company on the platform via service-role.
  const gate = await requireVendorAdmin();
  if (gate instanceof NextResponse) return gate;

  const params = req.nextUrl.searchParams;
  const stageParam = params.get("stage") as CrmLifecycleStage | null;
  const stage =
    stageParam && VALID_STAGES.includes(stageParam) ? stageParam : undefined;
  const search = params.get("q") ?? undefined;
  const rawLimit = parseInt(params.get("limit") ?? "200", 10) || 200;
  const limit = Math.max(1, Math.min(500, rawLimit));

  // Per migration 0050 — production accounts only by default. The
  // founder can toggle to "include test" (production + test) or
  // "only test" (test isolated). Excluded by default so the customer
  // metrics aren't polluted by QA signups.
  const testParam = params.get("test");
  const includeTest: boolean | "only" =
    testParam === "only" ? "only" : testParam === "include" ? true : false;

  const accounts = await listAccounts({
    search,
    lifecycleStage: stage,
    includeTest,
    limit,
  });
  return NextResponse.json({ accounts });
}
