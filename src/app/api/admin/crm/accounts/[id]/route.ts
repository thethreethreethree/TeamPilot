import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import {
  activateAccountGuidance,
  fetchAccount,
  fetchActiveSubscription,
  listActivity,
  listContacts,
  listInvoices,
  listNotes,
  listSubscriptions,
  updateAccount,
} from "@/lib/crm/data";
import { requireVendorAdmin } from "@/lib/crm/vendorAuth";
import { rateLimit } from "@/lib/api/rateLimit";
import type { CrmLifecycleStage } from "@/lib/crm/types";

/**
 * GET /api/admin/crm/accounts/[id]
 *
 * Full account detail: account + active subscription + recent
 * activity + contacts + notes + invoices.
 *
 * PATCH /api/admin/crm/accounts/[id]
 *
 * Update mutable account fields (lifecycle, owner, health,
 * industry, etc.). Lifecycle/owner/health changes auto-emit
 * crm_activity_events per the SQL triggers in migration 0049.
 *
 * Both require vendor super-admin per RLS + getCurrentAuthContext.
 */

const PatchSchema = z
  .object({
    lifecycleStage: z
      .enum([
        "trial",
        "control_month",
        "activated",
        "paying",
        "at_risk",
        "churned",
        "archived",
      ])
      .optional(),
    accountOwnerUserId: z.string().uuid().nullable().optional(),
    healthScore: z.number().int().min(0).max(100).nullable().optional(),
    healthReason: z.string().max(400).nullable().optional(),
    industry: z.string().max(120).nullable().optional(),
    sizeBracket: z.string().max(40).nullable().optional(),
    region: z.string().max(120).nullable().optional(),
    primaryContactEmail: z.string().email().nullable().optional(),
    billingStatus: z
      .enum([
        "not_collecting",
        "pending_first_invoice",
        "collecting",
        "past_due",
        "churned",
      ])
      .optional(),
    sourceNote: z.string().max(2000).nullable().optional(),
    isTestAccount: z.boolean().optional(),
  })
  .strict();

async function gate(): Promise<
  | { ok: true; userId: string }
  | { ok: false; res: NextResponse }
> {
  // Vendor-admin only: admin AND company === vendor company (audit 2026-07-07,
  // CRITICAL). The prior check was ctx.isAdmin alone — any customer admin passed.
  const ctxOrRes = await requireVendorAdmin();
  if (ctxOrRes instanceof NextResponse) return { ok: false, res: ctxOrRes };
  return { ok: true, userId: ctxOrRes.userId };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const g = await gate();
  if (!g.ok) return g.res;
  const { id } = await context.params;

  const account = await fetchAccount(id);
  if (!account) {
    return NextResponse.json(
      { error: "Account not found." },
      { status: 404 }
    );
  }
  const [subscription, subscriptions, contacts, notes, invoices, activity] =
    await Promise.all([
      fetchActiveSubscription(id),
      listSubscriptions(id),
      listContacts(id),
      listNotes(id),
      listInvoices(id),
      listActivity(id, 50),
    ]);

  return NextResponse.json({
    account,
    subscription,
    subscriptions,
    contacts,
    notes,
    invoices,
    activity,
  });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, {
    id: "admin-crm-account-patch",
    windowMs: 60_000,
    max: 30,
  });
  if (limited) return limited;
  const g = await gate();
  if (!g.ok) return g.res;

  const body = await readBody(req, PatchSchema);
  if (body instanceof NextResponse) return body;

  const { id } = await context.params;
  const updated = await updateAccount(id, {
    lifecycleStage: body.lifecycleStage as CrmLifecycleStage | undefined,
    accountOwnerUserId: body.accountOwnerUserId,
    healthScore: body.healthScore,
    healthReason: body.healthReason,
    industry: body.industry,
    sizeBracket: body.sizeBracket,
    region: body.region,
    primaryContactEmail: body.primaryContactEmail,
    billingStatus: body.billingStatus,
    sourceNote: body.sourceNote,
    isTestAccount: body.isTestAccount,
  });
  if (!updated) {
    return NextResponse.json(
      { error: "Account not found or update failed." },
      { status: 404 }
    );
  }
  // The lifecycle-stage control is the OTHER way to activate an account (the founder's
  // "6 in Control month" view flips THIS, not the subscription status). Advancing an account
  // to a live stage must open the AI gate too, so "activated" means all AI is functional — the
  // same guarantee the subscription-status PATCH gives. Best-effort; the stage is already saved.
  if (body.lifecycleStage === "activated" || body.lifecycleStage === "paying") {
    await activateAccountGuidance(id);
  }
  return NextResponse.json({ account: updated });
}
