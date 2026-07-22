import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingColumnError } from "@/lib/coach/v5/migrationGuard";

/**
 * C.A.R.E browser-extension entitlement (spec docs/feature-specs/CARE-BROWSER-EXTENSION.md, D2).
 *
 * The extension is unlocked when the tenant is on `pro`/`enterprise`, OR within an active limited free
 * trial. Both require a logged-in account — there is no anonymous use (the auth layer enforces that; this
 * module only answers "is this authenticated tenant entitled"). The SERVER is the source of truth on every
 * tool call; the client only reflects the status. §3.4: honest states (active / trial / locked), a trial
 * that has genuinely expired reads `locked`, never a silent grant.
 */

/** Length of the free trial, in days. Founder-tunable. */
export const EXTENSION_TRIAL_DAYS = 14;

export type ExtensionEntitlement = {
  /** active = paid; trial = within the free window; locked = neither. */
  status: "active" | "trial" | "locked";
  /** Whole days remaining in the trial (0 when not in trial). */
  trialDaysLeft: number;
  /** The plan the decision was based on (for the client to show context honestly). */
  plan: string;
};

const PAID_PLANS = new Set(["pro", "enterprise"]);

/**
 * Pure entitlement decision — no IO, so it is unit-tested. `now` is injected for testability.
 */
export function computeExtensionEntitlement(args: {
  plan: string | null | undefined;
  trialStartedAt: string | null | undefined;
  now: number;
}): ExtensionEntitlement {
  const plan = (args.plan ?? "pilot").toLowerCase();

  if (PAID_PLANS.has(plan)) {
    return { status: "active", trialDaysLeft: 0, plan };
  }

  if (args.trialStartedAt) {
    const started = Date.parse(args.trialStartedAt);
    if (!Number.isNaN(started)) {
      const msElapsed = args.now - started;
      const msWindow = EXTENSION_TRIAL_DAYS * 24 * 60 * 60 * 1000;
      if (msElapsed >= 0 && msElapsed < msWindow) {
        const daysLeft = Math.max(0, Math.ceil((msWindow - msElapsed) / (24 * 60 * 60 * 1000)));
        return { status: "trial", trialDaysLeft: daysLeft, plan };
      }
    }
  }

  return { status: "locked", trialDaysLeft: 0, plan };
}

/**
 * Load the tenant's plan + trial start and decide entitlement. Reads degrade gracefully: if the
 * `extension_trial_started_at` column isn't present yet (migration not applied on this deployment), the
 * trial is treated as not-started rather than crashing (§3.4 / migration-coupling discipline — reads
 * degrade, they never assert the migration ran).
 */
export async function getExtensionEntitlement(
  companyId: string
): Promise<ExtensionEntitlement> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("care_tenant_config")
    .select("plan, extension_trial_started_at")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    if (isMissingColumnError(error, "extension_trial_started_at")) {
      // Column not deployed yet — fall back to a plan-only read (no trial).
      const { data: planOnly } = await admin
        .from("care_tenant_config")
        .select("plan")
        .eq("company_id", companyId)
        .maybeSingle();
      return computeExtensionEntitlement({
        plan: (planOnly?.plan as string | null) ?? null,
        trialStartedAt: null,
        now: Date.now(),
      });
    }
    // Any other read failure → locked (fail closed for a paid feature).
    return { status: "locked", trialDaysLeft: 0, plan: "unknown" };
  }

  return computeExtensionEntitlement({
    plan: (data?.plan as string | null) ?? null,
    trialStartedAt: (data?.extension_trial_started_at as string | null) ?? null,
    now: Date.now(),
  });
}
