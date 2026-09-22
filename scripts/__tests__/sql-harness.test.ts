import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The SQL harness, tested for the one thing that would make it harmful.
 *
 * A harness that silently does nothing on a machine without Postgres turns three honest residuals
 * — 0264's view, `listFiles`' embed, the department route's RLS — into three false assurances.
 * That is strictly worse than not having built it, because the residuals at least said so.
 *
 * These do NOT require a database. They assert the SKIP path, which is the path most developers
 * and every fresh CI container will hit first, and which no other test would ever exercise. The
 * claims themselves are checked by running the harness against real Postgres; there is no way to
 * assert those without one, and pretending otherwise is the failure this file exists to prevent.
 */

const HARNESS = join(process.cwd(), "scripts/sql-harness.mjs");

/** Run with an environment that cannot reach any database. */
function runUnreachable() {
  try {
    const out = execFileSync("node", [HARNESS], {
      encoding: "utf8",
      env: {
        ...process.env,
        // A port nothing listens on, and no credentials. Both halves matter: a wrong port fails
        // fast, and clearing the password stops it inheriting a working one from the shell.
        PGHOST: "127.0.0.1",
        PGPORT: "1",
        PGUSER: "nobody",
        PGPASSWORD: "",
        MIGRATION_AUDIT_PSQL: "",
        MIGRATION_AUDIT_MAINT_DB: "definitely_not_a_database",
      },
    });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status: number; stdout: string };
    return { code: err.status, out: err.stdout };
  }
}

describe("the skip path — the way this file could do harm", () => {
  const { code, out } = runUnreachable();

  it("exits 0 so a developer without Postgres is not blocked", () => {
    expect(code).toBe(0);
  });

  it("SAYS IT IS NOT A PASS, in as many words", () => {
    // Exiting 0 and staying quiet is how a skip becomes an assurance.
    expect(out).toMatch(/THIS IS NOT A PASS/);
  });

  it("names every claim that went unchecked", () => {
    // A reader who sees the skip must know exactly what they are NOT being told.
    expect(out).toMatch(/unreviewed_violation_flags/i);
    expect(out).toMatch(/security_invoker/i);
    expect(out).toMatch(/profile_departments/i);
  });

  it("says WHY it could not connect, not just that it could not", () => {
    // "No reachable Postgres" is equally true of a machine with no server and of a healthy one
    // whose role is named something else, and those need different actions. The migration audit
    // learned this against a running postgres:16 container reporting `role does not exist` into a
    // catch block; the same lesson, one script over.
    expect(out).toMatch(/pg said: \S/);
  });

  it("tells the reader how to fix it", () => {
    expect(out).toMatch(/PGHOST/);
  });
});

describe("the staleness key", () => {
  const src = readFileSync(HARNESS, "utf8");

  it("hashes file CONTENTS, not just names or a count", () => {
    // A count misses an edit; an mtime moves when nothing did. Probed by hand against the real
    // corpus: adding a migration, removing it, and EDITING one with the file count unchanged each
    // moved the key (876e428c → ac57c871 → 876e428c → 4e72c53c). The third is the case a
    // count-based key would miss, and it is the one most likely to happen.
    expect(src).toMatch(/h\.update\(readFileSync\(join\(MIG_DIR, f\)\)\)/);
    expect(src).toMatch(/h\.update\(f\)/);
  });

  it("uses its OWN database, not the migration audit's", () => {
    // Sharing `migration_audit_scratch` means racing a process that drops and recreates it. That
    // produced a wrong policy count on 2026-09-22 which was reported as fact and had to be
    // corrected — a partial answer to a counting query looks exactly like a complete one.
    expect(src).toMatch(/sql_harness_scratch/);
    expect(src).not.toMatch(/SQL_HARNESS_DB \?\? "migration_audit_scratch"/);
  });
});

describe("isolation", () => {
  const src = readFileSync(HARNESS, "utf8");

  it("rolls back every claim, including on failure", () => {
    // `finally`, not a happy-path rollback: a claim that threw and left its rows behind would make
    // the next one depend on the order they happen to run in.
    expect(src).toMatch(/} finally \{\s*await c\.query\("rollback"\);/);
  });
});
