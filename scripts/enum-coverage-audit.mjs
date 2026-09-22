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

/**
 * The same idea for a function's value list: `// sql-source: admin_roles()`.
 *
 * A SEPARATE marker, not a cleverer single one. `enum-source:` claims "this union mirrors a
 * column's CHECK set"; `sql-source:` claims "this constant mirrors what a function returns".
 * Different claims about different things, and one regex covering both would be a regex whose
 * failure mode is matching the wrong kind — which is the failure this whole audit exists to
 * avoid, one level up.
 */
const FN_MARKER = /\/\/\s*sql-source:\s*([a-z0-9_]+)\(\s*\)/gi;

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
  const stripped = stripSqlComments(readFileSync(join(MIGRATIONS, file), "utf8"));
  const sql = stripped.toLowerCase();

  /**
   * A SECOND KIND OF SOURCE: a function that returns a value list.
   *
   * 0265 moved the company-admin role list into `admin_roles()` because it had been written out
   * in 47 RLS policies, one of the 48 copies was edited on 2026-08-29, and the rest were not — a
   * CFO was an admin in the application and an admin nowhere in the database, for 24 days, with
   * nothing reporting a problem the whole time, because no check compares a TypeScript constant
   * to a SQL array.
   *
   * That migration took 48 copies to 2. This takes the remaining 2 to 1 that can drift unseen.
   *
   * PARSED FROM `stripped`, NOT `sql` — the case is preserved on purpose. CHECK-set values are
   * lowercase by convention here; role names are not (`CEO`, `CFO`, `COO`). Lowercasing them
   * would make every comparison fail, and the obvious repair would be to lowercase the mirror
   * too, which would then stop catching a genuine case mismatch.
   *
   * Keyed WITH its parentheses — `admin_roles()` — so the two namespaces cannot collide: a
   * `table.column` key can never contain a bracket.
   */
  /**
   * BOUNDED TO THE FUNCTION BODY by its dollar-quoting, and the first version of this was not.
   *
   * `function NAME\(\)[\s\S]*?array\[...\]` looks non-greedy and safe. It is neither: nothing
   * stops `[\s\S]*?` crossing out of the function and finding the next `array[...]` ANYWHERE
   * later in the file. Run over the real migrations, that version reported
   *
   *     auth_company_id => ["tasks","team_members","decisions","conversations"]
   *
   * which is not in that function at all — it is a list from a different statement in 0001.
   *
   * That is the same failure this audit exists to catch, committed inside the audit: a parser
   * that silently reads something other than what is there. Found by PRINTING what it matched
   * rather than trusting a green verdict — and the verdict was green, because the opt-in design
   * meant no mirror had declared `auth_company_id()` and nothing was ever compared against the
   * wrong set. The design contained a bug it could not prevent.
   *
   * Now: match the dollar-quoted body (`$$ ... $$`, `$function$ ... $function$`) with a
   * backreference to its own tag, and look for the array INSIDE it.
   */
  for (const m of stripped.matchAll(
    /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z0-9_]+)\s*\(\s*\)[\s\S]*?\bas\s*\$([a-z0-9_]*)\$([\s\S]*?)\$\2\$/gi
  )) {
    const arr = /\barray\s*\[([\s\S]*?)\]/i.exec(m[3]);
    if (!arr) continue;
    const values = new Set([...arr[1].matchAll(/'([^']+)'/g)].map((v) => v[1]));
    if (values.size < 2) continue; // a one-value list is a constant, not a set
    // LAST DEFINITION WINS, for the same reason as a CHECK: `create or replace` REPLACES.
    enums.set(`${m[1].toLowerCase()}()`, { values, file });
  }

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

    /**
     * VALUES READ WITH THEIR CASE, from `stripped` rather than from the lowercased `sql`.
     *
     * The table and column names are matched against the lowercased text — SQL identifiers are
     * case-insensitive and the key has to be stable. The VALUES are not identifiers. 0239's
     * constraint is
     *
     *     check (role in ('CEO','CFO','COO','VP','Director','Manager','Supervisor','Lead','Member'))
     *
     * and `INVITABLE_ROLES` in roles.ts holds exactly those nine, in exactly that case. Read
     * lowercased, this audit would have reported all nine as both MISSING and NOT IN THE
     * DATABASE — a spurious failure that would have made the marker unusable on the one other
     * two-authority list this repository has.
     *
     * It never surfaced because all eight mirrors declared before today hold snake_case values,
     * where lowercasing is a no-op. A transformation that is invisible on every current subject
     * and wrong on the next one is worth removing before it is met.
     *
     * `toLowerCase()` preserves length for ASCII, so the same span of `stripped` is the same
     * match with its case intact — guarded, because that is not true for every Unicode input.
     */
    const span = stripped.length === sql.length ? stripped.slice(m.index, m.index + m[0].length) : m[0];
    const values = new Set([...span.matchAll(/'([^']+)'/g)].map((v) => v[1]));
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

  // The function-list form. Same body extraction, same member regex, different marker and key.
  FN_MARKER.lastIndex = 0;
  let f;
  while ((f = FN_MARKER.exec(code)) !== null) {
    const key = `${f[1].toLowerCase()}()`;
    const line = code.slice(0, f.index).split("\n").length;
    const after = code.slice(f.index + f[0].length);
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
problem: mirror.key.endsWith("()")
              ? `no function named ${mirror.key} returning a value list exists in the migrations`
              : `no CHECK constraint named ${mirror.key} exists`,
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
  "\n  A CHECK value this union does not name reaches whatever switches on it and falls\n" +
    "  through — see docs/tbc/2026-09-22-founder-rulings/build.md, the bell that was about\n" +
    '  to say "A rep closed a deal" about a coaching note.\n\n' +
    "  A `()` mirror out of step is the other shape: an authority the application grants and\n" +
    "  the database refuses, or the reverse. See docs/tbc/2026-09-22-admin-roles-source — a\n" +
    "  CFO was an admin in the app and an admin nowhere in the database, for 24 days.\n"
);
process.exit(1);
