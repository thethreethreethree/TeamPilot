/**
 * CRM types — vendor-side back office for ELOSTATE.
 *
 * Per AMD-006 §1.5.1 L1 — types co-located with the data layer
 * so the schema and the runtime shape stay in sync. Match the
 * migration at supabase/migrations/0049_crm_vendor_back_office.sql.
 *
 * Per CLAUDE.md §3.4 — billing fields exist but are stubbed.
 * `billing_status: "not_collecting"` is the honest default.
 */

export type CrmLifecycleStage =
  | "trial"
  | "control_month"
  | "activated"
  | "paying"
  | "at_risk"
  | "churned"
  | "archived";

export type CrmAccountSource =
  | "self_signup"
  | "invited"
  | "referral"
  | "imported"
  | "unknown";

export type CrmPlanTier =
  | "pilot"
  | "team_small"
  | "team_medium"
  | "team_large"
  | "enterprise";

export type CrmSubscriptionStatus =
  | "inactive"
  | "trialing"
  | "control_month"
  | "active"
  | "paused"
  | "past_due"
  | "cancelled";

export type CrmInvoiceStatus =
  | "draft"
  | "not_collecting"
  | "sent"
  | "paid"
  | "overdue"
  | "voided";

export type CrmActivityKind =
  | "account_created"
  | "lifecycle_changed"
  | "subscription_changed"
  | "invoice_issued"
  | "invoice_paid"
  | "contact_added"
  | "contact_removed"
  | "note_added"
  | "support_volume_spiked"
  | "control_month_completed"
  | "health_changed"
  | "owner_assigned";

export interface CrmAccount {
  id: string;
  companyId: string;
  lifecycleStage: CrmLifecycleStage;
  lifecycleChangedAt: string | null;
  source: CrmAccountSource;
  sourceNote: string | null;
  accountOwnerUserId: string | null;
  healthScore: number | null;
  healthReason: string | null;
  industry: string | null;
  sizeBracket: string | null;
  region: string | null;
  primaryContactEmail: string | null;
  billingStatus: string;
  createdAt: string;
  updatedAt: string;
}

/** Joined view consumed by the accounts list. */
export interface CrmAccountSummary extends CrmAccount {
  companyName: string;
  contactCount: number;
  noteCount: number;
  subscriptionStatus: CrmSubscriptionStatus | null;
  subscriptionPlan: CrmPlanTier | null;
  lastActivityAt: string | null;
}

export interface CrmContact {
  id: string;
  accountId: string;
  fullName: string;
  email: string | null;
  role: string | null;
  isPrimary: boolean;
  isDecisionMaker: boolean;
  notes: string | null;
  lastContactedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CrmSubscription {
  id: string;
  accountId: string;
  plan: CrmPlanTier;
  status: CrmSubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string | null;
  trialEndAt: string | null;
  cancelledAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  seatCount: number;
  monthlyRecurringRevenueCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface CrmInvoice {
  id: string;
  accountId: string;
  subscriptionId: string | null;
  invoiceNumber: string;
  status: CrmInvoiceStatus;
  amountCents: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  issuedAt: string;
  dueAt: string | null;
  paidAt: string | null;
  stripeInvoiceId: string | null;
  createdAt: string;
}

export interface CrmActivityEvent {
  id: string;
  accountId: string;
  kind: CrmActivityKind;
  payload: Record<string, unknown>;
  actorUserId: string | null;
  createdAt: string;
}

export interface CrmNote {
  id: string;
  accountId: string;
  authorUserId: string | null;
  body: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export const LIFECYCLE_LABEL: Record<CrmLifecycleStage, string> = {
  trial: "Trial",
  control_month: "Control month",
  activated: "Activated",
  paying: "Paying",
  at_risk: "At risk",
  churned: "Churned",
  archived: "Archived",
};

export const LIFECYCLE_TONE: Record<CrmLifecycleStage, string> = {
  trial: "text-ember-300 bg-ember-400/10 border-ember-400/30",
  control_month: "text-violet-300 bg-violet-500/10 border-violet-500/30",
  activated: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  paying: "text-emerald-400 bg-emerald-500/15 border-emerald-500/40",
  at_risk: "text-ember-300 bg-ember-800/15 border-ember-800/40",
  churned: "text-muted bg-surface border-default",
  archived: "text-muted bg-surface border-default",
};

export const SUBSCRIPTION_LABEL: Record<CrmSubscriptionStatus, string> = {
  inactive: "Inactive",
  trialing: "Trialing",
  control_month: "Control month",
  active: "Active",
  paused: "Paused",
  past_due: "Past due",
  cancelled: "Cancelled",
};

export const PLAN_LABEL: Record<CrmPlanTier, string> = {
  pilot: "Pilot",
  team_small: "Team — Small",
  team_medium: "Team — Medium",
  team_large: "Team — Large",
  enterprise: "Enterprise",
};
