#!/usr/bin/env node
// READ-ONLY inspection (2026-08-19): why does Moses NOT have the same (founder / vendor-admin)
// access the founder does? Founder access is defined by EXACTLY two profile fields
// (src/lib/crm/vendorAuth.ts + migration 0089's is_vendor_super_admin):
//     role IN ('CEO','COO','admin')  AND  company_id = <vendor company>
// This prints the vendor company, the current vendor-admins (the reference set — includes the
// founder), and every profile whose name matches the target, with the exact missing field(s).
// NO writes. Optional argv[2] = name substring to match (default "moses").
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

const VENDOR_COMPANY_ID = "c3e7f389-3df6-48c8-876b-0cd4baf5c2a7"; // vendorCompanyId.ts + 0089 literal
const ADMIN_ROLES = new Set(["CEO", "COO", "admin"]);
const target = (process.argv[2] || "moses").trim();

async function emailOf(id) {
  try { const { data } = await sb.auth.admin.getUserById(id); return data?.user?.email ?? "(no email)"; }
  catch { return "(lookup failed)"; }
}

// Vendor company name (sanity — confirm the literal really is the home company).
const { data: vco } = await sb.from("companies").select("id, name").eq("id", VENDOR_COMPANY_ID).maybeSingle();
console.log(`\n=== VENDOR (founder) COMPANY ===`);
console.log(`${vco?.name ?? "(name not found — check the id/env override)"}  ${VENDOR_COMPANY_ID}`);

// Current vendor-admins = the reference set. This is precisely who has founder access today.
const { data: admins } = await sb
  .from("profiles")
  .select("id, full_name, role, company_id")
  .eq("company_id", VENDOR_COMPANY_ID)
  .in("role", ["CEO", "COO", "admin"]);
console.log(`\n=== CURRENT VENDOR-ADMINS (have founder access) : ${admins?.length ?? 0} ===`);
for (const a of admins || []) {
  console.log(`  ${(await emailOf(a.id)).padEnd(30)} ${String(a.role).padEnd(6)} ${a.full_name ?? "(no name)"}  [${a.id.slice(0, 8)}]`);
}

// Target candidates by name — surface EVERY match so we never grant to the wrong person
// (admin ?email/?name is not a unique key — assert exactly one before any write).
const { data: cands } = await sb
  .from("profiles")
  .select("id, full_name, role, company_id")
  .ilike("full_name", `%${target}%`);
console.log(`\n=== PROFILES MATCHING "${target}" : ${cands?.length ?? 0} ===`);
if (!cands || cands.length === 0) {
  console.log(`  none — try a different spelling, or look the account up by email.`);
  process.exit(0);
}
for (const c of cands) {
  const email = await emailOf(c.id);
  const inVendor = c.company_id === VENDOR_COMPANY_ID;
  const isAdminRole = ADMIN_ROLES.has(c.role);
  const has = inVendor && isAdminRole;
  const missing = [];
  if (!isAdminRole) missing.push(`role (is "${c.role}" → needs CEO/COO/admin)`);
  if (!inVendor) missing.push(`company_id (is ${String(c.company_id).slice(0, 8)} → needs vendor company)`);
  console.log(`\n  ${email}  ${c.full_name ?? "(no name)"}  [id ${c.id}]`);
  console.log(`    role=${c.role}  company_id=${c.company_id}`);
  console.log(`    founder access: ${has ? "YES ✓ (already has it)" : "NO — missing: " + missing.join("; ")}`);
  if (!inVendor) {
    // Ripple (holistic): moving company_id REMOVES them from their current company. Show what that is.
    const { data: cur } = await sb.from("companies").select("name").eq("id", c.company_id).maybeSingle();
    console.log(`    ⚠ currently belongs to company "${cur?.name ?? "?"}" — granting vendor access MOVES them out of it.`);
  }
}
console.log(`\nTo grant: confirm the ONE correct id above, then run the grant script with that explicit id.`);
process.exit(0);
