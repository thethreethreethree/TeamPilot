#!/usr/bin/env node
//
// scripts/rls-audit.mjs — RLS policy completeness audit.
//
// What it does
// ────────────
// Statically parses supabase/migrations/*.sql to build a map of:
//   - which tables have RLS enabled,
//   - which policies (per operation) have been declared against each table,
// then asserts that every RLS-enabled table has policies covering the
// operations it actually needs. Missing operations are surfaced as
// findings.
//
// Why it exists
// ─────────────
// Postgres RLS is opt-in PER OPERATION. If you `alter table X enable row
// level security` but only write a `select` policy, then INSERT/UPDATE/
// DELETE are silently denied for non-service-role callers — and DELETE
// has a particularly nasty failure mode: it returns success with 0
// rows affected, leaving the caller convinced the row is gone when it
// is still there. This bit us in the user-visible pin/unpin loop and
// in the cascade chain when deleting test companies.
//
// The §1.7 audit caught these one at a time. This script makes the
// whole class of bug impossible to ship: it must either declare a
// policy for the operation OR explicitly allowlist the omission with a
// reason. Same shape as the theme-audit script's discipline.
//
// Allowlist
// ─────────
// Some tables INTENTIONALLY omit operations because the constitution
// requires it. Most notably the §3.1 append-only chain (events,
// signals, chat_messages, decision_dialogues, resolutions): no row
// should ever be updated or deleted by application code; they are
// historical record. The allowlist documents which omissions are
// intentional and WHY.
//
// Anything not in the allowlist and not policy-covered is a finding.
//
// Usage
// ─────
//   node scripts/rls-audit.mjs               # report, exit 1 if findings
//   node scripts/rls-audit.mjs --verbose     # also list per-table policies

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const VERBOSE = process.argv.includes("--verbose");

const MIGRATIONS_DIR = "supabase/migrations";
const OPS = ["select", "insert", "update", "delete"];

// ─── Intentional omissions allowlist ──────────────────────────────────
//
// Each entry: table.operation → reason. The reason MUST be a concrete
// constitutional or design statement, not "we don't think we need it".
// "We don't think we need it" means we haven't decided; either decide
// and add a policy, or decide and add an allowlist entry. The audit
// refuses ambiguous omissions.

const ALLOWLIST = new Map([
  // §3.1 append-only chain — events, signals, brain_evolution_events
  // are HISTORICAL RECORD. They are written by the system (triggers,
  // RPCs) and read by analysis paths; they are never updated or
  // deleted by application code. The cascade DELETE that arrives when
  // the parent company is removed is handled by FK cascades, which
  // bypass policy checks at the SQL-level (Postgres routes cascades
  // through table owner).
  ["events.update", "§3.1 events are immutable historical record."],
  ["events.delete", "§3.1 events are immutable; cascades via FK only."],
  ["signals.update", "§3.1 signals are immutable derived facts."],
  // signals.delete — DROPPED from allowlist intentionally. The cascade
  // from companies → signals must be permitted at policy-level too on
  // Supabase, because the cascade runs under the calling auth context
  // when invoked via PostgREST. Added via migration 0017.

  // §3.1 chat — messages are append-only; only kind/system rows are
  // ever inserted by triggers, never updated. Pin-on-message updates
  // the pin row, not the message.
  [
    "chat_messages.update",
    "§3.1 messages are append-only; edits are out of scope.",
  ],
  [
    "chat_messages.delete",
    "§3.1 messages are immutable; soft-delete via topic close instead.",
  ],

  // Decision dialogues + resolutions — same §3.1 principle. The
  // dialogues record HOW a decision was made; the resolution records
  // the outcome and whether it held.
  ["decision_dialogues.update", "§3.1 decision dialogues are append-only."],
  ["decision_dialogues.delete", "§3.1 decision dialogues are append-only."],
  ["resolutions.update", "§3.1 resolutions are append-only; consequence is measured in events, not edits."],
  ["resolutions.delete", "§3.1 resolutions are append-only."],

  // Brain evolution events — §3.4/§7.5 audit trail.
  [
    "brain_evolution_events.update",
    "§7.5 brain evolution is immutable so distrust-of-evolution can review.",
  ],
  [
    "brain_evolution_events.delete",
    "§7.5 brain evolution is immutable so distrust-of-evolution can review.",
  ],

  // problem_signals — link table between problems and signals,
  // immutable evidence-of-evidence.
  ["problem_signals.update", "Link table; updates would falsify evidence trail."],
  ["problem_signals.delete", "Link table; deletes would falsify evidence trail."],

  // Reference data (signal_sources, problem_thresholds) — system
  // configuration, only mutable by ops via service-role.
  ["signal_sources.insert", "System-config table; only ops/service-role writes."],
  ["signal_sources.update", "System-config table; only ops/service-role writes."],
  ["signal_sources.delete", "System-config table; only ops/service-role writes."],
  ["problem_thresholds.insert", "System-config table; only ops/service-role writes."],
  ["problem_thresholds.update", "System-config table; only ops/service-role writes."],
  ["problem_thresholds.delete", "System-config table; only ops/service-role writes."],

  // chat_participants — uses soft-delete via left_at, not row deletion.
  [
    "chat_participants.delete",
    "Soft-delete via left_at column; hard delete would lose audit trail.",
  ],

  // chat_topics — topics are not deleted by users; closing via the
  // close_topic RPC is the lifecycle end-state.
  ["chat_topics.delete", "Topics close via RPC, never delete (§3.1)."],

  // Tenant lifecycle — companies and profiles are deleted at the ops
  // level (account closure, GDPR right-to-be-forgotten) via direct
  // service-role access, not via PostgREST. Exposing a user-callable
  // DELETE policy would let a malicious admin nuke the tenant from a
  // browser bug.
  [
    "companies.delete",
    "Tenant deletion is an ops action; service-role only via direct DB access. No user-facing policy.",
  ],
  [
    "profiles.delete",
    "Profile is the auth-user-to-company link. Deletion happens via cascade from auth.users (account closure), not via direct delete.",
  ],

  // Feedback (0018) — append-only per §3.1. Status updates are
  // permitted (the trigger emits a feedback.status_changed event on
  // each transition); rows are never deleted. The §1.1 'data-as-
  // asset' rule applies — even rejected/declined feedback is
  // preserved as part of the record.
  [
    "feedback.delete",
    "§3.1 append-only. Feedback is permanent record; declined/duplicate marked via status, never deleted.",
  ],
  [
    "smoke_test_versions.delete",
    "§3.1 append-only. New checklist edits create new versions; old versions remain referenceable from prior results.",
  ],
  [
    "smoke_test_results.update",
    "§3.1 append-only. A re-test by the same tester appends a new row, preserving the journey of fail → fix → pass.",
  ],
  [
    "smoke_test_results.delete",
    "§3.1 append-only. Test results are permanent measurement record.",
  ],
  [
    "task_messages.update",
    "§3.1 append-only. The task thread is the record — no edits, no deletes.",
  ],
  [
    "task_messages.delete",
    "§3.1 append-only. The task thread is the record — no edits, no deletes.",
  ],
  [
    "task_participants.delete",
    "Participants leave a task by setting left_at, never by deletion. Engagement history (last_engaged_at, engagement_count) is constitutional record per A10 transparency.",
  ],
]);

// ─── Parse migrations ─────────────────────────────────────────────────

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

// table → { rlsEnabled: bool, policies: Set<op>, drops: Set<op> }
const tables = new Map();
function ensure(name) {
  if (!tables.has(name)) {
    tables.set(name, {
      rlsEnabled: false,
      policies: new Set(),
      droppedTable: false,
    });
  }
  return tables.get(name);
}

const RLS_ENABLE_RE = /alter\s+table\s+(?:public\.)?(\w+)\s+enable\s+row\s+level\s+security/gi;
const POLICY_RE =
  /create\s+policy\s+"[^"]+"\s+on\s+(?:public\.)?(\w+)\s+for\s+(select|insert|update|delete|all)\b/gi;
const DROP_TABLE_RE = /drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?(\w+)/gi;

// Recognize the dynamic policy-creation idiom used in 0001:
//
//   do $$ declare t text;
//   begin
//     foreach t in array array['tasks','team_members','decisions',...]
//     loop
//       execute format('create policy "%1$s - all" on %1$s for all ...', t);
//     end loop;
//   end $$;
//
// Without this, the static parser sees `on %1$s` and misses every
// table the block covers. We extract the array literal and the
// operation keyword, then apply the operation to each named table.
const DO_FOREACH_RE =
  /foreach\s+\w+\s+in\s+array\s+array\[([^\]]+)\][\s\S]*?execute\s+format\(\s*'\s*create\s+policy\s+"[^"]+"\s+on\s+%1\$s\s+for\s+(select|insert|update|delete|all)/gi;

for (const f of files) {
  const sql = readFileSync(join(MIGRATIONS_DIR, f), "utf8").toLowerCase();

  let m;
  while ((m = RLS_ENABLE_RE.exec(sql))) {
    ensure(m[1]).rlsEnabled = true;
  }
  RLS_ENABLE_RE.lastIndex = 0;

  while ((m = POLICY_RE.exec(sql))) {
    const t = ensure(m[1]);
    if (m[2] === "all") {
      OPS.forEach((op) => t.policies.add(op));
    } else {
      t.policies.add(m[2]);
    }
  }
  POLICY_RE.lastIndex = 0;

  while ((m = DO_FOREACH_RE.exec(sql))) {
    const arrayLiteral = m[1];
    const op = m[2];
    const tableNames = [...arrayLiteral.matchAll(/'([^']+)'/g)].map(
      (x) => x[1]
    );
    for (const name of tableNames) {
      const t = ensure(name);
      if (op === "all") {
        OPS.forEach((o) => t.policies.add(o));
      } else {
        t.policies.add(op);
      }
    }
  }
  DO_FOREACH_RE.lastIndex = 0;

  while ((m = DROP_TABLE_RE.exec(sql))) {
    ensure(m[1]).droppedTable = true;
  }
  DROP_TABLE_RE.lastIndex = 0;
}

// ─── Find gaps ────────────────────────────────────────────────────────

const findings = [];
for (const [name, t] of tables) {
  if (t.droppedTable) continue;
  if (!t.rlsEnabled) continue;
  for (const op of OPS) {
    if (t.policies.has(op)) continue;
    const key = `${name}.${op}`;
    if (ALLOWLIST.has(key)) continue;
    findings.push({ table: name, op });
  }
}

// ─── Report ───────────────────────────────────────────────────────────

console.log("═══ ELOSTATE RLS policy audit ═══");
console.log(`  Migrations scanned:    ${files.length}`);
const rlsTables = [...tables.values()].filter(
  (t) => t.rlsEnabled && !t.droppedTable
);
console.log(`  RLS-enabled tables:    ${rlsTables.length}`);
console.log(`  Allowlisted omissions: ${ALLOWLIST.size}`);
console.log(`  Missing policies:      ${findings.length}`);

if (VERBOSE) {
  console.log("\n  Per-table policy coverage:");
  for (const [name, t] of tables) {
    if (t.droppedTable || !t.rlsEnabled) continue;
    const covered = OPS.filter((op) => t.policies.has(op)).join("/");
    const missing = OPS.filter(
      (op) => !t.policies.has(op) && !ALLOWLIST.has(`${name}.${op}`)
    );
    const allowed = OPS.filter((op) => ALLOWLIST.has(`${name}.${op}`));
    console.log(
      `    ${name.padEnd(28)} have=${covered || "(none)"}  allowed=${
        allowed.join("/") || "(none)"
      }${missing.length ? `  MISSING=${missing.join("/")}` : ""}`
    );
  }
}

if (findings.length === 0) {
  console.log("\n✓ Every RLS-enabled table is covered or documented.");
  process.exit(0);
}

console.log("\n  Missing operations (must add a policy or allowlist):");
const byTable = new Map();
for (const f of findings) {
  if (!byTable.has(f.table)) byTable.set(f.table, []);
  byTable.get(f.table).push(f.op);
}
for (const [table, ops] of byTable) {
  console.log(`    ${table.padEnd(28)} ${ops.join(", ")}`);
}
console.log("\n✗ RLS policy gaps found.");
console.log(
  "  For each gap: either add a `create policy ... for <op>` in a new migration,\n" +
    "  or add an entry to ALLOWLIST in this script with a constitutional reason."
);
process.exit(1);
