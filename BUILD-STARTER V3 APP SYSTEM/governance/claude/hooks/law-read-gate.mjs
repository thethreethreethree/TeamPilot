#!/usr/bin/env node
/**
 * PreToolUse gate — the only two rules the agent cannot talk its way past.
 *
 *   GATE 1  TAMPER LOCK. No write, by any tool, to the governing law
 *           (00-START-HERE.md, 01-CONSTITUTION.md, 03-ANTI-FAULT.md), to the
 *           enforcement machinery (tools/, .claude/hooks/, .claude/settings.json),
 *           or to this governance kit. 03-ANTI-FAULT rule 1: "an agent that can
 *           rewrite its own rules under pressure will — and it will always
 *           rewrite them toward more process." The real record: a build amended
 *           its own constitution SEVEN times mid-flight (AMD-007 → AMD-013) and
 *           grew its asset library from A22 to A40.
 *
 *           settings.json `permissions.deny` already refuses Write/Edit on those
 *           paths. This hook exists because deny does not watch Bash, and
 *           08-LESSONS Shape 7 is explicit: "never route around a guard by using
 *           a tool it does not watch." A `sed -i` or a `>>` reaches the same file.
 *
 *   GATE 2  SESSION-READ GATE. No write to PRODUCT code until 01-CONSTITUTION.md
 *           and 03-ANTI-FAULT.md have actually been read IN THIS SESSION, as
 *           recorded by law-read-record.mjs.
 *
 *           This is constitution §0.1 (the precondition gate CAT-001 forced into
 *           existence), A19 (methodology in the working tree) and A22 (read in
 *           session, not cited from cached labels) made mechanical. A19 had been
 *           in the tree for three days when A22 was captured for violating it —
 *           the rule was known, understood, and skipped anyway, because citation
 *           runs at the speed of language and reading runs at the speed of
 *           attention. A mental check cannot close that gap. An exit code can.
 *
 * ESCAPE. Gate 2 is not a trap: the agent clears it by doing the thing the
 * constitution already required — reading two files. There is no cap and none is
 * needed, because unlike a failing build gate the remedy is always available.
 *
 * CONTRACT. This hook must never crash a session. Every unexpected error fails
 * OPEN (exit 0) — a broken guard that blocks all writes is worse than a missed
 * violation, which is the same contract the design-system's pre-write-guard
 * holds and the reason it survived its own audit.
 *
 * Exit 2 blocks the tool call; stderr is fed back to the agent, so the message
 * below is written for the agent to ACT on, not for a human to admire.
 */

import fs from "node:fs";
import path from "node:path";

const PROJECT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const STATE_DIR = path.join(PROJECT, ".governance");

/** Read in-session before product code may be written. 00-START-HERE is
 *  recorded but NOT required — it is the operating manual, not the law. */
const REQUIRED = ["01-CONSTITUTION.md", "03-ANTI-FAULT.md"];

/** Never writable, by any tool, for any reason, without the owner lifting the
 *  deny in .claude/settings.json themselves.
 *
 *  Two lists, because a PATH and a COMMAND STRING are different shapes. These
 *  are `$`-anchored to match a real filesystem path; a shell command mentions the
 *  same file mid-string with a space in front of it, which no anchored pattern
 *  can see. That gap let `echo x >> 03-ANTI-FAULT.md` through the installer's own
 *  probe — exactly the Shape 7 route-around this gate exists to close — so
 *  GOVERNED_NAMES below handles the command case separately. */
const GOVERNED = [
  /(^|[\\/])00-START-HERE\.md$/i,
  /(^|[\\/])01-CONSTITUTION\.md$/i,
  /(^|[\\/])03-ANTI-FAULT\.md$/i,
  /(^|[\\/])\.claude[\\/]hooks[\\/]/i,
  /(^|[\\/])\.claude[\\/]settings\.json$/i,
  /(^|[\\/])tools[\\/].*\.mjs$/i,
  /(^|[\\/])tools[\\/]rules\.json$/i,
  /(^|[\\/])governance[\\/]/i,
];

/** The same set, unanchored, for matching inside a shell command string. */
const GOVERNED_NAMES =
  /(00-START-HERE\.md|01-CONSTITUTION\.md|03-ANTI-FAULT\.md|\.claude[\\/]hooks|\.claude[\\/]settings\.json|tools[\\/][\w.-]+\.mjs|tools[\\/]rules\.json|(^|[\s\\/])governance[\\/])/i;

/** Product code — what gate 2 protects. Everything else (notes, a contract, a
 *  scratch file) is free, because writing a document is not building a feature
 *  and gating it would be the bureaucracy 03-ANTI-FAULT forbids. */
const PRODUCT_EXT = /\.(tsx?|jsx?|mjs|cjs|css|swift|kt|java|sql)$/i;
const PRODUCT_DIR =
  /(^|[\\/])(app|src|screens|components|navigation|hooks|lib|constants|modules|assets|ios|android)[\\/]/i;

/** Exempt from gate 2: the design contract and the governance state itself.
 *  Blocking /design-intake from writing DESIGN-CONTRACT.md would deadlock the
 *  build sequence at Phase 1 for no gain. */
const EXEMPT = /(DESIGN-CONTRACT\.md|[\\/]\.governance[\\/]|[\\/]\.claude[\\/])/i;

const allow = () => process.exit(0);
function block(reason) {
  process.stderr.write(reason);
  process.exit(2);
}

let payload;
try {
  payload = JSON.parse(fs.readFileSync(0, "utf8") || "{}") || {};
} catch {
  allow();
}
if (typeof payload !== "object") allow();

const tool = payload.tool_name || "";
const input = payload.tool_input || {};
const sessionId = String(payload.session_id || "nosession");

/* ------------------------------------------------------------------ gate 1
 * Tamper lock. Checked for EVERY tool, including Bash, because the file-tool
 * deny list has a hole the shell walks straight through.
 */

const editedPaths = [];
if (input.file_path) editedPaths.push(String(input.file_path));
if (input.path) editedPaths.push(String(input.path));
if (input.notebook_path) editedPaths.push(String(input.notebook_path));

const command = String(input.command || "");

// A Bash call only counts as a WRITE if it looks like one. A `cat` or a `grep`
// over the constitution is exactly what gate 2 wants to encourage, so matching
// every mention of the filename would punish the compliant path.
//
// Two write shapes, checked differently so a legitimate read that happens to
// redirect its OUTPUT elsewhere is not caught:
//
//   REDIRECT   — only the destination side counts. `grep x 01-CONSTITUTION.md
//                > /tmp/out` reads the law and writes a temp file; that is fine.
//                `echo x >> 01-CONSTITUTION.md` is not.
//   IN-PLACE   — sed -i, tee, rm, mv, chmod and friends take their target as an
//                argument, so the whole command is the haystack.
const IN_PLACE =
  /(^|[\s;|&(])(sed\s+-i|perl\s+-i|tee|truncate|dd\b|install\b|patch\b|rm\b|mv\b|cp\b|chmod\b|chown\b)/i;

function bashTouchesGoverned(cmd) {
  if (IN_PLACE.test(cmd) && GOVERNED_NAMES.test(cmd)) return true;
  // Every redirect destination in the command, i.e. the text after each `>`.
  for (const m of cmd.matchAll(/>>?\s*([^\s;|&<>]+)/g)) {
    if (GOVERNED_NAMES.test(m[1])) return true;
  }
  return false;
}

if (tool === "Bash" && command && bashTouchesGoverned(command)) {
  {
    block(
      `BLOCKED by the governance layer — tamper lock (03-ANTI-FAULT rule 1).\n\n` +
        `This Bash command appears to WRITE to a governed path:\n\n` +
        `  ${command.slice(0, 300)}\n\n` +
        `The governing law (00/01/03), the enforcement hooks, and the gate tools\n` +
        `are read-only to you. Rule-making is a human decision BETWEEN builds,\n` +
        `never an agent activity DURING one. A real build amended its own\n` +
        `constitution seven times mid-flight and produced no product in 53% of\n` +
        `its commits.\n\n` +
        `If you believe a rule is wrong: SAY SO TO THE OWNER and keep building\n` +
        `under the current rule. If a gate tool is genuinely BROKEN (not merely\n` +
        `inconvenient), that repair is legitimate — but it is the owner's call,\n` +
        `it requires them to lift the deny in .claude/settings.json, and you must\n` +
        `then prove the gate still fails on deliberately broken input\n` +
        `(06-VERIFICATION §7, 08-LESSONS Shape 8).\n\n` +
        `Do not reach this path with another tool. That is Shape 7.`
    );
  }
}

for (const p of editedPaths) {
  const rel = path.isAbsolute(p) ? path.relative(PROJECT, p) : p;
  const hit = GOVERNED.find((re) => re.test(rel) || re.test(p));
  if (hit) {
    block(
      `BLOCKED by the governance layer — tamper lock (03-ANTI-FAULT rule 1).\n\n` +
        `  ${rel}\n\n` +
        `This file is LAW or the machinery that enforces it. You apply it; you\n` +
        `never edit, extend, "improve", or amend it. An agent that can rewrite its\n` +
        `own rules under pressure will, and it will always rewrite them toward\n` +
        `more process.\n\n` +
        `Correct move: state the problem to the owner in one sentence, with your\n` +
        `recommendation, and keep building under the rule as written.`
    );
  }
}

/* ------------------------------------------------------------------ gate 2
 * Session-read gate. Product writes only.
 */

if (!/^(Write|Edit|MultiEdit|NotebookEdit)$/.test(tool)) allow();

const target = editedPaths[0] || "";
if (!target) allow();
if (EXEMPT.test(target)) allow();

const relTarget = path.isAbsolute(target) ? path.relative(PROJECT, target) : target;
const isProduct = PRODUCT_EXT.test(relTarget) || PRODUCT_DIR.test(relTarget);
if (!isProduct) allow();

let read = {};
try {
  const state = JSON.parse(
    fs.readFileSync(path.join(STATE_DIR, `read-${sessionId}.json`), "utf8")
  );
  if (state && state.session === sessionId) read = state.read || {};
} catch {
  read = {};
}

const missing = REQUIRED.filter((name) => !read[name]);
if (!missing.length) allow();

// Where the law actually IS, so the block message can name a real path rather
// than send the agent hunting. A19: a reference that does not resolve is the
// failure, not the fix.
function locate(name) {
  const candidates = [
    path.join(PROJECT, name),
    path.join(PROJECT, "BUILD-STARTER V3 APP SYSTEM", name),
    path.join(PROJECT, "..", "BUILD-STARTER V3 APP SYSTEM", name),
  ];
  const found = candidates.find((c) => {
    try {
      return fs.existsSync(c);
    } catch {
      return false;
    }
  });
  return found ? path.relative(PROJECT, found) || name : null;
}

const located = missing.map((name) => [name, locate(name)]);
const absent = located.filter(([, where]) => !where).map(([name]) => name);

if (absent.length) {
  block(
    `BLOCKED by the governance layer — the law is not in the working tree.\n\n` +
      `Missing: ${absent.join(", ")}\n\n` +
      `Constitution §0.1 (added by AMD-005 after CAT-001) makes this a hard\n` +
      `precondition: "Understanding precedes solving" requires that the\n` +
      `methodology defining understanding for this work is in the agent's working\n` +
      `tree AT THE MOMENT OF ACTION. Citing labels from a document you cannot\n` +
      `open is the §5 knowledge-≠-intelligence failure, and it is forbidden.\n\n` +
      `Do NOT proceed by reconstruction from memory. ESCALATE to the owner:\n` +
      `"the methodology source for this domain is not in the working tree —\n` +
      ` should I retrieve it, or proceed under reduced confidence?"`
  );
}

block(
  `BLOCKED by the governance layer — session-read gate (§0.1 · A19 · A22).\n\n` +
    `You are about to write product code, but you have not opened the governing\n` +
    `law in THIS session:\n\n` +
    located.map(([name, where]) => `  ${name}   →  read: ${where}`).join("\n") +
    `\n\n` +
    `A19's third question is "have I read the relevant assets in the CURRENT\n` +
    `session — not relied on previously-cached labels?" A22 exists because that\n` +
    `question, asked mentally, did not take: the rule had been in the tree three\n` +
    `days when a build shipped ~3,800 LoC citing §A11, §A14, §A10 and §3.1 having\n` +
    `re-read exactly one of them. Citation moves at the speed of language;\n` +
    `reading moves at the speed of attention. This gate closes that gap.\n\n` +
    `Read the files above, then write this file again. That is the whole remedy —\n` +
    `there is no cap and no other route, and reading them was already required\n` +
    `before your first build action (00-START-HERE §2, step 1).`
);
