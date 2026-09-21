#!/usr/bin/env node
//
// scripts/reachability-audit.mjs — modules that export something no non-test file reaches.
//
// WHY THIS EXISTS
// ───────────────
// A31 says schema-complete is not built: the seam between a correct system and a surface is
// where a feature silently becomes nonexistent. The same is true of code, and it happened three
// times in one feature on 2026-09-21:
//
//   generatePitchScore   the scoring engine, fully tested, with no route          (found by hand)
//   storePitchScore      the writer, fully tested, with no caller                 (found by hand)
//   aggregatePitches     17 passing tests, four exports, zero callers — every     (found by
//                        rubric average a rep would see, unreachable               counting importers)
//
// Each one looked like progress: the test count went up, the gates stayed green, and nothing
// anywhere said the code could not be reached. That is the property this audit exists to remove.
// A bottom-up build accumulates finished components that nothing calls, and the cheapest possible
// detection is counting importers — which is mechanical, so it can be a gate (A33) rather than a
// habit somebody has to remember.
//
// WHAT IT IS NOT: a dead-code remover. Some modules are deliberately unreachable from src/ and
// say so — a pure mirror of SQL kept as a drift-guard, a generator a CLI imports. Those are
// allowlisted WITH their reason, which is the point: the list is a record of every deliberate
// exception, so an ACCIDENTAL one stands out.
//
// Usage:  node scripts/reachability-audit.mjs
// Exit:   0 when every unreachable module is allowlisted, 1 otherwise.

import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join, sep } from "node:path";

const ROOT = "src";

// ─── Deliberate exceptions, each with the reason it is unreachable from src/ ──────────
//
// A module belongs here only when being unreachable is DELIBERATE, or when it is a known DEBT
// with the decision that created it on the record. Every entry says which, in its first word.
// "It might be useful later" is not a reason — that is precisely the orphan this catches, and
// writing DEBT instead of deleting the finding is what keeps the list honest rather than a
// place where findings go to be silenced (§5: the shortcut here is for the builder, not the
// system).
const ALLOWLIST = new Map([
  [
    "src/lib/finance/budgetVarianceAlignment.ts",
    "DELIBERATE. A pure TS mirror of migration 0191's period alignment, kept as a regression lock on the SQL — its own docblock says it is not wired into a query path. The 0149 quarter-vs-monthly bug is why it exists.",
  ],
  [
    "src/lib/coach/doorlog/offlineQueue.ts",
    "DELIBERATE, founder decision 2026-08-18. The offline system is on hold until its build plan is set; the file documents the exact re-enable (rewire DoorLog's noAnswer/save to enqueue()+drainQueue(), restore startAutoDrain on mount). Unreferenced is the point — it is never bundled and cannot interfere.",
  ],
  [
    "src/components/sales-coach/SalesCoachComing.tsx",
    "DELIBERATE. An honest placeholder for a planned-but-unbuilt Sales Coach section (AMD-006 L3, no nav dead-ends). Unused because every nav item currently has a real destination — which is the good state, not a defect.",
  ],
  [
    "src/lib/coach/emit.ts",
    "DEBT, not a decision. Coach v4 instrumentation, dead since commit 7904f180 (2026-06-13) which deleted its only caller and said so: 'emit.ts is now technically dead... Future cleanup will retire emit.ts + the v3 readout together.' That cleanup has not happened in three months. CONSEQUENCE: /api/admin/coach-readout and /api/brain/learning-summary still read coach.suggestion_offered/accepted/dismissed, and nothing has written one since June — those surfaces report a frozen accept rate with no indication it stopped. Retiring both together is a founder call about an admin surface.",
  ],
  [
    "src/components/ui/EmptyState.tsx",
    "DEBT, not a decision. Built for AMD-006 §1.5.1 layer 3 — first-run guidance so a brand-new tenant does not land on a blank module — and adopted by nothing. The problem it solves is therefore unsolved on every module. Nobody decided this should be unused.",
  ],
  [
    "src/lib/http/fetchJson.ts",
    "DEBT, not a decision. The primitive built to close the error-dressed-as-no-data class at source (throws a typed FetchJsonError on non-2xx, network and non-JSON failures) and adopted by nothing. The class is instead policed after the fact by INVARIANT 22. Nobody decided this should be unused.",
  ],
]);

// ─── Files the framework reaches without an import ───────────────────────────────────
const CONVENTIONAL =
  /\/(page|layout|route|template|default|loading|error|not-found|forbidden|unauthorized|opengraph-image|twitter-image|icon|apple-icon|sitemap|robots|manifest)\.(ts|tsx)$/;
const ROOT_CONVENTIONAL = /^src\/(middleware|instrumentation|proxy)\.tsx?$/;
const APP_ROOT_CONVENTIONAL = /^src\/app\/(global-error|global-not-found)\.tsx?$/;

const isTest = (f) => /__tests__|__mocks__|\.test\.|\.spec\./.test(f);
const isConventional = (f) =>
  CONVENTIONAL.test(f) || ROOT_CONVENTIONAL.test(f) || APP_ROOT_CONVENTIONAL.test(f);

function collect(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) collect(p, out);
    else if (/\.(ts|tsx)$/.test(p)) out.push(p.split(sep).join("/"));
  }
  return out;
}

if (!existsSync(ROOT)) {
  console.error(`reachability-audit: ${ROOT} not found — run from the repo root.`);
  process.exit(2);
}

const files = collect(ROOT);

// REFERRERS OUTSIDE src/. A module can be perfectly well used by something that is not itself
// application source — tailwind.config.ts imports the design tokens, and scripts/ CLIs import
// library code. Scanning only src/ reported both as orphans, which is the false-positive class
// that makes a gate get ignored (A33: precise, or it should not exist).
//
// These are searched for references but never themselves audited: a script is reached by a human
// typing its name, so "nothing imports it" says nothing about it.
const EXTRA_REFERRER_DIRS = ["scripts"];
const EXTRA_REFERRER_FILES = [
  "tailwind.config.ts",
  "next.config.ts",
  "next.config.mjs",
  "vitest.config.ts",
  "eslint.config.mjs",
  "postcss.config.mjs",
];

function collectAny(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) collectAny(p, out);
    else if (/\.(ts|tsx|mjs|js|cjs)$/.test(p)) out.push(p.split(sep).join("/"));
  }
  return out;
}

// THIS FILE IS NOT A REFERRER. Its allowlist and self-tests contain module paths as string
// literals, so scanning itself made it "find" references to the very modules it is auditing —
// budgetVarianceAlignment went quiet and the planted-orphan self-test started passing when it
// should have failed. The self-test caught it, which is the entire reason it exists: a matcher
// that silently matches everything reports zero and means nothing.
const SELF = "scripts/reachability-audit.mjs";

const referrers = [...files];
for (const d of EXTRA_REFERRER_DIRS) collectAny(d, referrers);
for (const f of EXTRA_REFERRER_FILES) if (existsSync(f)) referrers.push(f);

const source = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));
const referrerSource = new Map(
  [...new Set(referrers)].filter((f) => f !== SELF).map((f) => [f, readFileSync(f, "utf8")])
);

/**
 * Is `target` imported by any non-test file other than itself?
 *
 * Three ways a module is referenced in this codebase, and missing any of them produces a false
 * positive — which is the failure that makes a gate get ignored:
 *   1. the `@/` alias                       `@/lib/coach/pitchScore/aggregate`
 *   2. a DIRECTORY alias, for an index file `@/lib/brain`  →  src/lib/brain/index.ts
 *   3. a relative path                      `./aggregate`, `../pitchScore/aggregate`
 */
function isReached(target) {
  const base = target.replace(/^src\//, "").replace(/\.(ts|tsx)$/, "");
  const leaf = base.split("/").pop();
  const alias = `@/${base}`;
  const dirAlias = leaf === "index" ? `@/${base.replace(/\/index$/, "")}` : null;
  const relative = new RegExp(`from "\\.{1,2}/(?:[^"]*/)?${leaf}"`);

  // QUOTED, not a bare substring. A first pass matched `body.includes(alias)` and reported
  // src/lib/coach/emit.ts as reached because another file mentioned "coach/emit.ts" IN A COMMENT.
  // A prose mention is exactly what this audit must not accept as a caller — it is A19 at the
  // detector level: the label of a dependency with none of the substance.
  // A referrer outside src/ names the module by a path ENDING in its src-relative path, e.g.
  // scripts/pilot-generate.mjs imports "../src/lib/pilot/generateCode.ts".
  // A referrer outside src/ names the module by a path ENDING in its src-relative path —
  // scripts/pilot-generate.mjs imports "../src/lib/pilot/generateCode.ts". Plain suffix match
  // rather than a built regex: escaping a path into a pattern is a step that can go wrong,
  // and a matcher that silently stops matching reports zero and means nothing.
  const fromRootSuffix = `${target}"`;

  for (const [f, body] of referrerSource) {
    if (f === target || isTest(f)) continue;
    if (body.includes(`"${alias}"`)) return true;
    if (dirAlias && body.includes(`"${dirAlias}"`)) return true;
    if (relative.test(body)) return true;
    if (body.includes(fromRootSuffix)) return true;
  }
  return false;
}

const unreached = [];
for (const f of files) {
  if (isTest(f) || isConventional(f)) continue;
  // A file with no exports cannot be an orphan in the sense that matters — nothing was BUILT
  // there for someone else to use.
  if (!/^export /m.test(source.get(f))) continue;
  if (isReached(f)) continue;
  unreached.push(f);
}

const violations = unreached.filter((f) => !ALLOWLIST.has(f));
const documented = unreached.filter((f) => ALLOWLIST.has(f));

// ─── SELF-TEST — the guard must be able to detect its own violation ──────────────────
//
// Copied from the invariant audit's discipline, and it is not ceremony: a reachability check
// that silently matched everything would report zero and mean nothing, which is precisely the
// confident-empty-result this codebase has an invariant against. Proven 2026-09-21 by planting
// a module nothing imports and confirming it was flagged.
const selfTestFailures = [];
const st = (name, ok) => {
  if (!ok) selfTestFailures.push(name);
};
st("a planted module nothing imports would be flagged", !isReached("src/__definitely_not_a_real_file.ts"));
st("a module with a known importer is reached", isReached("src/lib/coach/pitchScore/aggregate.ts"));
st("the allowlist is not empty (it records deliberate exceptions)", ALLOWLIST.size > 0);
st("this audit does not count ITSELF as a referrer", !referrerSource.has(SELF));
st("test files are excluded", isTest("src/lib/x/__tests__/y.test.ts"));
st("a page file is treated as conventional", isConventional("src/app/dashboard/page.tsx"));
st("an ordinary component is NOT treated as conventional", !isConventional("src/components/X.tsx"));
// The bug this matcher was tightened for, pinned: a prose mention is not a caller.
st(
  "a module mentioned only in a COMMENT is not counted as reached",
  !/from "\.{1,2}\/(?:[^"]*\/)?emit"/.test("// same pattern as coach/emit.ts — see there")
);

console.log("═══ Reachability audit — code that exists and cannot be reached ═══");
console.log(`  Files scanned:          ${files.length}`);
console.log(`  Documented exceptions:  ${documented.length}`);
console.log(`  Unreachable modules:    ${violations.length}`);

if (selfTestFailures.length) {
  console.error(
    "\n⚠️ SELF-TEST FAILED — this audit can no longer detect its own violation:\n  - " +
      selfTestFailures.join("\n  - ") +
      "\nIts result is UNTRUSTWORTHY until the matcher is fixed."
  );
  process.exit(3);
}

if (documented.length) {
  console.log("");
  for (const f of documented) console.log(`    • ${f} — ${ALLOWLIST.get(f)}`);
}

if (violations.length === 0) {
  console.log("\n✓ Every exported module is reachable from a non-test file, or documented as an exception.");
  process.exit(0);
}

console.log("");
for (const f of violations) {
  console.log(`✗ Exported, and reached by no non-test file: ${f}`);
}
console.log(
  "\n  A module nothing imports is not finished work — it is work that LOOKS finished, and its\n" +
    "  tests make it look more finished. Either wire it to a caller, delete it, or add it to\n" +
    "  ALLOWLIST in this file WITH the reason it is deliberately unreachable.\n" +
    "  (A31: schema-complete is not built. 2026-09-21: three modules in one feature.)"
);
process.exit(1);
