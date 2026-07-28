// scripts/tbc/lib.mjs
// Shared helpers for the TBC gates.
//
// Design rule (THINK_BUILD_CHECK.md §6.7): a gate must be QUIET to be HEEDED.
// Every failure below must be actionable and attributable to a specific spec
// clause. Anything that cannot be detected precisely is NOT checked here —
// per A33, we name the hole rather than ship a noisy detector.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";

export const REPO = resolve(process.env.TBC_REPO ?? ".");
export const TBC_DIR = join(REPO, "docs", "tbc");
export const AMD_DIR = join(REPO, "docs", "amendments");
export const MANIFEST_PATH = join(TBC_DIR, "DOC_MANIFEST.json");

// ---------------------------------------------------------------- reporting

export class Report {
  constructor(gate) {
    this.gate = gate;
    this.failures = [];
    this.notes = [];
  }
  fail(clause, message, detail) {
    this.failures.push({ clause, message, detail });
  }
  note(message) {
    this.notes.push(message);
  }
  finish() {
    for (const n of this.notes) console.log(`  · ${n}`);
    if (this.failures.length === 0) {
      console.log(`✓ ${this.gate}`);
      return 0;
    }
    console.error(`✗ ${this.gate} — ${this.failures.length} failure(s)\n`);
    for (const f of this.failures) {
      console.error(`  [${f.clause}] ${f.message}`);
      if (f.detail) {
        for (const line of String(f.detail).split("\n")) {
          console.error(`      ${line}`);
        }
      }
      console.error("");
    }
    return 1;
  }
}

export function run(gate, fn) {
  const report = new Report(gate);
  try {
    fn(report);
  } catch (err) {
    report.fail("gate-error", `${gate} threw — the gate itself is broken`, err.stack);
  }
  process.exit(report.finish());
}

// ---------------------------------------------------------------- fs helpers

export function read(path) {
  return readFileSync(path, "utf8");
}

export function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function exists(p) {
  return existsSync(p);
}

export function readJSON(path) {
  try {
    return JSON.parse(read(path));
  } catch (err) {
    throw new Error(`${path} is not valid JSON: ${err.message}`);
  }
}

// ---------------------------------------------------------------- tbc dirs

/**
 * The build directory under inspection.
 *
 * Resolution order:
 *   1. TBC_BUILD env var (explicit — used by CI and by the hook)
 *   2. the lexically-greatest directory under docs/tbc (dirs are date-prefixed)
 *
 * Returns null when no build directory exists, which callers interpret
 * according to whether the change triggers TBC at all.
 */
export function currentBuildDir() {
  if (process.env.TBC_BUILD) {
    const p = join(TBC_DIR, process.env.TBC_BUILD);
    return exists(p) ? p : null;
  }
  if (!exists(TBC_DIR)) return null;
  const dirs = readdirSync(TBC_DIR)
    .filter((d) => statSync(join(TBC_DIR, d)).isDirectory())
    .sort();
  return dirs.length ? join(TBC_DIR, dirs[dirs.length - 1]) : null;
}

/**
 * Repo-relative, POSIX-style path for human-readable labels.
 *
 * currentBuildDir()/join() return NATIVE paths (backslashes on Windows), so a
 * bare `p.replace(REPO + "/", "")` or `p.split("/")` silently no-ops there and
 * leaks the absolute path into a failure message. This chokepoint is the one
 * place the separator invariant holds — every label goes through it, so the
 * class cannot recur site-by-site (A30 chokepoint; TBC install finding F1).
 */
export function repoRel(p) {
  return String(p).replace(REPO, "").replace(/^[\\/]+/, "").replace(/\\/g, "/");
}

// ---------------------------------------------------------------- git

export function git(cmd, fallback = "") {
  try {
    return execSync(`git ${cmd}`, { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return fallback;
  }
}

/**
 * Commit messages belonging to this session.
 *
 * TBC_BASE lets CI pass an explicit merge-base. Default is the commits not on
 * the default branch, which is the right scope for a feature branch and
 * degrades to empty on a fresh repo rather than throwing.
 */
export function sessionCommitMessages() {
  const base = process.env.TBC_BASE ?? "origin/main";
  const log = git(`log ${base}..HEAD --pretty=%B`, "");
  return log;
}

export function stagedFiles() {
  return git("diff --cached --name-only", "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------- citations

// §A / §3.1 style references. Requires the section sign for BOTH forms —
// "§A26", "§1.5.1", "§6" — matching the established scripts/hooks/commit-msg
// convention (which uses §A[0-9]+). Bare "A26"/"A4" is NOT treated as a
// citation (F2 fix, AMD-008 install / 2026-07-28-regex-fix-f2-citation): the
// prior bare-"A<n>" alternation fired on ordinary prose — "A4 paper", "A100
// GPU", "Figure A3", "grade A1" — a noisy-gate false positive (A33), and it
// disagreed with the commit-msg hook on the same concept (A21). Minimum-set
// enforcement is keyed on DECLARED ids, not extraction, so it is unaffected.
const CITATION_RE = /§\s?(A\d{1,3}|\d+(?:\.\d+){0,2})\b/g;

export function extractCitations(text) {
  const out = new Set();
  for (const m of text.matchAll(CITATION_RE)) {
    const id = (m[1] ?? m[2] ?? "").trim();
    if (id) out.add(id.startsWith("A") ? id : `§${id}`);
  }
  return out;
}

/** Normalise "§A26" / "A26" / "§1.5.1" to a comparable key. */
export function normaliseId(id) {
  const s = String(id).replace(/^§\s?/, "").trim();
  return /^A\d/i.test(s) ? s.toUpperCase() : `§${s}`;
}

// ---------------------------------------------------------------- frontmatter

export function frontMatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const out = {};
  let currentKey = null;
  for (const raw of m[1].split("\n")) {
    if (!raw.trim()) continue;
    const nested = raw.match(/^\s+([\w.\-]+):\s*(.*)$/);
    if (nested && currentKey) {
      out[currentKey] = out[currentKey] && typeof out[currentKey] === "object" ? out[currentKey] : {};
      out[currentKey][nested[1]] = nested[2].trim();
      continue;
    }
    const top = raw.match(/^([\w.\-]+):\s*(.*)$/);
    if (top) {
      currentKey = top[1];
      out[currentKey] = top[2].trim();
    }
  }
  return out;
}

/** Pull fenced ```json blocks out of a markdown document. */
export function jsonBlocks(md) {
  const out = [];
  for (const m of md.matchAll(/```json\s*\n([\s\S]*?)```/g)) {
    try {
      out.push(JSON.parse(m[1]));
    } catch {
      /* malformed blocks are reported by the caller that needs them */
    }
  }
  return out;
}

/** Raw fenced json blocks including the ones that fail to parse. */
export function rawJsonBlocks(md) {
  return [...md.matchAll(/```json\s*\n([\s\S]*?)```/g)].map((m) => m[1]);
}

// ---------------------------------------------------------------- allowlist

/**
 * §6.7: every allowlisted exception carries its reason inline. A bare path
 * list is a disabled check. This loader REJECTS entries without a reason.
 */
export function loadAllowlist(gate) {
  const p = join(TBC_DIR, "ALLOWLIST.json");
  if (!exists(p)) return [];
  const all = readJSON(p);
  const entries = all[gate] ?? [];
  for (const e of entries) {
    if (!e.reason || String(e.reason).trim().length < 20) {
      throw new Error(
        `ALLOWLIST.json → ${gate} → "${e.pattern ?? e.id ?? "?"}" has no substantive reason. ` +
          `§6.7: a bare path list records that someone silenced the check, not that it was safe to.`
      );
    }
  }
  return entries;
}
