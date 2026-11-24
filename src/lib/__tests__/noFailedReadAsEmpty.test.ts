import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * A SCREEN MAY NOT TURN A FAILED READ INTO AN EMPTY ONE (2026-11-23).
 *
 * `fetch(url).then((r) => (r.ok ? r.json() : { review: null }))` answers a server error with exactly what "none yet"
 * looks like. Swept on 2026-11-23, that one shape had a coaching tab offering a PAID re-run of a review that existed,
 * a door goal form that wiped a saved value on save, "not enrolled" for an enrolled rep, and more. Every instance was
 * replaced with an explicit failed state; this keeps the shape from coming back. A route that answers "none" does so
 * with 200 + an empty value; a non-OK response is a failure and must be treated as one.
 */
const PATTERN = /r\.ok \? r\.json\(\) : \{[^}]*(null|\[\]|false)/;

/**
 * Deliberate fallbacks, each with its reason. Macro Mode off = the FULL module, which is always safe: a failed read can
 * only show more, never hide anything or invite a wrong action (the Remote Sales switch does the same, tested in
 * RemoteMacroToggle.render.test.tsx). Anything else must not be added here without a reason as strong.
 */
const ALLOWED: Record<string, string> = {
  "src/components/sales-coach/SalesCoachShell.tsx": "Macro Mode read fails → full sidebar (safe default)",
  "src/app/dashboard/sales-coach/page.tsx": "Macro Mode read fails → full dashboard (safe default)",
};

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "__tests__" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("no failed read is presented as an empty one", () => {
  it("the pattern catches the shape that caused it", () => {
    expect(PATTERN.test(".then((r) => (r.ok ? r.json() : { review: null }))")).toBe(true);
    expect(PATTERN.test(".then((r) => (r.ok ? r.json() : { drafts: [] }))")).toBe(true);
    expect(PATTERN.test(".then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))")).toBe(false);
  });

  it("no screen has it", () => {
    const root = process.cwd();
    const hits: string[] = [];
    for (const dir of ["src/components", "src/app"]) {
      for (const f of files(join(root, dir))) {
        readFileSync(f, "utf8").split("\n").forEach((line, i) => {
          const rel = relative(root, f);
          if (PATTERN.test(line) && !(rel in ALLOWED && /macro-mode|enabled: false/.test(line))) hits.push(`${rel}:${i + 1}`);
        });
      }
    }
    expect(hits).toEqual([]);
  });
});

/**
 * THE NULL FORM (2026-11-23, second sweep). `r.ok ? r.json() : null` escaped the pattern above (it maps to null, not to
 * { x: null }) and hid the same failure: a rep with points read "No coached pitches yet", a manager's Assign picker and
 * "Whose pipeline" list were silently empty. Those were fixed. What remains are reads that only LABEL something already
 * on screen (names on chips, a first name in a greeting, the voice badge's "unknown") — a failure there shows less
 * decoration, never a false "none". Each is listed by file and count; a new one anywhere fails.
 */
const NULL_PATTERN = /r\.ok \? r\.json\(\) : null\)/g;
const NULL_ALLOWED: Record<string, [number, string]> = {
  "src/components/sales-coach/CoachingInbox.tsx": [1, "team names on inbox rows; ids still show"],
  "src/components/sales-coach/RecordingsTab.tsx": [1, "share-with name suggestions"],
  "src/components/sales-coach/StartSessionPanel.tsx": [1, "voice badge: a failure reads as 'unknown' (null), not 'not enrolled'"],
  "src/components/sales-coach/RepArena.tsx": [1, "leaderboard rank only; the points read above it fails loud"],
  "src/components/remote-sales/RemoteToday.tsx": [1, "first name in the greeting"],
  "src/components/remote-sales/RemoteCallComments.tsx": [1, "@mention name suggestions"],
  "src/components/sales-coach/RemoteCallPanel.tsx": [1, "library folder-name suggestions (2026-11-25); the field still takes any name typed"],
  "src/app/dashboard/sales-coach/analytics/page.tsx": [1, "the next line turns null into setSkillsError(true) — the failure IS shown"],
};

describe("the null form of a failed read", () => {
  it("the pattern catches it", () => {
    expect(".then((r) => (r.ok ? r.json() : null))".match(NULL_PATTERN)?.length).toBe(1);
  });
  it("only label reads keep it, each counted", () => {
    const root = process.cwd();
    const bad: string[] = [];
    for (const dir of ["src/components", "src/app"]) {
      for (const f of files(join(root, dir))) {
        const rel = relative(root, f);
        const n = (readFileSync(f, "utf8").match(NULL_PATTERN) ?? []).length;
        const allowed = NULL_ALLOWED[rel]?.[0] ?? 0;
        if (n !== allowed) bad.push(`${rel}: ${n} (allowed ${allowed})`);
      }
    }
    // Also fails when an allowance is spare (a fixed file must have its entry removed).
    for (const rel of Object.keys(NULL_ALLOWED)) {
      try {
        statSync(join(root, rel));
      } catch {
        bad.push(`${rel}: listed but missing`);
      }
    }
    expect(bad).toEqual([]);
  });
});

/**
 * THE ELSE FORM (2026-11-23, third sweep). `if (res && res.ok) setList(...); else setList([]);` — a failed response set
 * to the same empty list a real "none" gives. Both team-password dialogs did it ("No team password yet — create one",
 * inviting a duplicate). Caught here: an `else` that sets an empty list/zero/false within a few lines after an `.ok`
 * check. A failure must set a failed state instead.
 */
export function elseEmptyAfterOk(src: string): number {
  let n = 0;
  for (const m of src.matchAll(/else\s+set\w+\(\s*(\[\]|0|false)\s*\)/g)) {
    const before = src.slice(Math.max(0, (m.index ?? 0) - 300), m.index);
    if (/\.ok\b/.test(before)) n++;
  }
  return n;
}

describe("the else form of a failed read", () => {
  it("catches the dialogs' old shape, not an unrelated reset", () => {
    expect(elseEmptyAfterOk(`if (res && res.ok) setList((await res.json()).passwords ?? []);\n    else setList([]);`)).toBe(1);
    expect(elseEmptyAfterOk(`if (res && res.ok) {\n  const d = await res.json();\n  setPasswords(d.passwords);\n} else setPasswords([]);`)).toBe(1);
    expect(elseEmptyAfterOk(`useEffect(() => { if (sel) void loadLines(sel); else setLines([]); }, [sel]);`)).toBe(0);
  });
  it("no screen has it", () => {
    const root = process.cwd();
    const hits: string[] = [];
    for (const dir of ["src/components", "src/app"]) {
      for (const f of files(join(root, dir))) {
        const n = elseEmptyAfterOk(readFileSync(f, "utf8"));
        if (n) hits.push(`${relative(root, f)}: ${n}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
