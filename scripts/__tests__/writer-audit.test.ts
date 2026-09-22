import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Tests for the writer audit.
 *
 * A gate that cannot FAIL is a green light with extra steps, and this codebase has shipped one
 * before — the rls-audit's SELECT rule once had a regex that could never match, so it reported
 * success while never running. The migration audit was re-proven with a planted probe for the
 * same reason: an emptied finding list and a broken gate look identical.
 *
 * So these tests build small fake trees and assert the audit's VERDICT on each, rather than
 * asserting that it exits 0 on today's repository. The one that matters most is the first: the
 * exact shape that went undetected for three builds must be caught.
 */

const run = (cwd: string) => {
  try {
    const out = execFileSync("node", [join(process.cwd(), "scripts/writer-audit.mjs")], {
      cwd,
      encoding: "utf8",
    });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status: number; stdout: string };
    return { code: err.status, out: err.stdout };
  }
};

/** A throwaway repo: `supabase/migrations` + `src`, and nothing else the audit reads. */
function fixture(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "writer-audit-"));
  mkdirSync(join(dir, "supabase/migrations"), { recursive: true });
  mkdirSync(join(dir, "src"), { recursive: true });
  for (const [path, body] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, body, "utf8");
  }
  // The script resolves itself from process.cwd(); it reads paths relative to the cwd it runs in.
  cpSync(join(process.cwd(), "scripts/writer-audit.mjs"), join(dir, "writer-audit.mjs"));
  return dir;
}

const clean = (dir: string) => rmSync(dir, { recursive: true, force: true });

describe("the shape that went undetected for three builds", () => {
  it("FAILS on a table the product reads and nothing writes", () => {
    // pattern_events, exactly: a table with policies, an index, careful CHECK constraints, five
    // surfaces reading it, and no writer anywhere.
    const dir = fixture({
      "supabase/migrations/0001_log.sql": `
        create table if not exists pattern_events (
          id uuid primary key,
          kind text not null check (kind in ('coached','note'))
        );
        create index if not exists pattern_events_idx on pattern_events (id);
      `,
      "src/read.ts": `export const read = () => supabase.from("pattern_events").select("*");`,
    });
    const { code, out } = run(dir);
    expect(code).toBe(1);
    expect(out).toContain("pattern_events");
    expect(out).toMatch(/NOTHING writes/);
    clean(dir);
  });

  it("names the file that reads it, so the finding is actionable", () => {
    const dir = fixture({
      "supabase/migrations/0001.sql": "create table if not exists widgets (id uuid);",
      "src/lib/readWidgets.ts": `supabase.from("widgets").select("id");`,
    });
    const { out } = run(dir);
    expect(out).toMatch(/readWidgets\.ts/);
    clean(dir);
  });
});

describe("what counts as a writer", () => {
  it("(a) application code that inserts it", () => {
    const dir = fixture({
      "supabase/migrations/0001.sql": "create table if not exists widgets (id uuid);",
      "src/read.ts": `supabase.from("widgets").select("id");`,
      "src/write.ts": `supabase.from("widgets").insert({ id: 1 });`,
    });
    expect(run(dir).code).toBe(0);
    clean(dir);
  });

  it("(a) also counts upsert, update and delete", () => {
    for (const method of ["upsert", "update", "delete"]) {
      const dir = fixture({
        "supabase/migrations/0001.sql": "create table if not exists widgets (id uuid);",
        "src/read.ts": `supabase.from("widgets").select("id");`,
        "src/write.ts": `supabase.from("widgets").${method}({ id: 1 });`,
      });
      expect(run(dir).code, method).toBe(0);
      clean(dir);
    }
  });

  it("(b) a seed INSERT in a migration — the reason lookup tables do not fire", () => {
    // Without this, every rubric config and every reference table would be a finding, and an
    // audit whose first run produces forty findings gets allowlisted into silence (A30).
    const dir = fixture({
      "supabase/migrations/0001.sql": `
        create table if not exists rubric_versions (id uuid, label text);
        insert into rubric_versions (id, label) values (gen_random_uuid(), 'attfiber-v1');
      `,
      "src/read.ts": `supabase.from("rubric_versions").select("label");`,
    });
    expect(run(dir).code).toBe(0);
    clean(dir);
  });

  it("(c) an INSERT inside a trigger or function body", () => {
    const dir = fixture({
      "supabase/migrations/0001.sql": `
        create table if not exists audit_log (id uuid);
        create or replace function log_it() returns trigger as $$
        begin
          insert into audit_log (id) values (new.id);
          return new;
        end; $$ language plpgsql;
      `,
      "src/read.ts": `supabase.from("audit_log").select("id");`,
    });
    expect(run(dir).code).toBe(0);
    clean(dir);
  });

  it("an UPDATE by a trigger counts too — something maintains the row", () => {
    const dir = fixture({
      "supabase/migrations/0001.sql": `
        create table if not exists totals (id uuid, n int);
        create or replace function bump() returns trigger as $$
        begin update totals set n = n + 1; return new; end; $$ language plpgsql;
      `,
      "src/read.ts": `supabase.from("totals").select("n");`,
    });
    expect(run(dir).code).toBe(0);
    clean(dir);
  });
});

describe("what must NOT count as a writer", () => {
  it("a write that exists only in a test", () => {
    // A test writes against a mock. If that counted, the audit would pass on a table whose only
    // insert is a fixture — which is the failure it exists to catch, dressed as coverage.
    const dir = fixture({
      "supabase/migrations/0001.sql": "create table if not exists widgets (id uuid);",
      "src/read.ts": `supabase.from("widgets").select("id");`,
      "src/__tests__/widgets.test.ts": `supabase.from("widgets").insert({ id: 1 });`,
    });
    expect(run(dir).code).toBe(1);
    clean(dir);
  });

  it("a .test.ts file outside a __tests__ directory", () => {
    const dir = fixture({
      "supabase/migrations/0001.sql": "create table if not exists widgets (id uuid);",
      "src/read.ts": `supabase.from("widgets").select("id");`,
      "src/widgets.test.ts": `supabase.from("widgets").insert({ id: 1 });`,
    });
    expect(run(dir).code).toBe(1);
    clean(dir);
  });

  it("an INSERT that appears only in a SQL COMMENT", () => {
    // The 0022 lesson, applied here: prose in a migration header describing what a table is for
    // reads exactly like the statement it describes.
    const dir = fixture({
      "supabase/migrations/0001.sql": `
        -- Rows arrive via: insert into widgets (id) values (...)
        -- ...which is documentation, not a writer.
        create table if not exists widgets (id uuid);
      `,
      "src/read.ts": `supabase.from("widgets").select("id");`,
    });
    expect(run(dir).code).toBe(1);
    clean(dir);
  });
});

describe("what is exempt, and why", () => {
  it("a VIEW, because views are not writable", () => {
    // Its backing tables are audited on their own, which is where a missing writer would matter.
    const dir = fixture({
      "supabase/migrations/0001.sql": `
        create table if not exists door_knocks (id uuid);
        insert into door_knocks (id) values (gen_random_uuid());
        create or replace view rep_kpi_daily as select * from door_knocks;
      `,
      "src/read.ts": `supabase.from("rep_kpi_daily").select("*");`,
    });
    expect(run(dir).code).toBe(0);
    clean(dir);
  });

  it("a name that was a TABLE and is now a VIEW", () => {
    // Found by mutation: removing the view exemption survived, because a view is normally not in
    // the table set either and the next check catches it. This is the case where the line
    // decides — a table dropped and replaced by a view of the same name, which this codebase has
    // done before in spirit (rep_activity → rep_kpi_daily). The name is in BOTH sets, and
    // without the exemption the audit would demand a writer for something not writable.
    const dir = fixture({
      "supabase/migrations/0001.sql": "create table if not exists rep_activity (id uuid);",
      "supabase/migrations/0002.sql": `
        drop table if exists rep_activity;
        create table if not exists door_knocks (id uuid);
        insert into door_knocks (id) values (gen_random_uuid());
        create or replace view rep_activity as select * from door_knocks;
      `,
      "src/read.ts": `supabase.from("rep_activity").select("*");`,
    });
    expect(run(dir).code).toBe(0);
    clean(dir);
  });

  it("a table this repo does not define — another system owns it", () => {
    const dir = fixture({
      "supabase/migrations/0001.sql": "create table if not exists widgets (id uuid);",
      "src/read.ts": `supabase.from("some_external_thing").select("*");`,
    });
    expect(run(dir).code).toBe(0);
    clean(dir);
  });

  it("a table NOBODY reads — an unused table is not this audit's finding", () => {
    // Deliberately out of scope. A table with neither a reader nor a writer is dead weight, not
    // a feature that renders empty, and conflating the two is how the allowlist grows.
    const dir = fixture({
      "supabase/migrations/0001.sql": "create table if not exists unused (id uuid);",
      "src/read.ts": `export const nothing = 1;`,
    });
    expect(run(dir).code).toBe(0);
    clean(dir);
  });
});

describe("the real repository", () => {
    /**
     * THIRTY SECONDS, AND THE MEASUREMENT RATHER THAN A GUESS.
     *
     * The audit itself runs in 0.31–0.42s standalone over the whole repository (261 migrations,
     * every src file), measured three times. The 5s default was not spent on the audit — it was
     * spent SPAWNING A NODE PROCESS inside a vitest worker while ~700 other test files are
     * running, and that cost is contention-dependent rather than bounded by anything this file
     * controls.
     *
     * So the number is raised because the budget was measuring the wrong thing, not because the
     * work got slower. If this ever times out again the audit has genuinely regressed by two
     * orders of magnitude and the number should NOT be raised a second time.
     */
  it("passes, with every exception carrying a reason rather than a bare name", () => {
    const script = readFileSync("scripts/writer-audit.mjs", "utf8");
    const allowlist = script.slice(script.indexOf("const ALLOWLIST"), script.indexOf("/* ─── Walk"));
    // Same discipline as rls-audit: an entry without a sentence is a silenced finding.
    for (const m of allowlist.matchAll(/\["([a-z_.]+)",\s*"([^"]*)"\]/g)) {
      expect(m[2]!.length, `allowlist entry ${m[1]} needs a reason`).toBeGreaterThan(30);
    }
    expect(run(process.cwd()).code).toBe(0);
  }, 30_000);
});
