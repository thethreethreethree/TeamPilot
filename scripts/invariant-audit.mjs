#!/usr/bin/env node
//
// scripts/invariant-audit.mjs — invariants this codebase LEARNED THE HARD WAY, made structural.
//
// ─── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────────────────────
//
// On 2026-07-14 I introduced a cross-tenant data leak in 19 database views: a Postgres view runs as its
// OWNER unless declared `with (security_invoker = true)`, so it reads its base tables WITHOUT the querying
// user's RLS policies.
//
// This codebase had ALREADY LEARNED THAT. Migration 0052_views_security_invoker.sql exists for exactly
// that reason. 0060 repeats it. Every finance view through 0150 sets the option.
//
// The lesson was learned. It was written into a migration. It was NEVER ENCODED IN A CHECK.
//
// So it came back — nineteen times, in a single session, while `rls:audit` reported green.
//
//   A lesson that lives only in a past migration is a lesson the next author re-learns the hard way.
//   A lesson that lives only in a doc is a lesson that survives exactly as long as someone remembers
//   to read the doc.
//
// That failure is not about views. It is a CLASS: every invariant this project paid for and then recorded
// only in prose is one careless commit from returning. rls-audit now guards the view rule. This script
// guards the others.
//
// ─── THE STANDARD FOR ADDING A CHECK HERE ────────────────────────────────────────────────────
//
// A rule belongs in this file when: (1) the codebase already broke it once and paid for it, (2) the fix
// was recorded in prose (a migration comment, a doc, a memory) rather than a gate, and (3) a mechanical
// check can detect a violation without crying wolf.
//
// Condition (3) is not optional. An audit that raises false alarms on correct code is an audit people
// learn to skip — and then the ONE real violation rides in behind the noise. Every check below is
// allowlist-backed: a deliberate exception is DOCUMENTED WITH ITS REASON, never silently tolerated.
//
// Usage:  node scripts/invariant-audit.mjs

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = "src";
const findings = [];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(p) && !/__tests__/.test(p)) out.push(p);
  }
  return out;
}

const FILES = walk(ROOT).map((f) => ({ path: f.replace(/\\/g, "/"), sql: readFileSync(f, "utf8") }));

// ═══ INVARIANT 1 — every CSV export routes through csvSafe ════════════════════════════════════
//
// LEARNED: 2026-07-12. RFC-4180 quoting does NOT stop formula injection (CWE-1236). A cell beginning
// `=`, `+`, `-` or `@` is EXECUTED by Excel/Sheets when the file is opened — so an attacker who can get a
// string into any exported field (a vendor name, a project name, a memo) gets code execution on the
// machine of whoever opens the export. The quoting is correct and the file is still dangerous.
//
// The fix was one primitive (neutralizeCsvFormula) and two producers wired to it. The rule — "wire any new
// export to it, don't re-copy" — lived in a memory. Nothing enforced it. Every new export page since has
// been one forgotten import away from reopening the hole.
const CSV_EXPORT_ALLOWLIST = new Map([
  // A file INPUT (`accept=".csv"`) is an import, not an export. Nothing is written, so nothing can be
  // injected into a spreadsheet by us.
  ["src/app/dashboard/finance/banking/page.tsx", "CSV file INPUT (bank statement import), not an export."],
  ["src/app/dashboard/finance/cards/page.tsx", "CSV file INPUT (card statement import), not an export."],
]);

for (const f of FILES) {
  const producesCsv =
    /new Blob\(\s*\[[^\]]*\]\s*,\s*\{\s*type:\s*["']text\/csv/.test(f.sql) ||
    /["']text\/csv["']\s*[,;)]/.test(f.sql) ||
    /\.csv["'`]/.test(f.sql);
  if (!producesCsv) continue;
  if (CSV_EXPORT_ALLOWLIST.has(f.path)) continue;

  const routed = /csvSafe|neutralizeCsvFormula|toCsv|statementsToCsv/.test(f.sql);
  if (!routed) {
    findings.push({
      rule: "CSV export must route through csvSafe",
      file: f.path,
      why:
        "A cell starting with = + - or @ is EXECUTED by Excel when the file opens (CWE-1236). RFC-4180\n" +
        "      quoting does not prevent this. Import toCsv from @/lib/export/toCsv, or add an allowlist\n" +
        "      entry here if this is a CSV *import* rather than an export.",
    });
  }
}

// ═══ INVARIANT 2 — no service-role client inside finance routes ═══════════════════════════════
//
// LEARNED: the CRM vendor-authz hole (2026-07-07, CRITICAL). RLS-only audits MISS service-role routes
// entirely, because the service role bypasses RLS by design. Every finance route must use the RLS-bound
// user client, so that the database — not the route's own `if` statements — decides who may read what.
//
// A single service-role call in a finance route silently converts every RLS policy protecting that data
// into decoration.
const SERVICE_ROLE_ALLOWLIST = new Map([
  [
    "src/app/api/finance/reports/deliver-cron/route.ts",
    "0172 scheduled delivery: runs at 07:00 with NO logged-in user, so it MUST use the admin client.\n" +
      "      It is safe because it makes NO authorization decision of its own: it reads\n" +
      "      fin_report_schedules_due, a view that has ALREADY re-checked — at send time — that each\n" +
      "      recipient is still in the company, still active, and still holds finance access. The worker\n" +
      "      cannot send what it is not told about; the database never hands it the address.",
  ],
]);

for (const f of FILES) {
  if (!f.path.startsWith("src/app/api/finance/")) continue;
  const usesServiceRole = /createAdminClient|SUPABASE_SERVICE_ROLE|service_role/.test(f.sql);
  if (!usesServiceRole) continue;
  if (SERVICE_ROLE_ALLOWLIST.has(f.path)) continue;

  findings.push({
    rule: "No service-role client in a finance route",
    file: f.path,
    why:
      "The service role BYPASSES RLS. One such call turns every RLS policy protecting this data into\n" +
      "      decoration, and an RLS audit will still report green (this is exactly how the CRM vendor\n" +
      "      hole happened, 2026-07-07). Use createClient() from @/lib/supabase/server, or allowlist it\n" +
      "      here WITH the reason it cannot be RLS-bound.",
  });
}

// ═══ INVARIANT 3 — a finance table/column must be REACHABLE from the product ══════════════════
//
// LEARNED: 2026-07-14, FOUR TIMES IN ONE SESSION. Not four accidents — one blind spot, four times.
//
//   · The Controls page shipped with no nav entry. Unreachable.
//   · 0181 linked invoice lines to stock items, and no UI could set the link. COGS could never fire.
//   · 0179 added problem_id to three tables, built four views, an API and a page — and NOTHING in the
//     product could ever WRITE it. Cost-per-outcome would have read "0% of your spending is tagged"
//     forever, on every company. I had already called it BUILT.
//   · 0159's collections page could record a chase but never CREATE the ladder it derives from. With no
//     ladder, no invoice is ever due for a chase, and the page sits empty looking perfectly healthy.
//
// In every case the schema was correct, the views were correct, the page was correct — AND THE FEATURE DID
// NOT EXIST. A feature complete in the database and invisible in the product is not built (AMD-006 L3).
//
// The seam between schema and surface is where this codebase's author is careless. So it gets a gate, and
// the gate does not care how confident the author is.
//
// The check: every column added to a fin_* table, and every fin_* table created, must be NAMED somewhere in
// src/ — or be allowlisted with the reason it is written only by a DEFINER RPC.
const MIG_DIR = "supabase/migrations";
const migs = readdirSync(MIG_DIR).filter((f) => f.endsWith(".sql")).sort();

// Tables written ONLY by SECURITY DEFINER RPCs. The app never names them, and must not: a client that could
// write them directly could forge a depreciation run, an inventory receipt, or a 'sent' delivery.
const RPC_ONLY_TABLES = new Map([
  ["fin_depreciation_entries", "0166 written only by fin_run_depreciation; a client insert could forge depreciation."],
  ["fin_inventory_movements", "0180 written only by the receive/sell/adjust RPCs; a client insert could manufacture stock value."],
  ["fin_card_matches", "0160 written only by the match RPCs."],
  ["fin_payment_schedules", "0158 written via the schedule/execute/cancel RPCs (the UI names the ROUTE, not the table)."],
  ["fin_report_deliveries", "0172 written only by fin_record_report_delivery; a client insert could forge a 'sent'."],
  ["fin_year_closes", "0151 written only by the year-end close RPC."],
  ["fin_dunning_events", "0159 written only by fin_record_dunning_action (append-only evidence)."],
  ["fin_source_postings", "0122 written only by fin_post_system_entry."],
  ["fin_audit_log", "0120 written only by the fin_audit trigger."],
  ["fin_journal_entries", "0118 written only by fin_post_entry / fin_post_system_entry; the app reads views. A client insert could post an unbalanced entry."],
  ["fin_entry_counters", "0118 internal entry-number sequence, advanced by the posting RPC."],
  ["fin_receipts", "0132 written only by fin_record_receipt (row-locked, over-receipt guarded)."],
  ["fin_reconciliation_matches", "0145 written only by the bank-match RPCs."],
  ["fin_opening_lines", "0169 written through the opening-balances route, which names the batch not the line table."],
]);

const ADD_COL_RE = /alter\s+table\s+(fin_\w+)\s+add\s+column\s+if\s+not\s+exists\s+(\w+)/gi;
const CREATE_TBL_RE = /create\s+table\s+if\s+not\s+exists\s+(fin_\w+)/gi;

const srcBlob = FILES.map((f) => f.sql).join("\n");
const camel = (s) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
const named = (s) => srcBlob.includes(s) || srcBlob.includes(camel(s));

const seenCols = new Set();
const seenTbls = new Set();

for (const f of migs) {
  const sql = readFileSync(join(MIG_DIR, f), "utf8").toLowerCase();
  let m;
  while ((m = ADD_COL_RE.exec(sql))) {
    const [, table, col] = m;
    const key = `${table}.${col}`;
    if (seenCols.has(key)) continue;
    seenCols.add(key);
    // Bookkeeping columns are set by defaults/triggers, never by the app — naming them would be the bug.
    if (/^(created_at|updated_at|created_by|company_id|id|posted_entry_id|entry_id)$/.test(col)) continue;
    if (RPC_ONLY_TABLES.has(table)) continue;
    if (!named(col)) {
      findings.push({
        rule: "A finance column must be reachable from the product",
        file: `${MIG_DIR}/${f}`,
        why:
          `${key} exists in the schema and NOTHING in src/ ever writes it. Whatever reads it will report\n` +
          "      an empty/zero result forever, on every company, and look perfectly healthy. Add the write\n" +
          "      path (API + the line editor / form), or add the table to RPC_ONLY_TABLES with its reason.",
      });
    }
  }
  ADD_COL_RE.lastIndex = 0;

  while ((m = CREATE_TBL_RE.exec(sql))) {
    const [, table] = m;
    if (seenTbls.has(table)) continue;
    seenTbls.add(table);
    if (RPC_ONLY_TABLES.has(table)) continue;
    if (!named(table)) {
      findings.push({
        rule: "A finance table must be reachable from the product",
        file: `${MIG_DIR}/${f}`,
        why:
          `${table} exists and is never named in src/. Either the feature it backs is unreachable, or the\n` +
          "      table is DEFINER-RPC-written — in which case add it to RPC_ONLY_TABLES *with the reason*,\n" +
          "      so the next reader can tell a deliberate omission from a forgotten one.",
      });
    }
  }
  CREATE_TBL_RE.lastIndex = 0;
}

// ═══ Report ═══════════════════════════════════════════════════════════════════════════════════
console.log("═══ Invariant audit — lessons this codebase already paid for ═══");
console.log(`  Files scanned:        ${FILES.length}`);
console.log(`  Documented exceptions: ${CSV_EXPORT_ALLOWLIST.size + SERVICE_ROLE_ALLOWLIST.size}`);
console.log(`  Violations:           ${findings.length}`);

if (findings.length === 0) {
  console.log("\n✓ Every CSV export is formula-safe, and no finance route bypasses RLS.");
  process.exit(0);
}

console.log("");
for (const f of findings) {
  console.log(`✗ ${f.rule}`);
  console.log(`    ${relative(".", f.file).replace(/\\/g, "/")}`);
  console.log(`      ${f.why}\n`);
}
console.log("Each of these is a bug this project has ALREADY shipped once. Do not ship it twice.");
process.exit(1);
