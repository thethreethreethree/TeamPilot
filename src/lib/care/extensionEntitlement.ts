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
  /**
   * True only when the tenant is `locked` AND had a trial that has genuinely EXPIRED (a valid start, window
   * elapsed). Lets the client tell "your trial ended" from "your plan never included this" — honesty is the
   * moat: once auto-trial exists, a bare "your plan doesn't include it" is a lie to a tenant that just had 14
   * days of it. Never true for a paid tenant, an active trial, or a tenant that never started one.
   */
  trialEnded: boolean;
};

const PAID_PLANS = new Set(["pro", "enterprise"]);

/**
 * Pure predicate: should this tenant's free trial be AUTO-STARTED right now? (founder decision 2026-07-27,
 * audit Finding 1). True only on genuine first contact — the tenant is currently `locked` AND has never had
 * a trial (`extension_trial_started_at` is null). A paid plan never reaches `locked` (it is `active`), and
 * an EXPIRED trial has a non-null start, so neither auto-starts: one trial per tenant, ever. No IO here so
 * it is unit-tested; the write lives in getExtensionEntitlement.
 */
export function shouldAutoStartTrial(args: {
  trialStartedAt: string | null | undefined;
  computed: ExtensionEntitlement;
}): boolean {
  return args.computed.status === "locked" && !args.trialStartedAt;
}

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
    return { status: "active", trialDaysLeft: 0, plan, trialEnded: false };
  }

  let trialEnded = false;
  if (args.trialStartedAt) {
    const started = Date.parse(args.trialStartedAt);
    if (!Number.isNaN(started)) {
      const msElapsed = args.now - started;
      const msWindow = EXTENSION_TRIAL_DAYS * 24 * 60 * 60 * 1000;
      if (msElapsed >= 0 && msElapsed < msWindow) {
        const daysLeft = Math.max(0, Math.ceil((msWindow - msElapsed) / (24 * 60 * 60 * 1000)));
        return { status: "trial", trialDaysLeft: daysLeft, plan, trialEnded: false };
      }
      // A valid start past the window = a genuinely EXPIRED trial (they HAD access). A future/garbled start
      // is NOT counted — they never had a working trial, so the honest state is "never included", not "ended".
      if (msElapsed >= msWindow) trialEnded = true;
    }
  }

  return { status: "locked", trialDaysLeft: 0, plan, trialEnded };
}

/**
 * Load the tenant's plan + trial start and decide entitlement. Reads degrade gracefully: if the
 * `extension_trial_started_at` column isn't present yet (migration not applied on this deployment), the
 * trial is treated as not-started rather than crashing (the migration-coupling discipline — reads
 * degrade, they never assert the migration ran).
 *
 * AUTO-TRIAL (founder decision 2026-07-27, audit Finding 1): the entitlement columns previously had NO
 * writer, so every non-paid tenant was permanently `locked` — the extension "did not work" for any tester.
 * The fix gives the read column a writer at THIS chokepoint (every tool call passes through here): a tenant
 * that has never started a trial and isn't paid gets its 14-day window OPENED by its first extension call,
 * instead of a 402 with no self-serve way in. One trial per tenant, ever — enforced by the atomic
 * `UPDATE ... WHERE extension_trial_started_at IS NULL`, so concurrent first calls can't double-start and an
 * expired trial (column already set) is never restarted. NOT done in the migration-missing branch below —
 * there is no column to write, so it correctly stays plan-only (A34 degrade preserved).
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
      // Column not deployed yet — fall back to a plan-only read (no trial, no auto-start: nowhere to write).
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
    return { status: "locked", trialDaysLeft: 0, plan: "unknown", trialEnded: false };
  }

  const plan = (data?.plan as string | null) ?? null;
  const trialStartedAt = (data?.extension_trial_started_at as string | null) ?? null;
  const computed = computeExtensionEntitlement({ plan, trialStartedAt, now: Date.now() });

  // `data &&` is load-bearing: only auto-start when the config ROW actually exists. Without it, a tenant with
  // NO care_tenant_config row (a pre-0045 company that predates the bootstrap trigger) would take the
  // auto-start branch, the `UPDATE … WHERE company_id=$1` would match ZERO rows (not an error), and we'd
  // return `trial` anyway — a PHANTOM trial that never persists and recomputes to "trial" on every call
  // forever (unbounded free access). With the guard, a row-less tenant correctly stays `locked` (the
  // pre-change behavior) rather than being silently and permanently unlocked.
  if (data && shouldAutoStartTrial({ trialStartedAt, computed })) {
    const startedIso = new Date().toISOString();
    const { error: upErr } = await admin
      .from("care_tenant_config")
      .update({ extension_trial_started_at: startedIso })
      .eq("company_id", companyId)
      .is("extension_trial_started_at", null); // atomic guard: only the first call ever sets it
    if (upErr) {
      // Write failed → stay honest with the locked state rather than granting an unpersisted trial; the
      // next call retries. (Never fabricate access the DB didn't record — honesty is the moat.)
      return computed;
    }
    // Trial is now open — either this call set it, or a concurrent first call did (both within the same
    // second, immaterial to a 14-day window). Recompute so the caller sees `trial`, not `locked`.
    return computeExtensionEntitlement({ plan, trialStartedAt: startedIso, now: Date.now() });
  }

  return computed;
}
