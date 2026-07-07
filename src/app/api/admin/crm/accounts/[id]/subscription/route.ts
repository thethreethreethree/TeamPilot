import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import {
  fetchActiveSubscription,
  generateInvoiceStub,
  updateSubscription,
} from "@/lib/crm/data";
import { requireVendorAdmin } from "@/lib/crm/vendorAuth";

/**
 * PATCH /api/admin/crm/accounts/[id]/subscription
 *
 * Mutate the active subscription. Per CLAUDE.md §3.4 the billing
 * fields are real but collection is off — status:"active" means
 * "would be paying if collection were on", not "is paying."
 *
 * POST /api/admin/crm/accounts/[id]/subscription/invoice
 * is the stub-invoice generator. Both gated to vendor admins.
 */

const PatchSchema = z
  .object({
    plan: z
      .enum([
        "pilot",
        "team_small",
        "team_medium",
        "team_large",
        "enterprise",
      ])
      .optional(),
    status: z
      .enum([
        "inactive",
        "trialing",
        "control_month",
        "active",
        "paused",
        "past_due",
        "cancelled",
      ])
      .optional(),
    currentPeriodEnd: z
      .string()
      .datetime({ offset: true })
      .nullable()
      .optional(),
    trialEndAt: z
      .string()
      .datetime({ offset: true })
      .nullable()
      .optional(),
    seatCount: z.number().int().min(0).max(10000).optional(),
    monthlyRecurringRevenueCents: z
      .number()
      .int()
      .min(0)
      .max(10_000_000_00)
      .optional(),
  })
  .strict();

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Vendor-admin only (audit 2026-07-07, CRITICAL) — admin AND vendor company.
  const gate = await requireVendorAdmin();
  if (gate instanceof NextResponse) return gate;
  const { id } = await context.params;
  const subscription = await fetchActiveSubscription(id);
  return NextResponse.json({ subscription });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Vendor-admin only (audit 2026-07-07, CRITICAL) — admin AND vendor company.
  const gate = await requireVendorAdmin();
  if (gate instanceof NextResponse) return gate;
  const body = await readBody(req, PatchSchema);
  if (body instanceof NextResponse) return body;
  const { id } = await context.params;
  const current = await fetchActiveSubscription(id);
  if (!current) {
    return NextResponse.json(
      { error: "No active subscription on this account." },
      { status: 404 }
    );
  }
  const updated = await updateSubscription(current.id, {
    plan: body.plan,
    status: body.status,
    currentPeriodEnd: body.currentPeriodEnd,
    trialEndAt: body.trialEndAt,
    seatCount: body.seatCount,
    monthlyRecurringRevenueCents: body.monthlyRecurringRevenueCents,
  });
  if (!updated) {
    return NextResponse.json(
      { error: "Update failed." },
      { status: 500 }
    );
  }
  return NextResponse.json({ subscription: updated });
}

/**
 * POST creates a stub invoice for the active subscription. While
 * billing is off these are bookkeeping rows with status
 * "not_collecting." When billing flips live, the same shape can
 * be repurposed by the live-billing migration.
 */
const InvoiceSchema = z
  .object({
    amountCents: z.number().int().min(0).max(10_000_000_00),
    periodStart: z.string().datetime({ offset: true }),
    periodEnd: z.string().datetime({ offset: true }),
  })
  .strict();

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Vendor-admin only (audit 2026-07-07, CRITICAL) — admin AND vendor company.
  const gate = await requireVendorAdmin();
  if (gate instanceof NextResponse) return gate;
  const body = await readBody(req, InvoiceSchema);
  if (body instanceof NextResponse) return body;
  const { id } = await context.params;
  const sub = await fetchActiveSubscription(id);
  const invoice = await generateInvoiceStub({
    accountId: id,
    subscriptionId: sub?.id ?? null,
    amountCents: body.amountCents,
    periodStart: body.periodStart,
    periodEnd: body.periodEnd,
  });
  if (!invoice) {
    return NextResponse.json(
      { error: "Couldn't generate invoice stub." },
      { status: 500 }
    );
  }
  return NextResponse.json({ invoice });
}
