#!/usr/bin/env node
//
// scripts/writer-audit.mjs — "a table with no writer is a feature that does not exist"
//
// Why this exists
// ───────────────
//   Migration 0258 shipped `pattern_events` with six carefully-reasoned event kinds, RLS
//   policies, an index, and a closure note saying nothing wrote to it. Five surfaces were then
//   built correctly on top of it. Three builds later those surfaces were rendering an empty log
//   and THREE OF THE FIVE PATTERN STATUSES IN THE PRODUCT'S CORE LIFECYCLE WERE UNREACHABLE —
//   `statusOf` needs a coaching instant and nothing produced one. Every test green, every audit
//   passing, typecheck clean.
//
//   Nothing could have caught it. `reachability:audit` asks whether exported CODE is reached; it
//   has no concept of a TABLE that is read and never written. The only record was a line in a
//   closure, and a flag in a closure is read once.
//
// The rule, stated precisely
// ──────────────────────────
//   A table that application code READS must have at least one writer, where a writer is any of:
//
//     (a) application code that inserts / upserts / updates / deletes it
//     (b) an INSERT in a migration — seed or reference data
//     (c) an INSERT inside a database function or trigger defined in a migration
//     (d) an allowlist entry giving the reason it legitimately has none
//
//   Views are exempt: they are not writable and their backing tables are audited on their own.
//
// Why those four and not fewer
// ────────────────────────────
//   The naive version — "every table read has an insert in src/" — fires on every lookup table,
//   every rubric config seeded by a migration, and every table a Postgres trigger fills. An audit
//   whose first run produces forty findings gets allowlisted into silence within a week, and then
//   it is worse than nothing because it LOOKS like coverage (A30: gate the class, and a gate must
//   be precise or not exist).
//
//   So (b) and (c) are not concessions, they are the rule being correct: a table a migration
//   seeds HAS a writer, and so does one a trigger fills. The finding this audit is for is the
//   narrower and much more serious one — a table the product reads that NOTHING anywhere fills.
//
// Usage
// ─────
//   node scripts/writer-audit.mjs            # report, exit 1 on an un-allowlisted finding
//   node scripts/writer-audit.mjs --verbose  # also list every table and its writers
//
// Exit code
// ─────────
//   0 when every read table has a writer or a documented reason. 1 otherwise.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const VERBOSE = process.argv.includes("--verbose");
const MIGRATIONS = "supabase/migrations";
const SRC = "src";

/* ─── Allowlist: read by the product, legitimately written by nothing in this repo ───────────
 *
 * Every entry needs a REASON, in the same spirit as rls-audit's. "It is fine" is not a reason;
 * naming the external writer or the reference-data source is.
 */
const ALLOWLIST = new Map([
  // Supabase-managed. Written by the auth service, not by this application.
  ["auth.users", "Supabase Auth owns this table; the application only reads it."],
  ["users", "Supabase Auth's users, referenced by FK and read for identity. Never written here."],
  ["storage.objects", "Supabase Storage owns it; uploads go through the storage API, not SQL."],

  // Operator tooling, not the product. Written over the REST API by
  // scripts/update-smoke-test-comprehensive.mjs and
  // scripts/smoke-test-add-structural-and-spawn.mjs, which PATCH /rest/v1/smoke_test_versions.
  // A table only an operator script fills is a real category — admin-curated reference data —
  // and the entry names the scripts so the claim is checkable rather than asserted.
  ["smoke_test_versions", "Admin-curated checklists, written by scripts/update-smoke-test-comprehensive.mjs and scripts/smoke-test-add-structural-and-spawn.mjs over the REST API. 0018 defines it; the product only reads the active version."],
]);

/* ─── Walk ──────────────────────────────────────────────────────────────────────────────── */

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(p, out);
    } else out.push(p);
  }
  return out;
}

/* ─── SQL: what exists, and what the database itself writes ─────────────────────────────── */

/** Comments carry prose that looks like SQL. Strip before matching (the 0022 lesson). */
function stripSqlComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
}

const migrationFiles = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .map((f) => join(MIGRATIONS, f));

const tables = new Set();
const views = new Set();
/** Tables written by SQL itself: a seed INSERT, or an INSERT inside a function or trigger body. */
const sqlWritten = new Set();

for (const file of migrationFiles) {
  const sql = stripSqlComments(readFileSync(file, "utf8")).toLowerCase();

  for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z0-9_."]+)/g)) {
    tables.add(clean(m[1]));
  }
  for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?(?:materialized\s+)?view\s+(?:if\s+not\s+exists\s+)?([a-z0-9_."]+)/g)) {
    views.add(clean(m[1]));
  }
  // Any INSERT in a migration counts, whether it is seed data at the top level or a statement
  // inside a function body — both put rows in the table, which is the question being asked.
  for (const m of sql.matchAll(/insert\s+into\s+([a-z0-9_."]+)/g)) sqlWritten.add(clean(m[1]));
  // A trigger or function that UPDATEs a table is filling it too, for our purposes: the row
  // exists and something maintains it.
  for (const m of sql.matchAll(/update\s+([a-z0-9_."]+)\s+set/g)) sqlWritten.add(clean(m[1]));
}

function clean(raw) {
  return raw.replace(/"/g, "").replace(/^public\./, "").trim();
}

/* ─── Application code: who reads, who writes ───────────────────────────────────────────── */

const WRITE_METHODS = new Set(["insert", "upsert", "update", "delete"]);
const read = new Map(); // table -> Set<file>
const written = new Map(); // table -> Set<file>

const srcFiles = walk(SRC).filter((f) => [".ts", ".tsx"].includes(extname(f)));

for (const file of srcFiles) {
  // Tests prove behaviour against mocks; a write that exists only in a test is not a writer.
  if (/[\\/]__tests__[\\/]|\.test\.tsx?$/.test(file)) continue;
  const code = readFileSync(file, "utf8");

  // `.from("x")` followed by the method that decides read-or-write. The chain can wrap across
  // lines, so allow whitespace and an optional generic, but nothing that could skip to a
  // different statement.
  for (const m of code.matchAll(
    /\.from\s*(?:<[^>]*>)?\s*\(\s*["'`]([a-zA-Z0-9_.]+)["'`]\s*\)\s*\.\s*([a-zA-Z]+)/g
  )) {
    const table = clean(m[1].toLowerCase());
    const method = m[2];
    const bucket = WRITE_METHODS.has(method) ? written : read;
    if (!bucket.has(table)) bucket.set(table, new Set());
    bucket.get(table).add(file);
  }
}

/* ─── The finding ───────────────────────────────────────────────────────────────────────── */

const findings = [];
for (const [table, readers] of [...read.entries()].sort()) {
  if (views.has(table)) continue; // not writable; its backing tables are audited separately
  if (!tables.has(table) && !ALLOWLIST.has(table)) continue; // not a table this repo defines
  if (written.has(table)) continue; // (a)
  if (sqlWritten.has(table)) continue; // (b) and (c)
  if (ALLOWLIST.has(table)) continue; // (d)
  findings.push({ table, readers: [...readers] });
}

/* ─── Report ────────────────────────────────────────────────────────────────────────────── */

console.log("\n═══ Writer audit — a table with no writer is a feature that does not exist ═══");
console.log(`  Tables defined:        ${tables.size}`);
console.log(`  Views (exempt):        ${views.size}`);
console.log(`  Tables read by src:    ${read.size}`);
console.log(`  Tables written by src: ${written.size}`);
console.log(`  Written by SQL only:   ${[...sqlWritten].filter((t) => tables.has(t) && !written.has(t)).length}`);
console.log(`  Allowlisted:           ${ALLOWLIST.size}`);

if (VERBOSE) {
  console.log("\n  Read tables and where their rows come from:");
  for (const [table] of [...read.entries()].sort()) {
    if (views.has(table) || !tables.has(table)) continue;
    const how = written.has(table)
      ? "src"
      : sqlWritten.has(table)
        ? "sql"
        : ALLOWLIST.has(table)
          ? "allowlisted"
          : "NOTHING";
    console.log(`    ${how.padEnd(12)} ${table}`);
  }
}

if (findings.length === 0) {
  console.log("\n✓ Every table the product reads has something that writes it.\n");
  process.exit(0);
}

console.log(`\n✗ ${findings.length} table(s) read by the product that NOTHING writes:\n`);
for (const f of findings) {
  console.log(`  • ${f.table}`);
  for (const r of f.readers.slice(0, 4)) console.log(`      read by ${r}`);
  if (f.readers.length > 4) console.log(`      …and ${f.readers.length - 4} more`);
}
console.log(
  "\n  Either ship the write path, or add an ALLOWLIST entry in this script naming what\n" +
    "  legitimately fills the table. A surface built on a table nobody writes renders\n" +
    "  correctly and shows nothing — see docs/tbc/2026-09-22-pattern-actions/closure.md.\n"
);
process.exit(1);
