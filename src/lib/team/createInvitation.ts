import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { isAdminRole } from "@/lib/supabase/auth-helpers";
import { findAuthUserByEmail } from "@/lib/supabase/admin";
import { isInvitableRole } from "@/lib/roles";

/**
 * Creating a team invitation — ONE implementation for the single invite (POST /api/team) and the CSV import
 * (POST /api/team/import, RSS Phase 9). Moved here unchanged from POST /api/team so the privilege-escalation gate and
 * both duplicate checks cannot drift between the two paths (§2.2). Runs on the CALLER's client: the
 * team_invitations insert policy (0008/0141) still applies.
 */
function genCode(): string {
  return randomBytes(16).toString("base64url");
}

export type InvitationResult =
  | { ok: true; invitationId: string; code: string; managerCarried?: boolean }
  | { ok: false; error: string; status: number };

export async function createInvitation(
  c: { supabase: SupabaseClient; companyId: string; userId: string },
  email: unknown,
  role: unknown,
  /** Who they will report to on joining (0288; applied only for an admin's invitation). The CSV import passes it. */
  opts: {
    managerId?: string | null;
    /** The auth user ids already found for this email (the CSV import looks every row up in ONE pass). Omitted →
     *  this function looks the email up itself, as for a single invite. Saves a full auth.users listing per row. */
    knownAccountIds?: string[];
  } = {},
): Promise<InvitationResult> {
  if (typeof email !== "string" || !email.includes("@")) {
    return { ok: false, error: "Valid email required.", status: 400 };
  }
  const safeRole = isInvitableRole(role) ? role : "Member";
  const normalizedEmail = email.toLowerCase().trim();

  // PRIVILEGE-ESCALATION GATE (audit 2026-07-13): CEO/COO are both invitable AND admin roles
  // (roles.ts), and accepting such an invite grants company-admin (0114). Neither this route nor the
  // team_invitations INSERT RLS policy (0008: `with check (company_id = auth_company_id())`) checked
  // the CALLER's role — so any Member could mint a CEO/COO invitation and escalate a proxy account to
  // admin. Mirror the DELETE-member gate: assigning an ADMIN role requires the caller to be an admin.
  // (Non-admins may still invite non-admin roles — Member/Lead.) The RLS backstop ships as migration
  // 0141 for the direct-client path; this closes the API path immediately.
  if (isAdminRole(safeRole)) {
    const { data: me } = await c.supabase
      .from("profiles")
      .select("role")
      .eq("id", c.userId)
      .maybeSingle();
    if (!isAdminRole(me?.role as string | null | undefined)) {
      return { ok: false, error: "Only a company admin can invite someone into a C-Suite tier (CEO/CFO/COO).", status: 403 };
    }
  }

  // Duplicate-prevention #1: an active pending invitation for this
  // email in this company. Two invitations to the same email produce
  // confusing state (two copy-links, two journeys) — reject early with
  // a clear message so the inviter knows to use the existing one.
  const { data: existingInvite } = await c.supabase
    .from("team_invitations")
    .select("id, expires_at")
    .eq("company_id", c.companyId)
    .eq("email", normalizedEmail)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("invited_at", { ascending: false })
    // .limit(1) BEFORE .maybeSingle(): there is no unique constraint on
    // (company_id, email) for pending invites, so 2+ can exist. Without the
    // limit, .maybeSingle() ERRORS on multiple rows → data is null → this
    // duplicate-prevention guard silently SKIPS, letting yet another duplicate be
    // created (the guard defeated by the very duplicates it exists to prevent).
    // A DB partial-unique index is the structural fix — see the remediation plan.
    .limit(1)
    .maybeSingle();
  if (existingInvite) {
    if (new Date(existingInvite.expires_at) > new Date()) {
      // A LIVE pending invite exists → reject (unchanged behaviour).
      return { ok: false, error: "A pending invitation already exists for this email. Revoke it first if you want to reissue.", status: 409 };
    }
    // F3 (audit 2026-07-10): the existing invite is EXPIRED but still occupies the
    // (company_id, lower(email)) partial-unique slot — 0098's index predicate is
    // `accepted_at is null and revoked_at is null`, and expiry is NOT in it (now()
    // can't live in an index predicate). The old code fell straight through to the
    // insert here and hit a raw unique-violation → 500. Auto-revoke the expired
    // invite first so re-inviting works AND the app agrees with the index (A16 —
    // two enforcement layers must compose). The DB index remains the backstop for
    // the concurrent-double-POST race.
    await c.supabase
      .from("team_invitations")
      .update({
        revoked_at: new Date().toISOString(),
        revoked_by: c.userId,
        revoke_reason: "Superseded — prior invite expired, re-invited",
      })
      .eq("id", existingInvite.id)
      .is("accepted_at", null);
  }

  // Duplicate-prevention #2: the email already belongs to an active
  // member of this company. Without this check the System happily
  // creates a redundant invitation for someone who's already in the
  // company (the exact case the user hit when re-inviting accounts
  // we'd seeded via script). Catching it requires auth.users access,
  // which only the service-role admin client has.
  let authUser: Awaited<ReturnType<typeof findAuthUserByEmail>>;
  try {
    authUser = opts.knownAccountIds
      ? opts.knownAccountIds[0]
        ? { id: opts.knownAccountIds[0], email: normalizedEmail }
        : null
      : await findAuthUserByEmail(normalizedEmail);
  } catch (err) {
    console.error("[createInvitation] account lookup failed:", err);
    return { ok: false, error: "Couldn't check whether this person already has an account. Try again.", status: 503 };
  }
  if (authUser) {
    const { data: existingMember } = await c.supabase
      .from("profiles")
      .select("id, full_name, status")
      .eq("id", authUser.id)
      .eq("company_id", c.companyId)
      .maybeSingle();
    if (existingMember && existingMember.status === "active") {
      return { ok: false, error: `${existingMember.full_name ?? normalizedEmail} is already a member of this company.`, status: 409 };
    }
  }

  const row = { company_id: c.companyId, email: normalizedEmail, role: safeRole, code: genCode(), invited_by: c.userId };
  let managerCarried = false;
  let { data, error } = opts.managerId
    ? await c.supabase.from("team_invitations").insert({ ...row, manager_id: opts.managerId }).select("id, code").single()
    : await c.supabase.from("team_invitations").insert(row).select("id, code").single();
  if (opts.managerId && !error) managerCarried = true;
  // Before migration 0288 the column does not exist: invite anyway, without the manager, and say so (never lose the invite).
  if (opts.managerId && error && ["42703", "PGRST204"].includes(String(error.code))) {
    ({ data, error } = await c.supabase.from("team_invitations").insert(row).select("id, code").single());
  }

  if (error || !data) {
    console.error("[team POST] failed to create invitation:", error);
    return { ok: false, error: "Couldn't create the invitation.", status: 500 };
  }
  return { ok: true, invitationId: String(data.id), code: String(data.code), managerCarried };
}
