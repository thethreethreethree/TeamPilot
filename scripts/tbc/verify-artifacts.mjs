#!/usr/bin/env node
// scripts/tbc/verify-artifacts.mjs
//
// SPEC: THINK_BUILD_CHECK.md §6.3
//   Fails when: any phase artifact is missing for a triggering change; any
//   feature in build.md lacks write-path/read-path assertions; any use of
//   "verified"/"green"/"passing" is not adjacent to a pasted canonical-command
//   output with an exit code; any finding in check.md lacks class, sweep
//   command, or severity; any fix lacks a gate-or-promise answer.

import { join } from "node:path";
import { exists, read, run, currentBuildDir, frontMatter, repoRel, loadAllowlist } from "./lib.mjs";

// A38: the assurance vocabulary. Each use must sit next to a pasted command
// output carrying an exit code.
const ASSURANCE = /\b(verified|green|passing|gates? pass|all checks? pass)\b/gi;
const EXIT_CODE = /\b(exit(?:\s+code)?[:= ]\s*\d+|\$\?\s*=\s*\d+|exited with \d+)\b/i;
// F3 tighten (2026-07-28): the single ambiguous words (verified/green/passing) also
// occur in ordinary prose — "a passing mention", "verified users", "turned green" — so
// they count as a verification CLAIM only when a verdict-context token sits within ~60
// chars. The multi-word verdicts ("gates pass", "all checks pass") are unambiguous and
// always count. This removes the A33 noise that trains people to skip the gate, without
// dropping a real claim (which always names the command/gate/test it is a verdict about).
const VERDICT_CONTEXT = /\b(gates?|checks?|tests?|builds?|ci|lint|typecheck|vitest|eslint|tsc|suite|pipeline|npm run|exit|tbc|audit|invariant)\b/i;

const PHASE_FILES = {
  think: { file: "think.md", always: true },
  build: { file: "build.md", always: true },
  check: { file: "check.md", always: true },
  remediate: { file: "remediate.md", always: false }, // omit if no findings
  closure: { file: "closure.md", always: true },
};

run("tbc:artifacts", (r) => {
  const dir = currentBuildDir();
  if (!dir) {
    r.fail("§3", "No build directory under docs/tbc/.");
    return;
  }
  const rel = repoRel(dir);
  r.note(`build: ${rel}`);

  const allowFiles = loadAllowlist("artifacts").map((a) => a.pattern);

  // ---- 1. phase artifacts present ---------------------------------------
  const present = {};
  for (const [phase, spec] of Object.entries(PHASE_FILES)) {
    const p = join(dir, spec.file);
    present[phase] = exists(p);
    if (spec.always && !present[phase]) {
      r.fail("§3", `${spec.file} is missing.`, `Expected at ${rel}/${spec.file}`);
    }
  }
  if (!present.build || !present.check) return;

  const build = read(join(dir, "build.md"));
  const check = read(join(dir, "check.md"));
  const closure = present.closure ? read(join(dir, "closure.md")) : "";

  // ---- 2. build.md front-matter + reachability ---------------------------
  const fm = frontMatter(read(join(dir, "think.md")));
  const trigger = fm?.trigger ?? "";

  // A31: schema-complete is not built. Every feature claims BOTH paths.
  const features = [...build.matchAll(/^###\s+(.+)$/gm)].map((m) => m[1].trim());
  if (features.length === 0) {
    r.fail("§3.2", "build.md declares no features (expected '### <name>' entries).",
      "The inventory is what the reachability assertions attach to.");
  }
  for (const f of features) {
    const section = sectionFor(build, f);
    const hasWrite = /write[-_ ]path\s*:/i.test(section);
    const hasRead = /read[-_ ]path\s*:/i.test(section);
    if (!hasWrite || !hasRead) {
      r.fail("§3.2 / A31",
        `build.md → "${f}" lacks ${!hasWrite ? "write-path" : ""}${!hasWrite && !hasRead ? " and " : ""}${!hasRead ? "read-path" : ""} assertion.`,
        "A31: the seam between the database and the surface is where a correct\n" +
        "system silently becomes a nonexistent feature. Both paths, asserted.");
    }
  }

  // ---- 3. A38 — assurance words need a pasted command output ------------
  for (const [name, text] of [["build.md", build], ["check.md", check], ["closure.md", closure]]) {
    if (!text) continue;
    if (allowFiles.includes(`${rel}/${name}`)) continue;
    for (const m of text.matchAll(ASSURANCE)) {
      // F3: a single ambiguous word is a verification claim only with nearby context.
      if (!/\s/.test(m[0])) {
        const ctx = text.slice(Math.max(0, m.index - 60), m.index + m[0].length + 60);
        if (!VERDICT_CONTEXT.test(ctx)) continue;
      }
      const window = text.slice(Math.max(0, m.index - 1200), m.index + 1200);
      const hasFence = /```/.test(window);
      const hasExit = EXIT_CODE.test(window);
      if (!hasFence || !hasExit) {
        r.fail("§5 / A38",
          `${name}: "${m[0]}" is not adjacent to a pasted command output with an exit code.`,
          context(text, m.index) + "\n\n" +
          "A38: \"verified\" is a claim about a COMMAND you ran. Paste the canonical\n" +
          "command's output and its exit code, or state coverage as n-of-n instead.");
      }
    }
  }

  // ---- 4. findings carry class, sweep command, severity ------------------
  const findings = splitFindings(check);
  if (findings.length === 0 && !/no findings/i.test(check)) {
    r.fail("§3.3", "check.md records neither findings nor an explicit 'no findings' statement.");
  }
  for (const f of findings) {
    if (!/(^|\n)\s*class\s*:/i.test(f.body)) {
      r.fail("§3.3 / A26", `check.md → "${f.title}" has no class.`,
        "A26: a reported bug is one instance of a class.");
    }
    if (!/(^|\n)\s*sweep(?:[-_ ]command)?\s*:/i.test(f.body)) {
      r.fail("§3.3 / A26", `check.md → "${f.title}" has no sweep command.`,
        "The boundary must be a command someone else can re-run.");
    }
    if (!/(^|\n)\s*severity\s*:\s*(critical|high|medium|low)/i.test(f.body)) {
      r.fail("§3.3", `check.md → "${f.title}" has no severity (critical|high|medium|low).`);
    }
  }

  // ---- 5. every fix answers gate-or-promise -----------------------------
  const remediate = present.remediate ? read(join(dir, "remediate.md")) : "";
  if (findings.length > 0 && !present.remediate) {
    r.fail("§3.4", "check.md records findings but remediate.md is absent.",
      "remediate.md is omitted only when there are no findings.");
  }
  if (remediate) {
    const fixes = splitFindings(remediate);
    for (const f of fixes) {
      if (!/(^|\n)\s*gate[-_ ]or[-_ ]promise\s*:\s*(gate|promise|declined)/i.test(f.body)) {
        r.fail("§3.4 / A30",
          `remediate.md → "${f.title}" does not answer gate-or-promise.`,
          "A30: a fix is not complete until the class is encoded in a gate that\n" +
          "fails without the author's cooperation — or the gate is explicitly\n" +
          "declined per A33, with the hole named.");
      }
    }
  }
});

// ---------------------------------------------------------------- helpers

function sectionFor(md, heading) {
  const lines = md.split("\n");
  const start = lines.findIndex((l) => l.trim() === `### ${heading}`);
  if (start === -1) return "";
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{1,3}\s/.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start, end).join("\n");
}

function splitFindings(md) {
  const out = [];
  const lines = md.split("\n");
  let cur = null;
  for (const l of lines) {
    const h = l.match(/^###\s+(.+)$/);
    if (h) {
      if (cur) out.push(cur);
      cur = { title: h[1].trim(), body: "" };
    } else if (cur) {
      cur.body += l + "\n";
    }
  }
  if (cur) out.push(cur);
  return out;
}

function context(text, index) {
  const line = text.slice(0, index).split("\n").length;
  const src = text.split("\n")[line - 1] ?? "";
  return `  line ${line}: ${src.trim().slice(0, 120)}`;
}
