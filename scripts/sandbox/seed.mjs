#!/usr/bin/env node
// scripts/sandbox/seed.mjs — make a sandbox company of sample data (revenue plan phase 11, 0397; Gong F2.9).
//
//   node scripts/sandbox/seed.mjs --name "EloState Demo" --admin-email you@yourco.com [--admin-name "Your Name"] [--reps 3] [--apply]
//
// Without --apply nothing is written: it says what it would do and checks the admin email is free. With --apply it
//   1. makes a company flagged is_sandbox (only the server can set the flag; every page in it says "Sample data"),
//   2. makes the admin's sign-in (no password: they sign in with "Forgot password" on that email) and the sample reps'
//      (sandbox-rep-N.<company>@example.invalid — a reserved domain that receives no mail — no password, so nobody can
//      sign in as them),
//   3. calls rss_sandbox_seed, which refuses any company not flagged sandbox (§3.4) and writes the sample in one
//      transaction.
// The admin email must not already have an account in another company (a person belongs to one company, F1.9).
// Reads .env.local; prints counts, never keys.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const arg = (k) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const APPLY = process.argv.includes("--apply");
const name = (arg("name") ?? "").trim();
const adminEmail = (arg("admin-email") ?? "").trim().toLowerCase();
const adminNameArg = arg("admin-name")?.trim();
const reps = Math.max(1, Math.min(5, Number(arg("reps") ?? 3) || 3));
if (!name || name.length > 120 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) {
  console.error('Usage: node scripts/sandbox/seed.mjs --name "EloState Demo" --admin-email you@yourco.com [--admin-name "Your Name"] [--reps 3] [--apply]');
  process.exit(2);
}
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
  }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function findUser(email) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`couldn't list sign-ins: ${error.message}`);
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 1000) return null;
  }
  // Said, not guessed (review 2026-11-28): past 50,000 sign-ins the lookup can't tell.
  throw new Error("more than 50,000 sign-ins: couldn't check whether that email is in use; nothing was written");
}

const existing = await findUser(adminEmail);
// A run that stopped partway (review 2026-11-28) left the admin in a sandbox with no deals: resume that one rather than
// refuse the email or make a second company.
let resume = null;
if (existing) {
  const { data: prof } = await sb.from("profiles").select("company_id").eq("id", existing.id).maybeSingle();
  if (prof?.company_id) {
    const { data: theirs } = await sb.from("companies").select("id, name, is_sandbox").eq("id", prof.company_id).maybeSingle();
    const { count } = theirs?.is_sandbox ? await sb.from("remote_prospects").select("id", { count: "exact", head: true }).eq("company_id", theirs.id) : { count: null };
    if (theirs?.is_sandbox && count === 0) resume = theirs;
    else {
      console.error(theirs?.is_sandbox
        ? `That email's sandbox "${theirs.name}" is already seeded.`
        : "That email already belongs to a company. Use an email with no EloState account (a person belongs to one company).");
      process.exit(1);
    }
  }
}
console.log(resume
  ? `${APPLY ? "Finishing" : "Would finish"} the unseeded sandbox "${resume.name}" for ${adminEmail} with ${reps} sample rep${reps === 1 ? "" : "s"}.`
  : `${APPLY ? "Making" : "Would make"} sandbox company "${name}" with admin ${adminEmail} and ${reps} sample rep${reps === 1 ? "" : "s"}.`);
if (!APPLY) {
  console.log("Dry run: nothing written. Add --apply to make it.");
  process.exit(0);
}

let companyId = resume?.id;
if (!companyId) {
  const { data: co, error: cErr } = await sb.from("companies").insert({ name, is_sandbox: true, access_module: "sales_coach" }).select("id").single();
  if (cErr || !co) throw new Error(`couldn't make the company: ${cErr?.message}`);
  companyId = co.id;
}

async function person(email, fullName, role, scRole) {
  let user = await findUser(email);
  const isNew = !user;
  if (!user) {
    const made = await sb.auth.admin.createUser({ email, email_confirm: true });
    if (made.error || !made.data.user) throw new Error(`couldn't make the sign-in for ${email}: ${made.error?.message ?? "no user returned"}`);
    user = made.data.user;
  }
  // An existing person's name is kept unless one was given (review 2026-11-28).
  const row = { id: user.id, company_id: companyId, role, status: "active", sales_coach_role: scRole, ...(isNew || fullName ? { full_name: fullName ?? "Sandbox Admin" } : {}) };
  const { error } = await sb.from("profiles").upsert(row, { onConflict: "id" });
  if (error) throw new Error(`couldn't set up ${email}: ${error.message}`);
  return user.id;
}
const adminId = await person(adminEmail, adminNameArg, "CEO", "admin");
const repIds = [];
for (let i = 1; i <= reps; i++) repIds.push(await person(`sandbox-rep-${i}.${companyId.slice(0, 8)}@example.invalid`, `Sample Rep ${i}`, "Member", "staff"));

const { data: seeded, error: sErr } = await sb.rpc("rss_sandbox_seed", { p_company: companyId, p_admin: adminId, p_reps: repIds });
if (sErr) throw new Error(`the sample couldn't be written: ${sErr.message}`);
console.log(`Done: ${seeded.deals} deals, ${seeded.accounts} accounts, ${seeded.contacts} contacts, ${seeded.calls} calls in "${name}".`);
console.log(`Sign in as ${adminEmail} with "Forgot password" on the sign-in page to set a password.`);
