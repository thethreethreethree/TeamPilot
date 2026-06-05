#!/usr/bin/env node
//
// One-off cleanup for orphan chain-test-* companies that accumulated
// because the chain integration test's afterAll cleanup silently
// failed (Supabase cascade-with-RLS behavior under PostgREST).
//
// This bypasses PostgREST entirely by issuing the deletes through
// supabase-js with the service-role key — which DOES bypass RLS when
// invoked from a Node context. We delete child rows in chain-safe
// order, then the company, so no FK error can surface.
//
// Safe to re-run: only acts on companies whose name starts with
// 'chain-test-'. Logs each deletion. Reports a non-zero count so the
// operator can confirm what was removed.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  }
);

// 1) Find the targets
const { data: targets, error: findErr } = await supabase
  .from("companies")
  .select("id, name")
  .like("name", "chain-test-%");
if (findErr) {
  console.error("Could not list companies:", findErr.message);
  process.exit(1);
}
if (!targets || targets.length === 0) {
  console.log("No chain-test-* orphans to clean. ✓");
  process.exit(0);
}
console.log(`Found ${targets.length} orphan companies to clean:`);
for (const t of targets) console.log(`  ${t.id.slice(0, 8)}  ${t.name}`);

const ids = targets.map((t) => t.id);

// 2) Delete child rows in dependency-safe order. Each table that
// references companies(id) needs to have its rows for the target
// companies removed before the company itself. We could rely on
// cascades, but the Supabase RLS-cascade quirk has bitten us once;
// being explicit here makes the cleanup deterministic.
const childTables = [
  "chat_pins",
  "chat_messages",
  "chat_participants",
  "chat_topics",
  "signals",
  "problem_signals",
  "problems",
  "events",
  "resolutions",
  "decisions",
  "decision_dialogues",
  "team_invitations",
  "team_members",
  "tasks",
  "brain_evolution_events",
  "company_brain",
];

for (const table of childTables) {
  const { error, count } = await supabase
    .from(table)
    .delete({ count: "exact" })
    .in("company_id", ids);
  if (error) {
    console.error(`  delete ${table}: ${error.message}`);
  } else {
    console.log(`  delete ${table}: ${count ?? "?"} rows`);
  }
}

// 3) Profiles reference companies via company_id; the FK is ON DELETE
// SET NULL, so they survive but get orphaned. We don't delete them —
// auth.users-level deletion is a separate concern.
const { error: pErr, count: pCount } = await supabase
  .from("profiles")
  .update({ company_id: null }, { count: "exact" })
  .in("company_id", ids);
if (pErr) {
  console.error(`  null profiles: ${pErr.message}`);
} else {
  console.log(`  null profiles: ${pCount ?? "?"} rows`);
}

// 4) Finally, the companies themselves.
const { error: cErr, count: cCount } = await supabase
  .from("companies")
  .delete({ count: "exact" })
  .in("id", ids);
if (cErr) {
  console.error(`  delete companies: ${cErr.message}`);
  process.exit(1);
} else {
  console.log(`  delete companies: ${cCount ?? "?"} rows`);
}

console.log("\n✓ Orphan cleanup complete.");
