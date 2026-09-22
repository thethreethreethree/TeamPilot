import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Tests for the enum-mirror audit.
 *
 * The audit is opt-in, so the risk is not noise — it is silence. A marker that never matches, a
 * parser that sees fewer values than the migration declares, or a regex that quietly finds
 * nothing all produce the same green line. That already happened once during the build: a
 * line-by-line parser read `manager_notifications.type` as a TWO-value set, because every
 * extension since 0242 formats its list across several lines, and it reported four correctly
 * handled values as "not in the database".
 *
 * So these build throwaway trees and assert the verdict on each, and the first one is the exact
 * defect this audit exists for.
 */

const run = (cwd: string) => {
  try {
    const out = execFileSync("node", [join(process.cwd(), "scripts/enum-coverage-audit.mjs")], {
      cwd,
      encoding: "utf8",
    });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status: number; stdout: string };
    return { code: err.status, out: err.stdout };
  }
};

function fixture(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "enum-audit-"));
  mkdirSync(join(dir, "supabase/migrations"), { recursive: true });
  mkdirSync(join(dir, "src"), { recursive: true });
  for (const [path, body] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, body, "utf8");
  }
  return dir;
}

const clean = (dir: string) => rmSync(dir, { recursive: true, force: true });

describe("the defect this exists for", () => {
  it("FAILS when the database has a value the declared mirror does not name", () => {
    // The bell, exactly: a union of three, a CHECK of six, and a value that would reach the
    // switch and fall through to a sentence about somebody else's closed deal.
    const dir = fixture({
      "supabase/migrations/0001.sql": `
        create table if not exists manager_notifications (
          type text not null check (type in ('strong_session', 'deal_closed', 'recording_comment'))
        );
      `,
      "src/bell.ts": `
        // enum-source: manager_notifications.type
        type N = "strong_session" | "deal_closed";
      `,
    });
    const { code, out } = run(dir);
    expect(code).toBe(1);
    expect(out).toMatch(/MISSING: recording_comment/);
    clean(dir);
  });

  it("passes when the mirror is complete", () => {
    const dir = fixture({
      "supabase/migrations/0001.sql": `
        create table if not exists t (type text check (type in ('a_one', 'b_two')));
      `,
      "src/x.ts": `
        // enum-source: t.type
        type N = "a_one" | "b_two";
      `,
    });
    expect(run(dir).code).toBe(0);
    clean(dir);
  });

  it("also FAILS on a value the union invents that the database cannot produce", () => {
    // The less obvious half. A member the database will never emit is dead code that reads as a
    // handled case, and it is what survives when a later migration NARROWS the CHECK.
    const dir = fixture({
      "supabase/migrations/0001.sql": `
        create table if not exists t (type text check (type in ('a_one', 'b_two')));
      `,
      "src/x.ts": `
        // enum-source: t.type
        type N = "a_one" | "b_two" | "c_three";
      `,
    });
    const { code, out } = run(dir);
    expect(code).toBe(1);
    expect(out).toMatch(/NOT IN THE DATABASE: c_three/);
    clean(dir);
  });

  it("FAILS on a marker naming a constraint that does not exist", () => {
    // A typo in the marker would otherwise make the audit silently skip the one thing it was
    // pointed at, which is the failure mode of every opt-in check.
    const dir = fixture({
      "supabase/migrations/0001.sql": `create table if not exists t (type text check (type in ('a_one','b_two')));`,
      "src/x.ts": `
        // enum-source: t.typo
        type N = "a_one" | "b_two";
      `,
    });
    const { code, out } = run(dir);
    expect(code).toBe(1);
    expect(out).toMatch(/no CHECK constraint named t\.typo exists/);
    clean(dir);
  });
});

describe("the parser must see everything the migration declares", () => {
  it("reads a CHECK list that spans several lines", () => {
    // THE BUG FOUND DURING THE BUILD. 0242 writes its list on one line and every extension since
    // formats one value per line. A line-scanner saw the old form and none of the new ones, then
    // called four correctly handled values invented.
    const dir = fixture({
      "supabase/migrations/0001.sql": `
        alter table manager_notifications
          add constraint manager_notifications_type_check
          check (type in (
            'strong_session',
            'deal_closed',
            'pattern_coached'
          ));
      `,
      "src/x.ts": `
        // enum-source: manager_notifications.type
        type N = "strong_session" | "deal_closed" | "pattern_coached";
      `,
    });
    expect(run(dir).code).toBe(0);
    clean(dir);
  });

  it("takes the LAST definition when a constraint is dropped and re-added", () => {
    // A migration that re-adds a constraint is REPLACING it. Treating them as cumulative would
    // keep a value a later migration deliberately removed, and then demand a branch for it.
    const dir = fixture({
      "supabase/migrations/0001.sql": `
        create table if not exists t (type text check (type in ('a_one','b_two','gone_now')));
      `,
      "supabase/migrations/0002.sql": `
        alter table t drop constraint if exists t_type_check;
        alter table t add constraint t_type_check check (type in ('a_one','b_two'));
      `,
      "src/x.ts": `
        // enum-source: t.type
        type N = "a_one" | "b_two";
      `,
    });
    expect(run(dir).code).toBe(0);
    clean(dir);
  });

  it("does not parse `alter table if exists` as a table called \"if\"", () => {
    // The 0022 trap: an optional group that fails to match lets the next token be captured.
    const dir = fixture({
      "supabase/migrations/0001.sql": `
        alter table if exists public.coaching_sessions
          add column if not exists outcome text check (outcome in ('won','lost','no_decision'));
      `,
      "src/x.ts": `
        // enum-source: coaching_sessions.outcome
        type N = "won" | "lost" | "no_decision";
      `,
    });
    expect(run(dir).code).toBe(0);
    clean(dir);
  });

  it("ignores a CHECK list that only appears in a SQL comment", () => {
    // ORDER MATTERS IN THIS FIXTURE, and the first version got it wrong. With the comment BEFORE
    // the real definition, last-definition-wins overwrites the phantom and the test passes even
    // with comment-stripping removed — it proved nothing. Found by mutation. The comment goes
    // AFTER, which is also the realistic case: a migration documenting the set it just replaced.
    const dir = fixture({
      "supabase/migrations/0001.sql": `
        create table if not exists t (type text check (type in ('a_one','b_two')));
        -- superseded 2026-01: check (type in ('old_one','old_two','old_three'))
      `,
      "src/x.ts": `
        // enum-source: t.type
        type N = "a_one" | "b_two";
      `,
    });
    expect(run(dir).code).toBe(0);
    clean(dir);
  });

  it("ignores a list inside a block comment too", () => {
    const dir = fixture({
      "supabase/migrations/0001.sql": `
        create table if not exists t (type text check (type in ('a_one','b_two')));
        /* history: check (type in ('old_one','old_two')) */
      `,
      "src/x.ts": `
        // enum-source: t.type
        type N = "a_one" | "b_two";
      `,
    });
    expect(run(dir).code).toBe(0);
    clean(dir);
  });
});

describe("opt-in means silent where unused", () => {
  it("passes a schema full of enums that nothing declares a mirror for", () => {
    // The whole reason this shape was chosen over inference: the inferred version was measured
    // four times against 99 sets and every version produced false positives from a different
    // cause, the last three being CORRECT state-transition routes.
    const dir = fixture({
      "supabase/migrations/0001.sql": `
        create table if not exists a (s text check (s in ('x_one','y_two')));
        create table if not exists b (s text check (s in ('p_one','q_two','r_three')));
      `,
      "src/x.ts": `const s = "x_one"; const t = "p_one";`,
    });
    const { code, out } = run(dir);
    expect(code).toBe(0);
    expect(out).toMatch(/Declared mirrors:\s+0/);
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
  it("passes, and the bell's mirror is actually declared", () => {
    // An opt-in audit with zero mirrors is a green light with extra steps. The count is the proof
    // that something is being checked at all.
    const { code, out } = run(process.cwd());
    expect(code).toBe(0);
    expect(out).not.toMatch(/Declared mirrors:\s+0/);
    const bell = readFileSync("src/components/sales-coach/NotificationBell.tsx", "utf8");
    expect(bell).toMatch(/enum-source:\s*manager_notifications\.type/);
  }, 30_000);
});
