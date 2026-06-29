#!/usr/bin/env node
// One-off: create two admin tester accounts for the existing company.
//
// What this does, deliberately:
//   1. Reads .env.local for the service-role key.
//   2. Looks up the existing owner profile (johnsyramos@gmail.com) to
//      get the active company_id — this avoids hard-coding the UUID
//      and keeps the script safe to re-run against any environment.
//   3. For each tester:
//      - Creates an auth.users row via supabase.auth.admin.createUser
//        with email_confirm: true so the tester can sign in immediately
//        without verifying their email.
//      - Inserts a profiles row tying the new auth.users row to the
//        company with role: "admin".
//   4. Idempotent: if an account already exists, the auth API returns
//      an error we treat as a soft skip — we still try to upsert the
//      profile row so the link is correct.
//
// Run: node scripts/create-tester-accounts.mjs

import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA_URL || !SUPA_KEY) {
  console.error("Missing SUPABASE env vars in .env.local.");
  process.exit(1);
}

const OWNER_EMAIL = "johnsyramos@gmail.com";

const TESTERS = [
  {
    email: "mosesmaniquiz@gmail.com",
    password: "Admin2026!",
    full_name: "Moses Maniquiz",
  },
  {
    email: "michael.bundy1@gmail.com",
    password: "Admin2026!",
    full_name: "Michael Bundy",
  },
];

const headers = {
  apikey: SUPA_KEY,
  Authorization: `Bearer ${SUPA_KEY}`,
  "Content-Type": "application/json",
};

async function rest(path, init = {}) {
  const res = await fetch(`${SUPA_URL}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, body };
}

async function findOwnerCompany() {
  // The owner's email can map to more than one auth.users row (a stale
  // signup attempt + the active account). We pick the auth user whose
  // profiles row is actually linked to a company, since that's by
  // definition the working account.
  // NOTE: /auth/v1/admin/users?email= does NOT filter — it returns a
  // LIST. Filter client-side by the actual email field (2026-06-28: the
  // unfiltered loop wrongly wrote 10 profiles once; never trust ?email=).
  const userLookup = await rest(`/auth/v1/admin/users?per_page=1000`);
  const matches = (userLookup.body?.users ?? []).filter(
    (u) => (u.email ?? "").toLowerCase() === OWNER_EMAIL.toLowerCase()
  );
  if (!userLookup.ok || matches.length === 0) {
    throw new Error(
      `Owner ${OWNER_EMAIL} not found in auth.users — sign in once before running this script.`
    );
  }
  const ids = matches.map((u) => u.id);
  const orFilter = ids.map((id) => `id.eq.${id}`).join(",");
  const profiles = await rest(
    `/rest/v1/profiles?or=(${orFilter})&select=id,company_id,full_name`
  );
  if (!profiles.ok) {
    throw new Error(`profiles lookup failed: ${JSON.stringify(profiles.body)}`);
  }
  const linked = (profiles.body ?? []).find((p) => p.company_id);
  if (!linked) {
    throw new Error(
      `None of ${ids.length} auth users for ${OWNER_EMAIL} have a profile linked to a company. Finish onboarding first.`
    );
  }
  return {
    companyId: linked.company_id,
    ownerName: linked.full_name,
  };
}

async function createAuthUser(email, password, full_name) {
  const res = await rest(`/auth/v1/admin/users`, {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    }),
  });
  if (res.ok && res.body?.id) {
    return { id: res.body.id, created: true };
  }
  // Already exists — look it up so we can still ensure the profile.
  const msg = JSON.stringify(res.body ?? "");
  if (/already.*registered|already exists|duplicate/i.test(msg)) {
    // ?email= doesn't filter — fetch + match the real email field.
    const existing = await rest(`/auth/v1/admin/users?per_page=1000`);
    const match = (existing.body?.users ?? []).find(
      (u) => (u.email ?? "").toLowerCase() === email.toLowerCase()
    );
    if (match) {
      return { id: match.id, created: false };
    }
  }
  throw new Error(`createAuthUser(${email}) failed: ${msg}`);
}

async function upsertProfile(id, company_id, full_name) {
  const res = await rest(`/rest/v1/profiles?on_conflict=id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates, return=representation" },
    body: JSON.stringify({
      id,
      company_id,
      full_name,
      role: "admin",
    }),
  });
  if (!res.ok) {
    throw new Error(
      `upsertProfile(${id}) failed: ${JSON.stringify(res.body)}`
    );
  }
  return res.body?.[0];
}

(async () => {
  console.log("▸ Locating owner company…");
  const { companyId, ownerName } = await findOwnerCompany();
  console.log(`  Owner: ${ownerName} (${OWNER_EMAIL})`);
  console.log(`  Company: ${companyId}`);

  for (const t of TESTERS) {
    console.log(`\n▸ ${t.email}`);
    const { id, created } = await createAuthUser(
      t.email,
      t.password,
      t.full_name
    );
    console.log(`  auth.users: ${created ? "CREATED" : "ALREADY EXISTED"} — ${id}`);
    const profile = await upsertProfile(id, companyId, t.full_name);
    console.log(
      `  profiles:   linked to company ${companyId} as role=admin (name="${profile?.full_name ?? t.full_name}")`
    );
  }

  console.log("\n✓ Done. Both testers can now sign in at /login.");
  console.log(
    "Recommend: ask each tester to rotate their password on first login."
  );
})().catch((err) => {
  console.error("\n✗ Failed:", err.message);
  process.exit(1);
});
