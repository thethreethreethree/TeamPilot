#!/usr/bin/env node
//
// scripts/pilot-generate.mjs — generate additional pilot access codes.
//
// Recovers the (previously uncommitted) generation method as a reproducible,
// typo-safe-by-construction tool. Use it if the pilot expands past the original
// 100 codes.
//
//   npm run pilot:generate -- --module care --count 25            # DRY RUN (prints, writes nothing)
//   npm run pilot:generate -- --module elostate --count 25 --apply # inserts into pilot_codes
//
// Modules: elostate | care | sales_coach  (must match the CHECK on pilot_codes.module)
//
// Safety:
//   • DRY RUN by default — you must pass --apply to write. Codes are access keys;
//     writing them is a deliberate act.
//   • crypto.randomInt → unbiased, cryptographically-secure draws.
//   • Uniqueness is enforced both in-batch AND against every code already in the
//     DB, so a new batch can never shadow an existing code.
//   • Typo-safety is guaranteed by construction (PILOT_CODE_ALPHABET has no
//     0/O/1/I/L) — see src/lib/pilot/generateCode.ts and its guard test.

import { readFileSync } from "node:fs";
import { randomInt } from "node:crypto";
import pg from "pg";
import {
  PILOT_CODE_ALPHABET,
  generateDistinctPilotCodes,
  isValidPilotCodeShape,
} from "../src/lib/pilot/generateCode.ts";

const VALID_MODULES = ["elostate", "care", "sales_coach"];

function parseArgs(argv) {
  const args = { module: null, count: null, apply: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--module") args.module = argv[++i];
    else if (a === "--count") args.count = Number(argv[++i]);
    else if (a === "--apply") args.apply = true;
  }
  return args;
}

function usageExit(msg) {
  console.error(
    `\n${msg}\n\nUsage:\n  npm run pilot:generate -- --module <elostate|care|sales_coach> --count <n> [--apply]\n\n` +
      "Omit --apply for a dry run (prints the codes, writes nothing).\n",
  );
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
if (!VALID_MODULES.includes(args.module)) usageExit(`--module must be one of: ${VALID_MODULES.join(", ")}`);
if (!Number.isInteger(args.count) || args.count <= 0 || args.count > 1000) {
  usageExit("--count must be a positive integer <= 1000");
}

function loadConn() {
  const env = readFileSync(".env.local", "utf8");
  const m = env.match(/^SUPABASE_DB_URL=(.*)$/m);
  if (!m) {
    console.error("SUPABASE_DB_URL not found in .env.local");
    process.exit(1);
  }
  return m[1].trim().replace(/^["']|["']$/g, "");
}

const client = new pg.Client({ connectionString: loadConn(), ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
} catch (err) {
  console.error("\nCouldn't connect to the database (check SUPABASE_DB_URL in .env.local).\n  " +
    (err instanceof Error ? err.message : String(err)));
  process.exit(1);
}

try {
  // Pull every existing code so the new batch is globally unique, not just
  // unique within itself.
  const existing = new Set((await client.query("select code from pilot_codes")).rows.map((r) => r.code));

  const codes = generateDistinctPilotCodes(args.count, randomInt, existing);

  // Belt-and-suspenders: assert every generated code is shape-valid before we
  // even consider writing it (guards against a future generator regression).
  for (const c of codes) {
    if (!isValidPilotCodeShape(c)) {
      throw new Error(`Generated an invalid-shape code (${c}) — refusing to proceed.`);
    }
  }

  console.log(`\nAlphabet: ${PILOT_CODE_ALPHABET} (${PILOT_CODE_ALPHABET.length} symbols, no 0/O/1/I/L)`);
  console.log(`Module:   ${args.module}`);
  console.log(`Count:    ${args.count}`);
  console.log(`Existing: ${existing.size} code(s) already in the DB\n`);
  codes.forEach((c, i) => console.log(`  ${String(i + 1).padStart(3)}. ${c}`));

  if (!args.apply) {
    console.log("\n[DRY RUN] Nothing written. Re-run with --apply to insert these into pilot_codes.\n");
    process.exit(0);
  }

  // Insert. The DB UNIQUE constraint is the final backstop; a 23505 here would
  // mean a concurrent generator raced us — surface it honestly rather than swallow.
  await client.query("begin");
  for (const c of codes) {
    await client.query("insert into pilot_codes (code, module) values ($1, $2)", [c, args.module]);
  }
  await client.query("commit");
  console.log(`\n✓ Inserted ${codes.length} '${args.module}' code(s) into pilot_codes.\n`);
} catch (err) {
  try {
    await client.query("rollback");
  } catch {
    /* ignore rollback error — original error is what matters */
  }
  console.error("\nGeneration/insert failed (nothing committed):\n  " +
    (err instanceof Error ? err.message : String(err)));
  process.exitCode = 1;
} finally {
  await client.end();
}
