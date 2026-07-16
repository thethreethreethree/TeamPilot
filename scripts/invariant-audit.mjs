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

  // ── NON-FINANCE: the core §3.1 chain and its controls ──
  //
  // problem_thresholds is the SHARPEST true negative this gate has produced, and it is worth stating why
  // rather than merely silencing it.
  //
  // It is seeded with defaults (0002) and read by the Understanding-Gate trigger ITSELF — the constitutional
  // control (§3.2) that stops a half-understood problem from reaching a human. It is unreachable from the
  // app ON PURPOSE. An app-editable threshold would let someone LOWER THE EVIDENCE BAR for surfacing a
  // problem, which is not a settings change: it is disabling the one structural gate the product exists to
  // enforce. Its absence from src/ is the control working.
  //
  // This is the distinction the allowlist exists to make: "nothing writes it" is a BUG when the feature
  // needs a human to set it, and a CONTROL when a human must never be able to.
  ["problem_thresholds", "§3.2 Understanding-Gate thresholds: DB-seeded, trigger-read. App-editable thresholds would let someone lower the evidence bar for surfacing a problem — disabling the core structural gate. Unreachable BY DESIGN."],
  ["events", "§3.1 append-only historical record; the app inserts via the emit helpers, which name the helper not the table."],
]);

// Individual COLUMNS the app deliberately does not name (the table IS app-facing, but this column is
// DEFINER-managed or derived, not user-set). Same rule as RPC_ONLY_TABLES: a deliberate omission carries its
// reason, so the next reader can tell it from a forgotten one.
const RPC_ONLY_COLUMNS = new Map([
  ["fin_recurring_bills.anchor_day", "0186 — the day-of-month a bill re-anchors to (drift fix). DERIVED from next_date (the date the user picks) and read only by the DEFINER recurrence fn fin_generate_recurring_bill. There is no separate user control: the user sets the DATE; the day-of-month follows. Naming it in src/ would imply a UI control that correctly does not exist."],
]);

// NOT limited to fin_*. A31's own lesson is "ask what part of this you find boring, and put the gate
// there" — and the core product (events, signals, problems, resolutions, care, coach) had NEVER been
// checked for reachability at all. It came back clean but for one deliberate exception, and a gate that
// only guards the domain you happened to be working in is a gate that will miss the next domain.
const ADD_COL_RE = /alter\s+table\s+(\w+)\s+add\s+column\s+if\s+not\s+exists\s+(\w+)/gi;
const CREATE_TBL_RE = /create\s+table\s+if\s+not\s+exists\s+(\w+)/gi;

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
    if (RPC_ONLY_COLUMNS.has(key)) continue;
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

// ═══ INVARIANT 4 — a SECURITY DEFINER function taking a TENANT PARAMETER must not be client-callable ══
//
// LEARNED: 2026-07-14, by asking what `rls:audit` CANNOT SEE (§A30: a green gate is a statement about the
// gate's vocabulary, never about the system). It checks tables. It now checks views. IT HAS NO CONCEPT OF A
// FUNCTION — and a SECURITY DEFINER function bypasses RLS entirely, by design.
//
// PostgREST exposes every public function as an RPC endpoint. So a DEFINER function that accepts a company
// id as a PARAMETER, rather than deriving it from auth_company_id(), can be called by any authenticated
// user with SOMEBODY ELSE'S company id. The sweep found nine — two of which INSERT into another company's
// chart of accounts.
//
// AND IT IS §A30 CONFIRMING ITSELF: 0122 already knew. It ends with a `revoke execute ... from
// authenticated, anon` on fin_post_system_entry, because someone understood exactly this danger. They fixed
// the one in front of them, wrote it in SQL — and nothing encoded the rule. The next NINE helpers with the
// same shape were written without it, including two of mine, in the same session in which I was writing an
// essay about this precise failure mode.
//
// The rule: such a function must either be REVOKEd from authenticated+anon, or guard its parameter against
// auth_company_id(). Revoking is preferred — it removes the attack surface rather than defending it, and a
// guard is a rule the tenth author will forget.
// matchAll, not exec-in-a-while: a /g regex carries `lastIndex` between calls, so a matcher shared across
// 183 files is a stateful trap — and I fell straight into it, shipping a check that silently matched nothing
// while reporting green. That is the exact bug this whole audit exists to catch, committed inside the audit
// itself. matchAll is stateless.
const DEFINER_RE =
  /create\s+or\s+replace\s+function\s+(\w+)\s*\(([^)]*)\)([\s\S]{0,400}?)\$\$([\s\S]*?)\$\$/gi;

const definerFns = new Map();   // name -> { guarded, file }
for (const f of migs) {
  const sql = readFileSync(join(MIG_DIR, f), "utf8");
  for (const mm of sql.matchAll(DEFINER_RE)) {
    const name = mm[1], params = mm[2], head = mm[3], body = mm[4];
    if (!/security\s+definer/i.test(head)) continue;
    // The parameter must be an actual TENANT ID — a company UUID. My first version matched `p_co` (which
    // hits `p_code`) and `p_company` (which hits `p_company_name`, a text label), and flagged two pre-auth
    // onboarding functions that are correctly client-callable. A gate that cries wolf on correct code is one
    // people learn to skip, and then the real violation rides in behind the noise (§A25). So: name AND type.
    if (!/(^|[\s,(])(p_company|p_company_id|company_id)[\s]+uuid([\s,)]|$)/i.test(params)) continue;
    definerFns.set(name.toLowerCase(), {
      // Does the body constrain the caller to their OWN company? Then the parameter cannot be abused.
      guarded: /auth_company_id\(\)/.test(body),
      file: f,
    });
  }
}

// A later migration may revoke it. Last statement wins, so this is collected across the whole history.
const revoked = new Set();
for (const f of migs) {
  const sql = readFileSync(join(MIG_DIR, f), "utf8");
  for (const m of sql.matchAll(/revoke\s+execute\s+on\s+function\s+(\w+)/gi)) {
    revoked.add(m[1].toLowerCase());
  }
}

for (const [name, info] of definerFns) {
  if (info.guarded) continue;                       // constrains p_company against the caller's own company
  if (revoked.has(name.toLowerCase())) continue;    // not reachable from a client at all
  findings.push({
    rule: "A SECURITY DEFINER function taking a tenant parameter must not be client-callable",
    file: `${MIG_DIR}/${info.file}`,
    why:
      `${name}() is SECURITY DEFINER, takes the company as a PARAMETER, and never checks it against ` +
      "auth_company_id(). PostgREST exposes it as an RPC endpoint, so any authenticated user can call it " +
      "with ANOTHER TENANT'S company id — and a DEFINER function bypasses RLS by design. " +
      "Fix: `revoke execute on function ...(sig) from authenticated, anon;` — preferred, because it " +
      "removes the attack surface rather than defending it. Or guard p_company against auth_company_id().",
  });
}

// ═══ INVARIANT 5 — every file-upload route must VALIDATE the upload ═══════════════════════════
//
// LEARNED: 2026-07-16. Five routes accept a file upload. Four wire the shared validateUploadCandidate
// (size cap + MIME allow-list + BLOCKED_EXTENSIONS). ONE — the sales-call recording upload — rolled its own
// inline checks and FORGOT the extension block, so an executable uploaded as Content-Type: audio/webm passed
// the MIME-prefix check with nothing rejecting the .exe (fix 0964c64: EXECUTABLE_EXTENSIONS). The validator
// existed and was tested. Nothing enforced that every upload route USES a sanctioned validation path — so the
// one route that diverged, diverged silently. Same shape as INVARIANT 4: a rule known and written, not gated.
//
// The rule: a route that reads a multipart File must run EITHER validateUploadCandidate (general files) OR,
// for a media route that legitimately can't (the validator blocks .webm/.mp4), the EXECUTABLE_EXTENSIONS
// block — or be allowlisted with the reason its own inline validation is sufficient.
const UPLOAD_VALIDATE_ALLOWLIST = new Map([
  ["src/app/api/care/agent/tenant/logo/route.ts",
    "Own inline validation, stronger than the generic path for its use case: strict image-ONLY MIME allow-list " +
    "(png/jpg/svg/webp/ico), 2MB cap, and the stored extension is DERIVED FROM THE VALIDATED MIME (never the " +
    "filename) into a fixed path {companyId}/widget-logo.{ext}. No client filename reaches the storage key, so " +
    "the BLOCKED_EXTENSIONS check adds nothing. (SVG is allowed but served cross-origin from the storage bucket " +
    "and rendered via <img>, so SVG-script never runs in the app origin.)"],
]);
for (const f of FILES) {
  if (!/\/route\.ts$/.test(f.path)) continue;
  const handlesUpload =
    /formData\(\)/.test(f.sql) &&
    /(instanceof File|uploadAssetBytes|\.arrayBuffer\(\))/.test(f.sql);
  if (!handlesUpload) continue;
  if (UPLOAD_VALIDATE_ALLOWLIST.has(f.path)) continue;
  if (/validateUploadCandidate|EXECUTABLE_EXTENSIONS/.test(f.sql)) continue;
  findings.push({
    rule: "A file-upload route must validate the upload (size / MIME / extension)",
    file: f.path,
    why:
      "reads a multipart File (formData) but never runs validateUploadCandidate or the EXECUTABLE_EXTENSIONS\n" +
      "      block. The browser-supplied Content-Type is spoofable, so an executable can ride in under a claimed\n" +
      "      image/audio type. Wire validateUploadCandidate (general files) or EXECUTABLE_EXTENSIONS (media\n" +
      "      routes that need .webm/.mp4), or allowlist it with the reason its inline validation is sufficient.",
  });
}

// ═══ INVARIANT 6 — a route reading a NAMED OTHER PERSON's data must use the shared cross-person gate ═══
//
// LEARNED: 2026-07-17 (the ELOSALES Standard manager-transparency revision — the first leader-visible-data
// surface this codebase shipped). Three coach routes accept `?agentId=` — i.e. the caller names WHICH PERSON's
// data to read. Two wired the shared gate (isSalesCoachManager + canManagerViewRepSkills, pure + unit-tested).
// The ELO route rolled its own inline copy of "who counts as a manager" — the FOURTH copy of that predicate,
// and one the same session's consolidation missed. It happened to be correct. Nothing enforced that it stay
// correct, and nothing would have caught it if it hadn't been: same shape as INVARIANT 4 and 5 — a rule known
// and written, not gated.
//
// Why THIS is the chokepoint: "is this surface leader-visible?" is a semantic property of a UI with no
// mechanical detector (A33 — do not lower the precision bar). But one layer down, every read of a NAMED other
// person's data must accept that person's id from the caller. `?agentId=` IS that chokepoint: a route reading
// it is, by construction, either serving self or crossing the §A18 boundary. Precise by design — a route that
// reads agentId and does not gate it is the IDOR/shadow-read shape, never a false positive.
//
// The rule: a route reading `searchParams.get("agentId")` must gate it through canManagerViewRepSkills — or be
// allowlisted with the reason its own path is sufficient. NOTE the deliberate narrowness: `memberId`/`userId`
// are NOT matched. team/route.ts reads `memberId` to REMOVE a member — a mutation target, not a per-person
// read — and firing there would be exactly the cry-wolf failure A30 forbids.
// BOUNDARY — what this invariant does NOT cover, stated so a green run is not mistaken for a complete one
// (A26: an exclusion is a real boundary decision and must be named, never silently skipped):
//
//   1. SQL. The manager predicate ALSO lives in RLS — 0084's `coaching_sessions - select` admits
//      `p.role in ('CEO','COO','admin') or p.sales_coach_role = 'admin'`, and 0102's UPDATE policy mirrors it.
//      That is a FIFTH definition of "manager", in a language this TS-scanning gate cannot reach. It agrees with
//      skillAccess today (verified 2026-07-17); nothing enforces that it keeps agreeing. Comparing a
//      regex-extracted SQL fragment against a TS function is not a precise detector (A33) — so this is declined
//      and recorded, not gated. The rls:audit script is the surface that would own it if it ever becomes one.
//   2. Cross-person reads that carry no person-id. A manager opening ONE rep's session by session-id
//      (`/api/coach/sales-session/[id]`) is a cross-person read with no `agentId` anywhere. It is RLS-scoped
//      (createClient, not the admin client), so the policy above IS its gate — correct today, and outside this
//      detector by construction. A route that reads a session with the ADMIN client and no in-code gate would
//      slip past both this invariant and RLS; that shape has no precise detector either.
const CROSS_PERSON_GATE_ALLOWLIST = new Map([]);
for (const f of FILES) {
  if (!/\/route\.ts$/.test(f.path)) continue;
  if (!/searchParams\.get\(["']agentId["']\)/.test(f.sql)) continue;
  if (CROSS_PERSON_GATE_ALLOWLIST.has(f.path)) continue;
  if (/canManagerViewRepSkills/.test(f.sql)) continue;
  findings.push({
    rule: "A route reading another person's data (?agentId=) must use the shared cross-person gate",
    file: f.path,
    why:
      "reads `agentId` from the caller — so it can serve one person's data to another — but never calls canManagerViewRepSkills. That gate is pure, unit-tested, and enforces BOTH conditions (caller is a manager AND target is in the same company). Hand-rolling it is how the fourth copy of the manager predicate appeared. Wire the shared gate, or allowlist with the reason. See docs/pre-merge-checklists/LEADER-VISIBLE-DATA.md before shipping any leader-visible surface.",
  });
}

// ═══ Report ═══════════════════════════════════════════════════════════════════════════════════
console.log("═══ Invariant audit — lessons this codebase already paid for ═══");
console.log(`  Files scanned:        ${FILES.length}`);
console.log(`  Documented exceptions: ${CSV_EXPORT_ALLOWLIST.size + SERVICE_ROLE_ALLOWLIST.size + UPLOAD_VALIDATE_ALLOWLIST.size + CROSS_PERSON_GATE_ALLOWLIST.size}`);
console.log(`  Violations:           ${findings.length}`);

if (findings.length === 0) {
  console.log(
    "\n✓ CSV exports formula-safe · finance routes RLS-scoped · finance schema reachable ·" +
      " no client-callable DEFINER tenant-param fn · every upload route validated ·" +
      " every cross-person read gated."
  );
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
