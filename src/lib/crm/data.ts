/**
 * CRM data layer — fetchers + mutators for the vendor-side back
 * office. Per AMD-006 L1 — every CRUD function lives here so
 * routes stay thin and the schema mapping is one file to audit.
 *
 * Per CLAUDE.md §3.1 — every state change emits an event. The
 * SQL triggers in migration 0049 do the heavy lifting (lifecycle
 * change, subscription change, invoice issue/paid, note added,
 * contact added/removed); this module exposes the writes that
 * the routes invoke.
 *
 * Per CLAUDE.md §A11 — every read returns honest counts and
 * dates, never derived verdicts ("healthy" etc.) — the UI may
 * map them to language but the source data is facts.
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  CrmAccount,
  CrmAccountSummary,
  CrmActivityEvent,
  CrmContact,
  CrmInvoice,
  CrmLifecycleStage,
  CrmNote,
  CrmSubscription,
} from "./types";

// ─── Account fetchers ────────────────────────────────────────

export async function listAccounts(args?: {
  search?: string;
  lifecycleStage?: CrmLifecycleStage;
  limit?: number;
}): Promise<CrmAccountSummary[]> {
  const sb = createAdminClient();
  let query = sb
    .from("crm_account_summary")
    .select("*")
    .order("last_activity_at", { ascending: false, nullsFirst: false })
    .limit(args?.limit ?? 200);
  if (args?.lifecycleStage) {
    query = query.eq("lifecycle_stage", args.lifecycleStage);
  }
  if (args?.search && args.search.trim().length > 0) {
    const term = `%${args.search.trim()}%`;
    query = query.or(
      `company_name.ilike.${term},primary_contact_email.ilike.${term}`
    );
  }
  const { data } = await query;
  return (data ?? []).map(mapAccountSummary);
}

export async function fetchAccount(
  accountId: string
): Promise<CrmAccount | null> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("crm_accounts")
    .select("*")
    .eq("id", accountId)
    .maybeSingle();
  if (!data) return null;
  return mapAccount(data);
}

export async function fetchAccountByCompanyId(
  companyId: string
): Promise<CrmAccount | null> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("crm_accounts")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  if (!data) return null;
  return mapAccount(data);
}

// ─── Account mutators ────────────────────────────────────────

export async function updateAccount(
  accountId: string,
  patch: Partial<{
    lifecycleStage: CrmLifecycleStage;
    accountOwnerUserId: string | null;
    healthScore: number | null;
    healthReason: string | null;
    industry: string | null;
    sizeBracket: string | null;
    region: string | null;
    primaryContactEmail: string | null;
    billingStatus: string;
    sourceNote: string | null;
  }>
): Promise<CrmAccount | null> {
  const sb = createAdminClient();
  const row: Record<string, unknown> = {};
  if (patch.lifecycleStage !== undefined)
    row.lifecycle_stage = patch.lifecycleStage;
  if (patch.accountOwnerUserId !== undefined)
    row.account_owner_user_id = patch.accountOwnerUserId;
  if (patch.healthScore !== undefined) row.health_score = patch.healthScore;
  if (patch.healthReason !== undefined) row.health_reason = patch.healthReason;
  if (patch.industry !== undefined) row.industry = patch.industry;
  if (patch.sizeBracket !== undefined) row.size_bracket = patch.sizeBracket;
  if (patch.region !== undefined) row.region = patch.region;
  if (patch.primaryContactEmail !== undefined)
    row.primary_contact_email = patch.primaryContactEmail;
  if (patch.billingStatus !== undefined) row.billing_status = patch.billingStatus;
  if (patch.sourceNote !== undefined) row.source_note = patch.sourceNote;
  const { data } = await sb
    .from("crm_accounts")
    .update(row)
    .eq("id", accountId)
    .select("*")
    .single();
  if (!data) return null;
  return mapAccount(data);
}

// ─── Contacts ────────────────────────────────────────────────

export async function listContacts(accountId: string): Promise<CrmContact[]> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("crm_contacts")
    .select("*")
    .eq("account_id", accountId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });
  return (data ?? []).map(mapContact);
}

export async function addContact(args: {
  accountId: string;
  fullName: string;
  email?: string | null;
  role?: string | null;
  isPrimary?: boolean;
  isDecisionMaker?: boolean;
  notes?: string | null;
}): Promise<CrmContact | null> {
  const sb = createAdminClient();
  // If isPrimary is being set, clear any other primary first
  // (the partial unique index will reject otherwise).
  if (args.isPrimary) {
    await sb
      .from("crm_contacts")
      .update({ is_primary: false })
      .eq("account_id", args.accountId)
      .eq("is_primary", true);
  }
  const { data } = await sb
    .from("crm_contacts")
    .insert({
      account_id: args.accountId,
      full_name: args.fullName,
      email: args.email ?? null,
      role: args.role ?? null,
      is_primary: args.isPrimary ?? false,
      is_decision_maker: args.isDecisionMaker ?? false,
      notes: args.notes ?? null,
    })
    .select("*")
    .single();
  if (!data) return null;
  return mapContact(data);
}

export async function deleteContact(contactId: string): Promise<boolean> {
  const sb = createAdminClient();
  const { error } = await sb.from("crm_contacts").delete().eq("id", contactId);
  return !error;
}

// ─── Subscriptions ───────────────────────────────────────────

export async function fetchActiveSubscription(
  accountId: string
): Promise<CrmSubscription | null> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("crm_subscriptions")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return mapSubscription(data);
}

export async function listSubscriptions(
  accountId: string
): Promise<CrmSubscription[]> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("crm_subscriptions")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapSubscription);
}

export async function updateSubscription(
  subscriptionId: string,
  patch: Partial<{
    plan: CrmSubscription["plan"];
    status: CrmSubscription["status"];
    currentPeriodEnd: string | null;
    trialEndAt: string | null;
    seatCount: number;
    monthlyRecurringRevenueCents: number;
  }>
): Promise<CrmSubscription | null> {
  const sb = createAdminClient();
  const row: Record<string, unknown> = {};
  if (patch.plan !== undefined) row.plan = patch.plan;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.currentPeriodEnd !== undefined)
    row.current_period_end = patch.currentPeriodEnd;
  if (patch.trialEndAt !== undefined) row.trial_end_at = patch.trialEndAt;
  if (patch.seatCount !== undefined) row.seat_count = patch.seatCount;
  if (patch.monthlyRecurringRevenueCents !== undefined)
    row.monthly_recurring_revenue_cents = patch.monthlyRecurringRevenueCents;
  const { data } = await sb
    .from("crm_subscriptions")
    .update(row)
    .eq("id", subscriptionId)
    .select("*")
    .single();
  if (!data) return null;
  return mapSubscription(data);
}

// ─── Invoices ────────────────────────────────────────────────

export async function listInvoices(accountId: string): Promise<CrmInvoice[]> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("crm_invoices")
    .select("*")
    .eq("account_id", accountId)
    .order("issued_at", { ascending: false });
  return (data ?? []).map(mapInvoice);
}

export async function generateInvoiceStub(args: {
  accountId: string;
  subscriptionId: string | null;
  amountCents: number;
  periodStart: string;
  periodEnd: string;
}): Promise<CrmInvoice | null> {
  const sb = createAdminClient();
  // Invoice number — yyyy-mm-<sequence>. Sequence is per-month
  // global; collisions are caught by the unique constraint.
  const stamp = new Date(args.periodStart);
  const yymm = `${stamp.getUTCFullYear()}${String(stamp.getUTCMonth() + 1).padStart(2, "0")}`;
  const { count } = await sb
    .from("crm_invoices")
    .select("id", { count: "exact", head: true })
    .like("invoice_number", `INV-${yymm}-%`);
  const seq = String((count ?? 0) + 1).padStart(4, "0");
  const invoiceNumber = `INV-${yymm}-${seq}`;

  const { data } = await sb
    .from("crm_invoices")
    .insert({
      account_id: args.accountId,
      subscription_id: args.subscriptionId,
      invoice_number: invoiceNumber,
      status: "not_collecting",
      amount_cents: args.amountCents,
      period_start: args.periodStart,
      period_end: args.periodEnd,
    })
    .select("*")
    .single();
  if (!data) return null;
  return mapInvoice(data);
}

// ─── Activity events ─────────────────────────────────────────

export async function listActivity(
  accountId: string,
  limit = 50
): Promise<CrmActivityEvent[]> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("crm_activity_events")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map(mapActivity);
}

// ─── Notes ───────────────────────────────────────────────────

export async function listNotes(accountId: string): Promise<CrmNote[]> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("crm_notes")
    .select("*")
    .eq("account_id", accountId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapNote);
}

export async function addNote(args: {
  accountId: string;
  authorUserId: string;
  body: string;
  pinned?: boolean;
}): Promise<CrmNote | null> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("crm_notes")
    .insert({
      account_id: args.accountId,
      author_user_id: args.authorUserId,
      body: args.body,
      pinned: args.pinned ?? false,
    })
    .select("*")
    .single();
  if (!data) return null;
  return mapNote(data);
}

export async function deleteNote(noteId: string): Promise<boolean> {
  const sb = createAdminClient();
  const { error } = await sb.from("crm_notes").delete().eq("id", noteId);
  return !error;
}

// ─── Mappers ─────────────────────────────────────────────────

function mapAccount(row: Record<string, unknown>): CrmAccount {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    lifecycleStage: row.lifecycle_stage as CrmAccount["lifecycleStage"],
    lifecycleChangedAt: (row.lifecycle_changed_at as string | null) ?? null,
    source: row.source as CrmAccount["source"],
    sourceNote: (row.source_note as string | null) ?? null,
    accountOwnerUserId: (row.account_owner_user_id as string | null) ?? null,
    healthScore: (row.health_score as number | null) ?? null,
    healthReason: (row.health_reason as string | null) ?? null,
    industry: (row.industry as string | null) ?? null,
    sizeBracket: (row.size_bracket as string | null) ?? null,
    region: (row.region as string | null) ?? null,
    primaryContactEmail: (row.primary_contact_email as string | null) ?? null,
    billingStatus: row.billing_status as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapAccountSummary(row: Record<string, unknown>): CrmAccountSummary {
  return {
    ...mapAccount(row),
    companyName: row.company_name as string,
    contactCount: (row.contact_count as number) ?? 0,
    noteCount: (row.note_count as number) ?? 0,
    subscriptionStatus:
      (row.subscription_status as CrmAccountSummary["subscriptionStatus"]) ??
      null,
    subscriptionPlan:
      (row.subscription_plan as CrmAccountSummary["subscriptionPlan"]) ?? null,
    lastActivityAt: (row.last_activity_at as string | null) ?? null,
  };
}

function mapContact(row: Record<string, unknown>): CrmContact {
  return {
    id: row.id as string,
    accountId: row.account_id as string,
    fullName: row.full_name as string,
    email: (row.email as string | null) ?? null,
    role: (row.role as string | null) ?? null,
    isPrimary: (row.is_primary as boolean) ?? false,
    isDecisionMaker: (row.is_decision_maker as boolean) ?? false,
    notes: (row.notes as string | null) ?? null,
    lastContactedAt: (row.last_contacted_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapSubscription(row: Record<string, unknown>): CrmSubscription {
  return {
    id: row.id as string,
    accountId: row.account_id as string,
    plan: row.plan as CrmSubscription["plan"],
    status: row.status as CrmSubscription["status"],
    currentPeriodStart: row.current_period_start as string,
    currentPeriodEnd: (row.current_period_end as string | null) ?? null,
    trialEndAt: (row.trial_end_at as string | null) ?? null,
    cancelledAt: (row.cancelled_at as string | null) ?? null,
    stripeCustomerId: (row.stripe_customer_id as string | null) ?? null,
    stripeSubscriptionId:
      (row.stripe_subscription_id as string | null) ?? null,
    stripePriceId: (row.stripe_price_id as string | null) ?? null,
    seatCount: (row.seat_count as number) ?? 0,
    monthlyRecurringRevenueCents:
      (row.monthly_recurring_revenue_cents as number) ?? 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapInvoice(row: Record<string, unknown>): CrmInvoice {
  return {
    id: row.id as string,
    accountId: row.account_id as string,
    subscriptionId: (row.subscription_id as string | null) ?? null,
    invoiceNumber: row.invoice_number as string,
    status: row.status as CrmInvoice["status"],
    amountCents: (row.amount_cents as number) ?? 0,
    currency: (row.currency as string) ?? "USD",
    periodStart: row.period_start as string,
    periodEnd: row.period_end as string,
    issuedAt: row.issued_at as string,
    dueAt: (row.due_at as string | null) ?? null,
    paidAt: (row.paid_at as string | null) ?? null,
    stripeInvoiceId: (row.stripe_invoice_id as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

function mapActivity(row: Record<string, unknown>): CrmActivityEvent {
  return {
    id: row.id as string,
    accountId: row.account_id as string,
    kind: row.kind as CrmActivityEvent["kind"],
    payload: (row.payload as Record<string, unknown>) ?? {},
    actorUserId: (row.actor_user_id as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

function mapNote(row: Record<string, unknown>): CrmNote {
  return {
    id: row.id as string,
    accountId: row.account_id as string,
    authorUserId: (row.author_user_id as string | null) ?? null,
    body: row.body as string,
    pinned: (row.pinned as boolean) ?? false,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
