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
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const VENDOR_COMPANY_ID = "c3e7f389-3df6-48c8-876b-0cd4baf5c2a7";
const GRANT_ROLE = "admin"; // mirrors the founder's own role
const [, , targetId, nameGuard] = process.argv;
if (!targetId || !nameGuard) {
  console.error("Usage: node scripts/grant-founder-access.mjs <user-id> <name-substring>");
  process.exit(1);
}

// 1) Fetch the ONE profile by explicit id (not a name query — a unique key, no wrong-person risk).
const { data: p, error } = await sb
  .from("profiles")
  .select("id, full_name, role, company_id")
  .eq("id", targetId)
  .maybeSingle();
if (error) { console.error("read failed:", error.message); process.exit(1); }
if (!p) { console.error(`no profile with id ${targetId}`); process.exit(1); }

// 2) Name guard — the fetched profile MUST match the operator's stated person.
if (!(p.full_name || "").toLowerCase().includes(nameGuard.toLowerCase())) {
  console.error(`ABORT: profile name "${p.full_name}" does not contain "${nameGuard}" — wrong id? refusing to grant.`);
  process.exit(1);
}
// 3) Tenant guard — never move someone across companies from this script.
if (p.company_id !== VENDOR_COMPANY_ID) {
  console.error(`ABORT: ${p.full_name} is in company ${p.company_id}, not the vendor company. Moving tenants is a`);
  console.error(`separate deliberate decision — this script only elevates ROLE within the vendor company.`);
  process.exit(1);
}
// 4) Idempotency — already an admin role? no-op.
if (["CEO", "COO", "admin"].includes(p.role)) {
  console.log(`${p.full_name} already has founder access (role=${p.role}, vendor company). No change.`);
  process.exit(0);
}

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

// 5) Re-verify the founder-access predicate holds now.
const has = ["CEO", "COO", "admin"].includes(updated.role) && updated.company_id === VENDOR_COMPANY_ID;
console.log(`\nFounder access now: ${has ? "YES ✓" : "NO ✗ (unexpected — investigate)"}`);
console.log(`${updated.full_name} must sign out and back in for the new role to take effect in their session.`);
process.exit(has ? 0 : 1);
