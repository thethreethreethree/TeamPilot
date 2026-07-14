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
