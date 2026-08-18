#!/usr/bin/env node
// PRIVILEGE GRANT (2026-08-19, founder-directed): give a profile founder / vendor-admin access.
// Founder access = role IN ('CEO','COO','admin') AND company_id = vendor company
// (src/lib/crm/vendorAuth.ts + is_vendor_super_admin, migration 0089). This sets role → 'admin'
// (mirroring the founder's own role). GUARDED: requires an explicit user id AND a name substring
// that must match the fetched profile, and refuses to grant unless the profile is ALREADY in the
// vendor company (so this script never silently MOVES someone across tenants — that ripple must be
// a deliberate, separate decision). Prints before/after + re-verifies the predicate.
//
//   node scripts/grant-founder-access.mjs <user-id> <name-substring>
//   e.g. node scripts/grant-founder-access.mjs 7da30c76-6e9f-4cb1-9d55-7b20cbd5bb14 Moses
//
// The DECISION logic (evaluateGrant / hasFounderAccess) is a PURE function exported for unit tests —
// the guards on a privilege-escalation tool are exactly what must not silently regress. The IO
// (env read, Supabase, argv, the write) lives in main(), which runs ONLY on direct invocation, so
// importing this module for a test never reads .env.local or touches prod. (scripts/__tests__/grantFounderAccess.test.mjs)
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const VENDOR_COMPANY_ID = "c3e7f389-3df6-48c8-876b-0cd4baf5c2a7";
export const ADMIN_ROLES = ["CEO", "COO", "admin"];
export const GRANT_ROLE = "admin"; // mirrors the founder's own role

/** The founder-access predicate — the SAME two conditions as vendorAuth.isVendorAdmin +
 *  is_vendor_super_admin (0089): an admin role AND membership in the vendor company. */
export function hasFounderAccess(profile, vendorCompanyId = VENDOR_COMPANY_ID) {
  return (
    !!profile &&
    ADMIN_ROLES.includes(profile.role) &&
    profile.company_id === vendorCompanyId
  );
}

/**
 * Pure grant decision. Given the fetched profile + the operator's name guard, decide the action —
 * WITHOUT doing any IO. Returns { action: "abort" | "noop" | "grant", reason }.
 *   abort  → a guard failed (no profile / name mismatch / not in vendor company); do NOT write.
 *   noop   → already has founder access; nothing to do.
 *   grant  → eligible: set role → GRANT_ROLE.
 * The tenant guard is deliberate: this tool NEVER moves a profile across companies — a cross-tenant
 * move is a separate, explicit decision, so a wrong id (someone in another company) aborts here.
 */
export function evaluateGrant({ profile, nameGuard, vendorCompanyId = VENDOR_COMPANY_ID }) {
  if (!profile) return { action: "abort", reason: "no such profile" };
  const name = (profile.full_name || "").toLowerCase();
  if (!name.includes(String(nameGuard || "").toLowerCase())) {
    return { action: "abort", reason: `profile name "${profile.full_name}" does not contain "${nameGuard}" — wrong id?` };
  }
  if (profile.company_id !== vendorCompanyId) {
    return { action: "abort", reason: `${profile.full_name} is in company ${profile.company_id}, not the vendor company — a tenant move is a separate decision` };
  }
  if (ADMIN_ROLES.includes(profile.role)) {
    return { action: "noop", reason: `${profile.full_name} already has founder access (role=${profile.role})` };
  }
  return { action: "grant", reason: "eligible" };
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const env = Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
  );
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [, , targetId, nameGuard] = process.argv;
  if (!targetId || !nameGuard) {
    console.error("Usage: node scripts/grant-founder-access.mjs <user-id> <name-substring>");
    process.exit(1);
  }

  // Fetch the ONE profile by explicit id (a unique key — no wrong-person risk from a name query).
  const { data: p, error } = await sb
    .from("profiles")
    .select("id, full_name, role, company_id")
    .eq("id", targetId)
    .maybeSingle();
  if (error) { console.error("read failed:", error.message); process.exit(1); }

  const decision = evaluateGrant({ profile: p, nameGuard });
  if (decision.action === "abort") { console.error(`ABORT: ${decision.reason} — refusing to grant.`); process.exit(1); }
  if (decision.action === "noop") { console.log(`${decision.reason} (vendor company). No change.`); process.exit(0); }

  console.log(`BEFORE:  ${p.full_name}  role=${p.role}  company_id=${p.company_id}`);
  const { data: updated, error: upErr } = await sb
    .from("profiles")
    .update({ role: GRANT_ROLE })
    .eq("id", targetId)
    .eq("company_id", VENDOR_COMPANY_ID) // belt-and-suspenders: scope the write to the vendor company
    .select("id, full_name, role, company_id")
    .maybeSingle();
  if (upErr) { console.error("update failed:", upErr.message); process.exit(1); }
  console.log(`AFTER:   ${updated.full_name}  role=${updated.role}  company_id=${updated.company_id}`);

  const has = hasFounderAccess(updated);
  console.log(`\nFounder access now: ${has ? "YES ✓" : "NO ✗ (unexpected — investigate)"}`);
  console.log(`${updated.full_name} must sign out and back in for the new role to take effect in their session.`);
  process.exit(has ? 0 : 1);
}

// Run the IO flow ONLY when invoked directly (node scripts/grant-founder-access.mjs …), never on import.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
