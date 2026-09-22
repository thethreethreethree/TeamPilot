#!/usr/bin/env node
//
// scripts/enum-coverage-audit.mjs — a declared mirror of a CHECK set must be complete
//
// Why this exists
// ───────────────
//   `manager_notifications.type` is a CHECK-constrained set. On 2026-09-22 three values were
//   added to it across three migrations — `recording_comment`, `recording_share_requested`,
//   `pattern_coached` — each with a writer, tests and a reason. `NotificationBell.tsx` declared a
//   TypeScript union of the OTHER three. All three new values would have reached its `text()`
//   chain, fallen through to the last branch, and told a rep "A rep closed a deal" about a
//   coaching note on their own pitch. Row written, bell rung, sentence wrong.
//
//   `writer:audit` is blind to it — that table has 117 writers. This is the same family one level
//   down: not a TABLE with no writer, but a VALUE in a closed set that nothing renders.
//
// What was tried first, and why it is not this
// ────────────────────────────────────────────
//   The obvious rule is "if the code knows SOME values of a CHECK set, it must know ALL of them",
//   inferred by scanning string literals. It was built and measured four times against the whole
//   schema (99 sets), and every version produced false positives from a DIFFERENT cause:
//
//     v1  any literal anywhere              9 findings — `"lost"` belongs to the pivot-direction
//                                           enum, not to coaching_sessions.outcome; `"ai"` was
//                                           missed by a 3-character floor and reported absent
//                                           while being handled two lines away
//     v2  site = a file with 2+ values      6 — English is small: "sent"/"failed" collide
//     v3  + the site must name its table    4
//     v4  + comments stripped               3 — a docstring listing a set is the likeliest place
//                                           for its values to appear together
//     alt a TS union overlapping a set     59 — colour names, status words, everywhere
//
//   All three of v4's survivors were verified by hand and all three were CORRECT code: routes
//   that TRANSITION a subset of a state machine (`draft → submitted`, "mark it ignored") or
//   validate one ("fail and unable need a note; pass does not"). A route that writes part of a
//   state machine legitimately names part of it.
//
//   That is not a bug to allowlist — it is the rule being wrong, and wrong in a way that gets
//   worse: EVERY future transition route would fire it. A gate whose false-positive rate grows
//   with ordinary development is allowlisted into silence by construction, and then it looks like
//   coverage (A30: a gate must be precise or not exist).
//
// The rule that IS precise
// ────────────────────────
//   Inference cannot tell "mirrors this column" from "shares two ordinary words with it".
//   Declaration can. A union that intends to mirror a CHECK set says so:
//
//       // enum-source: manager_notifications.type
//       type NotificationType = "strong_session" | "deal_closed" | …;
//
//   The audit then requires that union to contain EXACTLY the set — no missing value, no invented
//   one. Zero false positives by construction, because nothing is audited that has not opted in;
//   zero cost where unused; and it puts the contract at the one place a human decided the two
//   things are the same list.
//
//   The marker is also the documentation. Someone extending the CHECK sees, in the migration's
//   own comment, that a union mirrors it — and the gate makes forgetting a compile-time-shaped
//   failure instead of a wrong sentence in someone's bell.
//
// Usage
// ─────
//   node scripts/enum-coverage-audit.mjs            # report, exit 1 on a mismatch
//   node scripts/enum-coverage-audit.mjs --verbose  # also list every declared mirror
//
// Exit code
// ─────────
//   0 when every declared mirror matches its CHECK set. 1 otherwise.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const VERBOSE = process.argv.includes("--verbose");
const MIGRATIONS = "supabase/migrations";
const SRC = "src";

/** The opt-in marker. Everything after it, to the end of the statement, is the mirror. */
const MARKER = /\/\/\s*enum-source:\s*([a-z0-9_]+)\.([a-z0-9_]+)/gi;

/* ─── Walk ──────────────────────────────────────────────────────────────────────────────── */

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(p, out);
    } else out.push(p);
  }
  return out;
}

const stripSqlComments = (sql) =>
  sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");

/* ─── Every CHECK-constrained value set in the schema ────────────────────────────────────── */

const enums = new Map(); // "table.column" -> { values: Set, file }

for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
  const sql = stripSqlComments(readFileSync(join(MIGRATIONS, file), "utf8")).toLowerCase();

  /**
   * WHOLE-FILE, NOT LINE-BY-LINE, and this is the bug that made the first run wrong about the
   * very table the audit was built for.
   *
   * 0242 writes `check (type in ('strong_session','deal_closed'))` on one line. Every extension
   * since — 0257, 0261, 0262, 0263 — formats the list across several, because it has grown to
   * seven values with a comment habit of one per line. A line-scanner sees the 2005-era
   * single-line form and NONE of the others, so it reported `manager_notifications.type` as a
   * two-value set and called four correctly-handled values "not in the database".
   *
   * A parser that silently sees less than is there is the same failure as a gate that cannot
   * fail. Matched on the full text with `[\s\S]`, and each constraint attributed to the nearest
   * preceding table statement by POSITION.
   */
  const tableAt = [];
  for (const m of sql.matchAll(
    /(?:create\s+table\s+(?:if\s+not\s+exists\s+)?|alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?)([a-z0-9_."]+)/g
  )) {
    const name = m[1].replace(/"/g, "").replace(/^public\./, "");
    // `if` / `only` leaking through an optional group is the 0022 trap; reject the keywords.
    if (["if", "only", "not", "exists"].includes(name)) continue;
    tableAt.push({ index: m.index, name });
  }

  for (const m of sql.matchAll(/check\s*\(\s*([a-z0-9_]+)\s+in\s*\(([\s\S]*?)\)/g)) {
    let owner = null;
    for (const t of tableAt) {
      if (t.index < m.index) owner = t.name;
      else break;
    }
    if (!owner) continue;

    const values = new Set([...m[2].matchAll(/'([^']+)'/g)].map((v) => v[1]));
    if (values.size < 2) continue; // a one-value CHECK is a constant, not a set

    // LAST DEFINITION WINS. A migration that drops and re-adds a constraint is REPLACING it;
    // treating them as cumulative would keep values a later migration deliberately removed.
    enums.set(`${owner}.${m[1]}`, { values, file });
  }
}

/* ─── Every declared mirror in application code ─────────────────────────────────────────── */

const mirrors = []; // { key, members, file, line }

for (const file of walk(SRC).filter((f) => [".ts", ".tsx"].includes(extname(f)))) {
  const code = readFileSync(file, "utf8");
  MARKER.lastIndex = 0;
  let m;
  while ((m = MARKER.exec(code)) !== null) {
    const key = `${m[1].toLowerCase()}.${m[2].toLowerCase()}`;
    const line = code.slice(0, m.index).split("\n").length;

    // The union runs from the marker to the first `;` — which is the end of the type alias or
    // the property it annotates. Bounded so a marker cannot silently swallow the rest of a file.
    const after = code.slice(m.index + m[0].length);
    const end = after.indexOf(";");
    const body = end === -1 ? after.slice(0, 2000) : after.slice(0, end);

    mirrors.push({
      key,
      members: new Set([...body.matchAll(/["']([a-z0-9_]+)["']/gi)].map((x) => x[1])),
      file,
      line,
    });
  }
}

/* ─── The finding ───────────────────────────────────────────────────────────────────────── */

const findings = [];
for (const mirror of mirrors) {
  const target = enums.get(mirror.key);
  if (!target) {
    findings.push({
      ...mirror,
      problem: `no CHECK constraint named ${mirror.key} exists`,
      missing: [],
      extra: [],
    });
    continue;
  }
  const missing = [...target.values].filter((v) => !mirror.members.has(v));
  // AN INVENTED VALUE IS ALSO A FINDING, and the less obvious half: a union member the database
  // will never produce is dead code that reads as a handled case, and it survives a CHECK being
  // narrowed by a later migration.
  const extra = [...mirror.members].filter((v) => !target.values.has(v));
  if (missing.length === 0 && extra.length === 0) continue;
  findings.push({ ...mirror, problem: null, missing, extra });
}

/* ─── Report ────────────────────────────────────────────────────────────────────────────── */

console.log("\n═══ Enum mirrors — a declared mirror of a CHECK set must be complete ═══");
console.log(`  CHECK-constrained sets: ${enums.size}`);
console.log(`  Declared mirrors:       ${mirrors.length}`);

if (VERBOSE) {
  for (const mi of mirrors) {
    const t = enums.get(mi.key);
    console.log(`    ${mi.key} ← ${mi.file}:${mi.line} (${mi.members.size}/${t ? t.values.size : "?"})`);
  }
}

if (findings.length === 0) {
  console.log("\n✓ Every declared mirror matches its CHECK set exactly.\n");
  process.exit(0);
}

console.log(`\n✗ ${findings.length} mirror(s) out of step with the database:\n`);
for (const f of findings) {
  console.log(`  • ${f.key}   ${f.file}:${f.line}`);
  if (f.problem) console.log(`      ${f.problem}`);
  if (f.missing.length) console.log(`      MISSING: ${f.missing.join(", ")}`);
  if (f.extra.length) console.log(`      NOT IN THE DATABASE: ${f.extra.join(", ")}`);
}
console.log(
  "\n  A value the database can produce and this union does not name will reach whatever\n" +
    "  switches on it and fall through. See docs/tbc/2026-09-22-founder-rulings/build.md —\n" +
    '  the bell that was about to say "A rep closed a deal" about a coaching note.\n'
);
process.exit(1);
