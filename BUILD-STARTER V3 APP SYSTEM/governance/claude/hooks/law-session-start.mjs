#!/usr/bin/env node
/**
 * SessionStart hook — establishes the law, and the FACTS, at the top of every
 * session, including one resumed after compaction.
 *
 * Two jobs, and the second is the one that matters:
 *
 *   1. Say what governs, and that the gates are real rather than advisory.
 *   2. Report the ANTI-FAULT tripwire's verdict, unrun and unfiltered.
 *
 * On (2), read 03-ANTI-FAULT carefully: build-guard.mjs is "a measurement, NOT a
 * gate ... a human's smoke alarm." Running it at session start and REPORTING the
 * verdict is exactly what the file asks for under autonomous mode. Wiring it as
 * something that blocks would be the disease it treats (rule 3), so this hook
 * cannot fail a session under any verdict — 🔴 RED is printed, never enforced.
 *
 * Facts beat instructions. A session that opens with "53% of your recent commits
 * touched no product code" corrects behaviour in a way that re-reading a rule
 * about bureaucracy does not.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const PROJECT = process.env.CLAUDE_PROJECT_DIR || process.cwd();

const exists = (p) => {
  try {
    return fs.existsSync(path.join(PROJECT, p));
  } catch {
    return false;
  }
};

// Only speak in projects this layer actually governs. A hook that announces
// itself in an unrelated repo is noise, and noise gets ignored.
if (!exists(".claude/hooks/law-read-gate.mjs")) process.exit(0);

const lines = [];

/* -------------------------------------------------------------- the law */

const LAW = ["01-CONSTITUTION.md", "03-ANTI-FAULT.md"];
const KIT = "BUILD-STARTER V3 APP SYSTEM";

for (const name of LAW) {
  const where = [name, path.join(KIT, name)].find(exists);
  lines.push(
    where
      ? `LAW: ${name} is in the tree at ./${where.replace(/\\/g, "/")} — read it before your first build action.`
      : `LAW: ${name} is MISSING from the working tree. This is the §0.1 / A19 precondition failure. ` +
          `Product writes are BLOCKED. Escalate to the owner; do not reconstruct it from memory.`
  );
}

/* ------------------------------------------------ anti-fault tripwire */

const guard = [
  path.join(PROJECT, "anti-fault", "build-guard.mjs"),
  path.join(PROJECT, KIT, "anti-fault", "build-guard.mjs"),
].find((p) => {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
});

if (guard) {
  const res = spawnSync(process.execPath, [guard], {
    cwd: PROJECT,
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: 4 * 1024 * 1024,
  });
  const out = String(res.stdout || "");
  const verdict = out.match(/^(🔴 RED|🟡 YELLOW|🟢 GREEN).*$/m);
  const stat = out.match(/product-touching commits\s*:.*$/m);
  if (verdict) {
    lines.push(`ANTI-FAULT: ${verdict[0].trim()}`);
    if (stat) lines.push(`            ${stat[0].trim()}`);
    if (/RED/.test(verdict[0])) {
      lines.push(
        `            Treat RED as the owner saying "stop building process". Pivot to product and say so.`
      );
    }
  } else if (/not a git repo|no commits/i.test(out + res.stderr)) {
    lines.push("ANTI-FAULT: no git history yet — tripwire has nothing to measure.");
  }
} else {
  lines.push("ANTI-FAULT: build-guard.mjs not found; drift is unmeasured this session.");
}

/* ----------------------------------------------------------- output */

const context = `
<governing-law>
This project is governed by BUILD STARTER V3. The order of authority is
LAW (01-CONSTITUTION.md, 03-ANTI-FAULT.md) > METHOD (BUILD STRUCTURE PLAN/) >
DESIGN LAW (design-system/) > CODE. When two layers conflict the higher one
wins; when they GENUINELY conflict, stop and tell the owner rather than picking.

${lines.join("\n")}

Enforced by hooks, not by trust:
  - Writes to 00/01/03, tools/ and .claude/hooks/ are DENIED. You do not amend
    the rules you are under. If a rule is wrong, say so and keep building under it.
  - Product-code writes are BLOCKED until you have READ 01-CONSTITUTION.md and
    03-ANTI-FAULT.md in THIS session. Cached labels are not reading (§0.1, A19, A22).

Before your first build action, run the Governing Protocol (00-START-HERE §2):
  1. Read the governing files in this session. 2. Quote the clauses that govern
  this task, AMD-006 included. 3. Restate the task in your own words and confirm
  it. 4. Surface every ambiguity and conflict — never resolve one silently.
  5. Build to the spec as written.
</governing-law>`.trim();

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: context,
    },
  })
);
process.exit(0);
