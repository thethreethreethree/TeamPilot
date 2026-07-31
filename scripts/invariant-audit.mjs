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
  ["pilot_codes", "0197 single-use pilot access codes; the app names the RPCs (pilot_code_status / redeem_pilot_code), never the table. RLS-sealed, DEFINER-written."],
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
  ["src/app/api/care/agent/acms/extract/route.ts",
    "Own inline validation, same shape as the sales-coach extractor: the file is NEVER STORED or served — " +
    "extracted to text in memory and discarded, so the stored-XSS / signed-URL-serving concerns " +
    "validateUploadCandidate defends do not apply. Validation is a strict EXTENSION ALLOWLIST of 8 document " +
    "types (txt/md/html/rtf/docx/odt/epub/pdf) — an allowlist rejects every executable BY CONSTRUCTION, and " +
    "the browser MIME is irrelevant because nothing is served. 4MB cap + a per-field char cap bound the blast " +
    "radius; a spoofed executable renamed .docx fails the parser rather than executing. Admin-gated (requireCareAgent + isAdmin)."],
  ["src/app/api/coach/sales-session/extract/route.ts",
    "Own inline validation, stronger + better-fit than the generic storage path: the file is NEVER STORED " +
    "or served — it is extracted to text in memory and discarded, so the stored-XSS / signed-URL-serving " +
    "concerns validateUploadCandidate defends do not apply. Validation is a strict EXTENSION ALLOWLIST of 8 " +
    "document types (txt/md/html/rtf/docx/odt/epub/pdf) — an allowlist rejects every executable BY " +
    "CONSTRUCTION (stronger than the BLOCKED_EXTENSIONS blocklist), and the browser MIME is irrelevant " +
    "because nothing is served. 15MB cap + a 500k extracted-char cap bound the blast radius; a spoofed " +
    "executable renamed .docx fails the format parser rather than executing. Manager-gated (isSalesCoachManager)."],
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

// ═══ INVARIANT 7 — every admin route enforces an admin gate ══════════════════════════════════════
//
// LEARNED: the CRM vendor-authz hole (2026-07-07, CRITICAL) — an admin route reachable by a non-admin (or a
// customer admin who is not the vendor) leaks platform/vendor data. RLS does not save you here: admin routes
// routinely use the service role or read cross-tenant aggregates by design, so the ROUTE's own gate is the
// only defense. Every route under src/app/api/admin/ must reference an admin gate; a new admin route without
// one is exactly the shape that opened the CRM hole. (Verified all 11 gated on 2026-07-27; this locks it.)
const ADMIN_GATE_ALLOWLIST = new Map();
const ADMIN_GATE_RE = /isAdmin|requireAdmin|requireVendorAdmin|requirePlatformAdmin|requireSuperAdmin/;
for (const f of FILES) {
  if (!/^src\/app\/api\/admin\/.*route\.(ts|tsx)$/.test(f.path)) continue;
  if (ADMIN_GATE_RE.test(f.sql)) continue;
  if (ADMIN_GATE_ALLOWLIST.has(f.path)) continue;
  findings.push({
    rule: "Admin route without an admin gate",
    file: f.path,
    why:
      "A route under /api/admin/ that references no admin gate (isAdmin / requireVendorAdmin / …) is\n" +
      "      reachable by any authenticated user — the exact class that opened the CRM vendor-authz hole\n" +
      "      (2026-07-07). Gate it at the top (403 before any data read), or allowlist here WITH the reason\n" +
      "      it is intentionally ungated.",
  });
}

// ═══ INVARIANT 8 — every extension route must be authenticated ═══════════════════════════════════
//
// LEARNED: the extension tool routes burn LLM/ElevenLabs cost AND read tenant data, on a PUBLIC-internet
// endpoint (MV3 extensions don't share the app's cookies — they send a Bearer token). A new extension route
// that forgets guardExtensionRequest (Bearer + entitlement + rate-limit) is an unauthenticated, uncapped
// cost + data surface. Every route under src/app/api/care/extension/ must authenticate. (Verified 2026-07-27.)
const EXT_AUTH_ALLOWLIST = new Map([
  [
    "src/app/api/care/extension/refresh/route.ts",
    "Token-refresh proxy: it CANNOT use the entitlement guard because the access token is expired (that is\n" +
      "      why it's refreshing). It authenticates via the refresh_token itself (required, bounded, rate-limited\n" +
      "      20/min, validated by Supabase's refresh grant → 401 if invalid). Different auth model, not ungated.",
  ],
]);
const EXT_AUTH_RE = /guardExtensionRequest|requireEntitledExtensionUser|requireExtensionAuth/;
for (const f of FILES) {
  if (!/^src\/app\/api\/care\/extension\/.*route\.(ts|tsx)$/.test(f.path)) continue;
  if (EXT_AUTH_RE.test(f.sql)) continue;
  if (EXT_AUTH_ALLOWLIST.has(f.path)) continue;
  findings.push({
    rule: "Extension route without authentication",
    file: f.path,
    why:
      "A route under /api/care/extension/ that references no extension auth (guardExtensionRequest / …) is a\n" +
      "      PUBLIC, unauthenticated endpoint that burns LLM cost + reads tenant data. Add guardExtensionRequest\n" +
      "      at the top, or allowlist here WITH the reason (e.g. a different auth model like token refresh).",
  });
}

// ═══ INVARIANT 9 — every NEXT_PUBLIC_ env var must be a reviewed, safe-to-expose value ════════════
//
// LEARNED (defensive): Next.js bundles EVERY NEXT_PUBLIC_-prefixed env var it sees referenced into the CLIENT
// bundle — visible to anyone who opens the site. A secret accidentally prefixed NEXT_PUBLIC_ (e.g.
// NEXT_PUBLIC_ANTHROPIC_KEY, NEXT_PUBLIC_STRIPE_KEY, NEXT_PUBLIC_SUPABASE_SERVICE_ROLE) leaks to every browser.
// This is an ALLOWLIST (not a denylist of scary words) on purpose: a denylist can't anticipate every future
// secret name (a new provider's KEY would slip through), so instead EVERY NEXT_PUBLIC_ var must be explicitly
// confirmed safe-to-expose here. The allowlist below is the 6 legit ones (URLs, a public id, the two PUBLIC
// keys). Anything new fails until reviewed + added — forcing a conscious "is this safe in the client?" decision.
const NEXT_PUBLIC_ALLOWLIST = new Map([
  ["NEXT_PUBLIC_BOOKING_URL", "A booking URL — public by nature."],
  ["NEXT_PUBLIC_BUILD_COMMIT", "The deployed git commit SHA (VersionWatcher stale-bundle check) — public, not a secret; the repo history is not sensitive."],
  ["NEXT_PUBLIC_CARE_EXTENSION_ID", "The Chrome extension id — a public identifier."],
  ["NEXT_PUBLIC_SITE_URL", "The app's own origin — public."],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "The Supabase ANON/client key — designed to ship client-side (RLS protects the data)."],
  ["NEXT_PUBLIC_SUPABASE_URL", "The Supabase project URL — public."],
  ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", "The PUBLIC half of the web-push VAPID keypair — the private half stays server-side."],
]);
const seenPublic = new Map(); // name -> first file it appears in
for (const f of FILES) {
  const matches = f.sql.match(/NEXT_PUBLIC_[A-Z0-9_]+/g);
  if (!matches) continue;
  for (const name of matches) {
    if (NEXT_PUBLIC_ALLOWLIST.has(name)) continue;
    if (!seenPublic.has(name)) seenPublic.set(name, f.path);
  }
}
for (const [name, file] of seenPublic) {
  findings.push({
    rule: "Unreviewed NEXT_PUBLIC_ env var (bundled into the client — possible secret leak)",
    file,
    why:
      `'${name}' is NEXT_PUBLIC_-prefixed, so Next.js bundles it into every client — anyone who opens the site\n` +
      "      can read it. Confirm it is SAFE to expose publicly (a URL, a public id, or a PUBLIC key — NOT a\n" +
      "      secret/API key/service-role), then add it to NEXT_PUBLIC_ALLOWLIST with the reason. If it's a\n" +
      "      secret, DROP the prefix and read it server-side only.",
  });
}

// ═══ INVARIANT 10 — every dangerouslySetInnerHTML must be justified (XSS) ═════════════════════════
//
// dangerouslySetInnerHTML renders RAW HTML. With any user/DB-derived content it is an XSS hole (React's
// default {text} escaping is exactly what protects the customer surfaces). Only a STATIC build-time constant
// or explicitly-SANITIZED content is safe. Force every use to be reviewed + justified here so a future
// raw-HTML render of customer/DB content can't slip in silently.
const XSS_ALLOWLIST = new Map([
  [
    "src/app/layout.tsx",
    "The no-flash theme script: __html is NO_FLASH_THEME_SCRIPT, a STATIC build-time string constant (sets the\n" +
      "      theme before hydration to avoid a flash). No user/DB interpolation, so no XSS surface.",
  ],
]);
for (const f of FILES) {
  if (!/dangerouslySetInnerHTML/.test(f.sql)) continue;
  if (XSS_ALLOWLIST.has(f.path)) continue;
  findings.push({
    rule: "Unreviewed dangerouslySetInnerHTML (XSS risk)",
    file: f.path,
    why:
      "dangerouslySetInnerHTML renders raw HTML — with ANY user/DB-derived content it is an XSS hole. Only a\n" +
      "      static constant or explicitly-sanitized string is safe. Render as escaped {text} instead, or allowlist\n" +
      "      it here WITH the reason it is safe (static constant? sanitized by which sanitizer?).",
  });
}

// ═══ INVARIANT 11 — every cron route must authenticate with CRON_SECRET ═══════════════════════════
//
// Cron routes are PUBLIC HTTP endpoints (Vercel Cron hits them over the internet). They run destructive or
// expensive work — the PII retention purge, the recording purge, the durability sweep. A cron route that
// forgets the CRON_SECRET Bearer check is triggerable by ANYONE: fire the PII purge, run up LLM/ElevenLabs
// cost, spam the sweep. Every route under a *-cron/ dir must reference CRON_SECRET. (Verified all 6 gated
// 2026-07-27.)
const CRON_AUTH_ALLOWLIST = new Map();
for (const f of FILES) {
  if (!/cron\/route\.(ts|tsx)$/.test(f.path)) continue;
  if (/CRON_SECRET/.test(f.sql)) continue;
  if (CRON_AUTH_ALLOWLIST.has(f.path)) continue;
  findings.push({
    rule: "Cron route without a CRON_SECRET check",
    file: f.path,
    why:
      "A *-cron route is a PUBLIC endpoint (Vercel Cron calls it over the internet) that runs destructive/\n" +
      "      expensive work (PII purge, recording purge, sweeps). Without the CRON_SECRET Bearer check, ANYONE\n" +
      "      can trigger it. Add the CRON_SECRET gate (503 if unset, 401 on mismatch, constantTimeEqual), or\n" +
      "      allowlist here WITH the reason it is intentionally open.",
  });
}

// ═══ INVARIANT 12 — the constitution version metadata must match the ratified amendments ══════════
//
// LEARNED: 2026-07-28. src/lib/constitution.ts (surfaced by /api/health AND the customer-facing version
// badge) drifted stale at AMD-004 / count 4 while AMD-005 and AMD-006 were ALREADY ratified in
// docs/amendments/ — the product reported a constitution state that wasn't true (§5 honesty). Nothing
// gated the constant against the amendment record, so the drift was silent for weeks. This check makes
// the two agree: amendmentCount === the number of RATIFIED AMD-*.md files, and lastAmendmentId === the
// highest ratified one. A newly-ratified amendment that forgets to bump the constant now fails the build.
const AMD_DIR = "docs/amendments";
{
  const ratified = [];
  for (const f of readdirSync(AMD_DIR)) {
    const mm = f.match(/^AMD-(\d+).*\.md$/i);
    if (!mm) continue;
    const status = (readFileSync(join(AMD_DIR, f), "utf8").match(/\*\*Status:\*\*\s*(\S+)/i)?.[1] ?? "").toLowerCase();
    if (status === "ratified") ratified.push(parseInt(mm[1], 10));
  }
  const constText = readFileSync("src/lib/constitution.ts", "utf8");
  const declaredCount = parseInt(constText.match(/amendmentCount:\s*(\d+)/)?.[1] ?? "-1", 10);
  const declaredLastId = constText.match(/lastAmendmentId:\s*["']([^"']+)["']/)?.[1] ?? "?";
  const expectedLastId = ratified.length ? `AMD-${String(Math.max(...ratified)).padStart(3, "0")}` : "?";
  if (declaredCount !== ratified.length) {
    findings.push({
      rule: "Constitution amendmentCount is stale",
      file: "src/lib/constitution.ts",
      why:
        `amendmentCount=${declaredCount} but docs/amendments/ has ${ratified.length} RATIFIED amendment(s).\n` +
        "      /api/health + the customer version badge would report a constitution state that isn't true (honesty).\n" +
        "      Update CONSTITUTION.amendmentCount (and version / lastAmendment*) to match the ratified record.",
    });
  }
  if (declaredLastId !== expectedLastId) {
    findings.push({
      rule: "Constitution lastAmendmentId is stale",
      file: "src/lib/constitution.ts",
      why:
        `lastAmendmentId=${declaredLastId} but the highest RATIFIED amendment is ${expectedLastId}.\n` +
        "      Update CONSTITUTION.lastAmendmentId / lastAmendmentDate / lastAmendmentTitle to the latest ratified one.",
    });
  }
}

// ═══ INVARIANT 13 — every raw PostgREST .or(...ilike...) filter is sanitized ══════════════════════
//
// LEARNED: the `.or("col.ilike.<term>,...")` API takes a RAW filter string it does NOT escape. An
// unescaped comma/paren in an INTERPOLATED term breaks out of the ilike into an attacker-chosen filter
// clause — PostgREST filter injection (widen results within a tenant, or a malformed-filter 400). The
// fix was one primitive (sanitizeOrIlikeTerm) wired into FOUR call sites (files/crm/care/global search).
// Verified 2026-07-28: all four sanitize. Nothing ENFORCED it — a 5th `.or(...ilike.${…})` added without
// the sanitizer would silently reopen the hole and pass every test (the primitive's own test still green).
// This locks the class: an interpolated raw ilike filter in a file that never imports sanitizeOrIlikeTerm
// is flagged. Parameterized `.ilike(col, term)` is safe (escaped) and carries no `ilike.` literal, so it
// is not matched.
const RAW_ILIKE_FILTER_RE = /`[^`]*ilike\.[^`]*\$\{/;
for (const f of FILES) {
  if (!RAW_ILIKE_FILTER_RE.test(f.sql)) continue;
  // The primitive + its test legitimately contain the shape; they ARE the sanitizer.
  if (/sanitizeOrIlikeTerm/.test(f.sql)) continue;
  findings.push({
    rule: "raw .or(...ilike...) filter must route through sanitizeOrIlikeTerm",
    file: f.path,
    why:
      "An INTERPOLATED term in a raw PostgREST `.or(\"col.ilike.${term}\")` string is filter injection —\n" +
      "      an unescaped comma/paren breaks out of the ilike into an attacker-chosen clause. Import\n" +
      "      sanitizeOrIlikeTerm from @/lib/data/searchTerm and wrap the term before building the filter.",
  });
}

// ═══ INVARIANT 14 — no route returns a raw error .message to the client (CWE-209) ═════════════════
//
// LEARNED: 2026-07-31, across ~50 sites in one sweep. Two shapes leaked raw exception/DB `.message` strings to
// the client — the direct `{ error: error.message }` and the catch fallback `{ error: err instanceof Error ?
// err.message : "…" }` (plus the interpolated `` `failed: ${err.message}` `` form). A raw Postgres error
// discloses schema / RLS / FK / column names; a raw provider error discloses internal detail. The fix was
// mechanical (log server-side, return a generic message) — but the CLASS lived only in an audit doc + a memory,
// exactly the "lesson in prose, not a gate" failure this whole file exists to catch. So it gets a gate.
//
// PRECISION (condition 3, no crying wolf): flag ONLY when `.message` is the DIRECT value of an `error:` field,
// AND the surrounding window has neither `kind:` (the intentional LlmError curated surface: {message, kind,
// provider}) nor a 400/403/415/422/429 status (a deliberate DOMAIN or VALIDATION message — finance "period
// closed", extract "unsupported type", the pilot/redeem + team/accept RPC domain messages). Those two
// structural exclusions cover every intentional site verified in the sweep, so the current tree is clean; a
// NEW `{ error: err.message }` at a 5xx with no LlmError structure is the leak shape and nothing else.
// Deliberate agent-facing `{ error: "generic", detail: err.message }` (co-pilot/summarize/formulate, doc'd
// 2026-07-25) is NOT matched — the `error:` value there is a string; `.message` rides a separate `detail:` key.
const RAW_ERR_MSG_RE =
  /\berror:\s*(?:`[^`]*\$\{[^}]*\.\s*message|[A-Za-z_$][\w$]*\s*\.\s*message\b|[A-Za-z_$][\w$]*\s+instanceof\s+Error\s*\?\s*[A-Za-z_$][\w$]*\s*\.\s*message)/;
const INTENTIONAL_ERR_STATUS_RE = /status:\s*(?:400|403|415|422|429)\b/;
const RAW_ERR_ALLOWLIST = new Map([
  // A diagnostic ping whose PURPOSE is to report the LLM provider's connectivity error to the caller — the
  // message IS the payload, and there is no schema/tenant data behind it (it never touches the DB).
  ["src/app/api/llm/ping/route.ts", "Diagnostic LLM-connectivity ping: surfacing the provider error is the point; no DB/tenant data behind it."],
]);
for (const f of FILES) {
  if (!/\/route\.ts$/.test(f.path)) continue;
  if (RAW_ERR_ALLOWLIST.has(f.path)) continue;
  const lines = f.sql.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!RAW_ERR_MSG_RE.test(lines[i])) continue;
    const win = lines.slice(Math.max(0, i - 2), i + 5).join("\n");
    if (/\bkind:/.test(win)) continue; // LlmError curated surface (message + kind [+ provider]) — intentional
    if (INTENTIONAL_ERR_STATUS_RE.test(win)) continue; // domain (400/403) or validation (415/422/429) message
    findings.push({
      rule: "Route returns a raw error .message to the client (CWE-209)",
      file: `${f.path}:${i + 1}`,
      why:
        "an `error:` field is set to a raw exception/DB `.message` at a 5xx with no LlmError `kind:` — this\n" +
        "      leaks internals (Postgres schema/RLS/FK detail, provider errors) to the client. Log it with\n" +
        "      console.error and return a GENERIC message; keep any `if (err instanceof LlmError)` branch (its\n" +
        "      {message,kind} surface is intentional). A deliberate domain/validation message belongs at\n" +
        "      400/403/415/422 (already excluded); otherwise allowlist here WITH the reason.",
    });
  }
}

// ═══ INVARIANT 15 — every coaching_sessions write pins company_id (tenant-scoped) ════════════════
//
// LEARNED: 2026-07-31. The upload-recording route stamped coaching_sessions.audio_asset_url with a
// service-role (RLS-bypassing) write scoped by session id ONLY, while the sibling save-recording scoped the
// same write by id AND company_id. It was safe only because an upstream getSession() RLS read had already
// proved company access — safe-by-an-upstream-property, one refactor away from a cross-tenant write. The whole-
// surface sweep (docs/audits/2026-07-31-tenant-write-scoping-class-sweep.md) found this was the only real gap,
// fixed it, and this gate locks the fix: the coaching_sessions write surface is small and fully enumerated
// (3 sites), so a NEW write here that forgets the company_id pin is caught immediately.
//
// PRECISION: only WRITES (.update(...)) are matched, and company_id is looked for within the SAME statement
// (from the .from(...) line up to the terminating `;`), so a company_id on a later statement can't mask a gap.
// The retention cron is allowlisted WITH its reason (it is intentionally system-wide over a trusted internal
// query — a company filter there would be wrong).
const COACHING_SESSION_WRITE_ALLOWLIST = new Map([
  [
    "src/app/api/coach/sales-session/recording-purge-cron/route.ts",
    "System retention cron (CRON_SECRET-gated): selects expired rows across ALL tenants by a created_at cutoff " +
      "with NO user input; row.id comes from its own trusted query, so a company_id filter would be meaningless.",
  ],
]);
/** True if `sql` contains a `.from("coaching_sessions")....update(...)` statement with NO `.eq("company_id"...)`
 *  in that same statement. Statement-bounded (stops at the first `;`) so a later scoped write can't mask it. */
function coachingSessionWriteUnscoped(sql) {
  const lines = sql.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!/\.from\(["']coaching_sessions["']\)/.test(lines[i])) continue;
    let stmt = "";
    for (let j = i; j < lines.length && j < i + 20; j++) {
      stmt += lines[j] + "\n";
      if (lines[j].includes(";")) break; // end of this PostgREST statement
    }
    if (!/\.update\(/.test(stmt)) continue; // reads (.select) are not writes — skip
    if (/\.eq\(["']company_id["']/.test(stmt)) continue; // tenant-scoped — good
    return true;
  }
  return false;
}
for (const f of FILES) {
  if (!/\/route\.ts$/.test(f.path)) continue;
  if (COACHING_SESSION_WRITE_ALLOWLIST.has(f.path)) continue;
  if (coachingSessionWriteUnscoped(f.sql)) {
    findings.push({
      rule: "coaching_sessions write not scoped to company_id (latent cross-tenant write)",
      file: f.path,
      why:
        "a `.from(\"coaching_sessions\").update(...)` here does not pin `.eq(\"company_id\", …)` in the same\n" +
        "      statement. A service-role write bypasses RLS, so an id-only scope is tenant-safe only if some\n" +
        "      upstream step proved company access — one refactor from a cross-tenant write. Add\n" +
        "      `.eq(\"company_id\", companyId)` (see save-recording / upload-recording). If this is an intentional\n" +
        "      system-wide job over a trusted internal query, allowlist it WITH the reason.",
    });
  }
}

// ═══ INVARIANT 16 — every route that awaits a blocking LLM/transcription call exports maxDuration ═══
//
// LEARNED: 2026-07-31. A route that `await`s an LLM completion (or a batch transcription) but omits
// `export const maxDuration` runs under Vercel's short default (~10-15s). The platform KILLS a slower
// response mid-generation, so the feature works in dev and TIMES OUT in prod — a dev-passes/prod-fails
// class. An earlier maxDuration sweep still left care/demo/ask + sales/demo/roleplay (the PUBLIC prospect
// demos) uncovered, both calling generateCareReply with no ceiling. The class has recurred, so it gets a
// gate: any route file that CALLS one of the known blocking LLM/transcription functions must set
// maxDuration. Keyed on the call site in the route file (the common shape); a route that hides the call
// behind a helper isn't matched — allowlist such a case here with its reason if it ever arises.
const LLM_CALL_RE =
  /\b(generateCareReply|dissectCoachV5|generateSales\w+|runAndStore\w+|transcribeWithDiarization|gradeCareAgentReply|generateSessionWhy|mintRealtimeSttToken)\s*\(/;
const MAXDURATION_ALLOWLIST = new Map();
for (const f of FILES) {
  if (!/\/route\.ts$/.test(f.path)) continue;
  if (MAXDURATION_ALLOWLIST.has(f.path)) continue;
  if (LLM_CALL_RE.test(f.sql) && !/export const maxDuration/.test(f.sql)) {
    findings.push({
      rule: "route awaits an LLM/transcription call but does not export maxDuration (prod timeout)",
      file: f.path,
      why:
        "this route calls a blocking LLM/transcription function but has no `export const maxDuration`, so\n" +
        "      Vercel's short default (~10-15s) will kill a slower response mid-generation — works in dev,\n" +
        "      times out in prod. Add `export const maxDuration = 60;` (300 for batch transcription), matching\n" +
        "      the other LLM routes. If the call is intentionally bounded elsewhere, allowlist WITH the reason.",
    });
  }
}

// ═══ INVARIANT 17 — every *-cron route is registered in vercel.json (else it silently never runs) ═══
//
// A cron route file that has no matching entry in vercel.json's `crons` is DEAD: the platform never invokes
// it, so whatever it powers (retention purge, KPI compute, report delivery, overrun sweep) silently doesn't
// happen. That's a high-consequence, low-visibility failure — the code looks complete, the feature just
// never runs. The current set matches 7↔7; this locks it so a NEW cron added without a schedule entry (or a
// schedule entry whose route was moved) is caught at check time. An intentionally-unscheduled cron is
// allowlisted WITH its reason.
const CRON_SCHEDULE_ALLOWLIST = new Map();
let scheduledCronKeys = new Set();
try {
  const vj = JSON.parse(readFileSync("vercel.json", "utf8"));
  for (const c of vj.crons ?? []) {
    scheduledCronKeys.add(String(c.path).replace(/^\/?api\//, "").replace(/^\//, ""));
  }
} catch {
  /* no/invalid vercel.json → every cron reads as unscheduled below (which is the honest signal) */
}
for (const f of FILES) {
  if (!/-cron\/route\.ts$/.test(f.path)) continue;
  if (CRON_SCHEDULE_ALLOWLIST.has(f.path)) continue;
  const routeKey = f.path.replace(/^src\/app\/api\//, "").replace(/\/route\.ts$/, "");
  if (!scheduledCronKeys.has(routeKey)) {
    findings.push({
      rule: "cron route not registered in vercel.json (silently never runs)",
      file: f.path,
      why:
        `this "*-cron" route has no matching entry in vercel.json's crons — the platform will never invoke\n` +
        "      it, so the feature it powers silently never runs. Add a `{ path: \"/api/" + routeKey +
        "\", schedule: … }`\n      entry, or (if intentionally unscheduled) allowlist it here WITH the reason.",
    });
  }
}

// ═══ SELF-TEST — the guards must be able to DETECT their own violation ════════════════════════════
//
// A guard that silently stops detecting is worse than no guard (it reads as "protected" while protecting
// nothing). If a future edit breaks a check's matcher, this audit would still print 0 violations — because a
// broken check finds nothing. So verify each added guard's core matcher flags a synthetic violation (and, where
// it's a presence-check, accepts a synthetic-valid). A failure here means a GUARD regressed — fix the matcher.
const selfTestFailures = [];
const st = (name, ok) => { if (!ok) selfTestFailures.push(name); };
// INV7 admin-gate: must NOT match an ungated route, MUST match a gated one.
st("INV7 flags an ungated admin route", !ADMIN_GATE_RE.test("export async function GET(){ return data; }"));
st("INV7 accepts a gated admin route", ADMIN_GATE_RE.test("const g = await requireVendorAdmin();"));
// INV8 extension-auth.
st("INV8 flags an unauth extension route", !EXT_AUTH_RE.test("export async function POST(){}"));
st("INV8 accepts a guarded extension route", EXT_AUTH_RE.test("await guardExtensionRequest(req,{});"));
// INV9 NEXT_PUBLIC_ scanner: must find a public var reference.
st("INV9 finds a NEXT_PUBLIC_ var", /NEXT_PUBLIC_[A-Z0-9_]+/.test("process.env.NEXT_PUBLIC_ANTHROPIC_KEY"));
st("INV9 allowlist knows the anon key", NEXT_PUBLIC_ALLOWLIST.has("NEXT_PUBLIC_SUPABASE_ANON_KEY"));
// INV10 XSS matcher.
st("INV10 finds dangerouslySetInnerHTML", /dangerouslySetInnerHTML/.test("<div dangerouslySetInnerHTML={{}}/>"));
// INV11 cron: path matcher + secret check.
st("INV11 matches a cron route path", /cron\/route\.(ts|tsx)$/.test("src/app/api/x-cron/route.ts"));
st("INV11 flags a cron missing CRON_SECRET", !/CRON_SECRET/.test("export async function GET(){}"));
// INV12 constitution metadata parsers.
st("INV12 parses amendmentCount", /amendmentCount:\s*(\d+)/.exec("amendmentCount: 6,")?.[1] === "6");
st("INV12 parses lastAmendmentId", /lastAmendmentId:\s*["']([^"']+)["']/.exec('lastAmendmentId: "AMD-006",')?.[1] === "AMD-006");
st("INV12 counts a ratified status", "ratified" === ("- **Status:** ratified".match(/\*\*Status:\*\*\s*(\S+)/i)?.[1] ?? "").toLowerCase());
st("INV12 excludes a proposed status", "ratified" !== ("- **Status:** **PROPOSED — not ratified.**".match(/\*\*Status:\*\*\s*(\S+)/i)?.[1] ?? "").toLowerCase());
// INV13 raw ilike .or() injection: must flag an interpolated raw ilike filter, must ignore parameterized .ilike().
st("INV13 flags an interpolated raw ilike filter", RAW_ILIKE_FILTER_RE.test("q.or(`title.ilike.%${t}%,description.ilike.%${t}%`)"));
st("INV13 ignores a parameterized .ilike()", !RAW_ILIKE_FILTER_RE.test('sb.ilike("body", term).eq("kind","message")'));
// INV14 raw-error-leak: must flag the direct/instanceof/interpolated shapes, must ignore a generic string,
// a detail-key .message, and the LlmError/domain-status exclusions.
st("INV14 flags a direct error.message", RAW_ERR_MSG_RE.test("{ error: error.message },"));
st("INV14 flags the instanceof fallback", RAW_ERR_MSG_RE.test("{ error: err instanceof Error ? err.message : 'x' },"));
st("INV14 flags an interpolated .message", RAW_ERR_MSG_RE.test("{ error: `write failed: ${error.message}` },"));
st("INV14 ignores a generic string error", !RAW_ERR_MSG_RE.test("{ error: \"Couldn't save.\" },"));
st("INV14 ignores a detail-key .message (deliberate agent surface)", !RAW_ERR_MSG_RE.test("{ error: 'generic', detail: err.message },"));
st("INV14 status-exclusion recognizes a 403 domain message", INTENTIONAL_ERR_STATUS_RE.test("{ status: 403 }"));
st("INV14 kind-exclusion leaves the LlmError surface alone", /\bkind:/.test("{ error: err.message, kind: err.kind }"));
st("INV13 ignores a static (non-interpolated) ilike filter", !RAW_ILIKE_FILTER_RE.test('q.or(`title.ilike.foo`)'));
// INV15 coaching_sessions tenant-scope: must flag an id-only write, accept a company-scoped one, ignore a read,
// and not let a LATER scoped statement mask an earlier unscoped write.
st("INV15 flags an id-only coaching_sessions write",
  coachingSessionWriteUnscoped('await a.from("coaching_sessions").update({ x: 1 }).eq("id", id);'));
st("INV15 accepts a company-scoped write",
  !coachingSessionWriteUnscoped('await a.from("coaching_sessions").update({ x: 1 }).eq("id", id).eq("company_id", c);'));
st("INV15 ignores a coaching_sessions read",
  !coachingSessionWriteUnscoped('const { data } = await a.from("coaching_sessions").select("*").eq("id", id).maybeSingle();'));
st("INV15 is statement-bounded (a later scoped write can't mask an earlier gap)",
  coachingSessionWriteUnscoped('await a.from("coaching_sessions").update({ x: 1 }).eq("id", id);\nawait a.from("coaching_sessions").update({ y: 2 }).eq("id", id).eq("company_id", c);'));
st("INV15 allowlist documents the retention cron",
  COACHING_SESSION_WRITE_ALLOWLIST.has("src/app/api/coach/sales-session/recording-purge-cron/route.ts"));
// INV16 maxDuration: must flag an LLM route with no maxDuration, accept one that has it, ignore a non-LLM route.
st("INV16 flags an LLM route without maxDuration",
  LLM_CALL_RE.test("const r = await generateCareReply({ systemPrompt });") &&
    !/export const maxDuration/.test("const r = await generateCareReply({ systemPrompt });"));
st("INV16 accepts an LLM route WITH maxDuration",
  /export const maxDuration/.test("export const maxDuration = 60;\nawait dissectCoachV5(x);"));
st("INV16 ignores a route with no LLM call", !LLM_CALL_RE.test("const { data } = await sb.from('x').select();"));
// INV17 cron-schedule: the path matcher must recognize a *-cron route and ignore a normal route; and the
// route→key normalization must line up with the vercel.json key form so a scheduled cron isn't false-flagged.
st("INV17 matches a *-cron route path", /-cron\/route\.ts$/.test("src/app/api/coach/kpi/compute-cron/route.ts"));
st("INV17 ignores a normal route path", !/-cron\/route\.ts$/.test("src/app/api/coach/kpi/me/route.ts"));
st("INV17 route→key equals the vercel.json key form",
  "src/app/api/coach/kpi/compute-cron/route.ts".replace(/^src\/app\/api\//, "").replace(/\/route\.ts$/, "") ===
    "/api/coach/kpi/compute-cron".replace(/^\/?api\//, "").replace(/^\//, ""));
if (selfTestFailures.length) {
  console.error("\n⚠️ INVARIANT-AUDIT SELF-TEST FAILED — a guard can no longer detect its own violation:\n  - " +
    selfTestFailures.join("\n  - ") + "\nThe audit's 0-violations is UNTRUSTWORTHY until the matcher is fixed.");
  process.exit(3);
}

// ═══ Report ═══════════════════════════════════════════════════════════════════════════════════
console.log("═══ Invariant audit — lessons this codebase already paid for ═══");
console.log(`  Files scanned:        ${FILES.length}`);
console.log(`  Documented exceptions: ${CSV_EXPORT_ALLOWLIST.size + SERVICE_ROLE_ALLOWLIST.size + UPLOAD_VALIDATE_ALLOWLIST.size + CROSS_PERSON_GATE_ALLOWLIST.size + ADMIN_GATE_ALLOWLIST.size + EXT_AUTH_ALLOWLIST.size + XSS_ALLOWLIST.size + NEXT_PUBLIC_ALLOWLIST.size + RAW_ERR_ALLOWLIST.size + COACHING_SESSION_WRITE_ALLOWLIST.size + MAXDURATION_ALLOWLIST.size + CRON_SCHEDULE_ALLOWLIST.size}`);
console.log(`  Violations:           ${findings.length}`);

if (findings.length === 0) {
  console.log(
    "\n✓ CSV exports formula-safe · finance routes RLS-scoped · finance schema reachable ·" +
      " no client-callable DEFINER tenant-param fn · every upload route validated ·" +
      " every cross-person read gated · every admin route gated · every extension route authenticated ·" +
      " no server secret NEXT_PUBLIC_-exposed · every dangerouslySetInnerHTML justified ·" +
      " every cron route CRON_SECRET-gated · constitution metadata matches the ratified amendments ·" +
      " every raw .or(...ilike...) filter sanitized (no PostgREST injection) ·" +
      " no route returns a raw error .message to the client (CWE-209) ·" +
      " every coaching_sessions write scoped to company_id (no latent cross-tenant write) ·" +
      " every LLM/transcription route exports maxDuration (no prod timeout) ·" +
      " every cron route registered in vercel.json (no silently-dead cron)."
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
