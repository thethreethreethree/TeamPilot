#!/usr/bin/env node
/**
 * PreToolUse guard — the only gate Claude cannot talk its way past.
 *
 * Fires before Write / Edit / MultiEdit. Lints the PROPOSED content, not the
 * file on disk, so a violation never lands in the first place.
 *
 * Exit 2 = block the tool call. stderr is shown to Claude, so the message is
 * written for Claude to act on, not for a human to read.
 *
 * Contract: this hook must never crash the session. Any unexpected error
 * fails OPEN (exit 0), because a broken guard blocking all writes is worse
 * than a missed violation.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const PROJECT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const TOOLS = path.join(PROJECT, "tools");
const LINT = path.join(TOOLS, "design-lint.mjs");

const UI_EXT = /\.(tsx|jsx|ts|js|css)$/i;
// Only these require a design contract before they may be written.
const NEEDS_CONTRACT = /\.(tsx|jsx|css)$/i;

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function block(reason) {
  process.stderr.write(reason);
  process.exit(2);
}

function allow() {
  process.exit(0);
}

let payload;
try {
  // JSON.parse("null") returns null WITHOUT throwing, so the catch is not
  // enough on its own — every downstream property access would then throw.
  payload = JSON.parse(readStdin() || "{}") || {};
} catch {
  allow();
}
if (typeof payload !== "object") allow();

const toolName = payload.tool_name || "";
const input = payload.tool_input || {};
const filePath = input.file_path || input.path || "";

if (!/^(Write|Edit|MultiEdit|NotebookEdit)$/.test(toolName)) allow();
if (!filePath) allow();

/* ---------------------------------------------------------------- gate 1
 * No UI code before a design contract exists. This is the single rule that
 * prevents every project converging on the same default look.
 */
const contractPath = path.join(PROJECT, "DESIGN-CONTRACT.md");
const isUi = UI_EXT.test(filePath);
const needsContract = NEEDS_CONTRACT.test(filePath);
const isContract = /DESIGN-CONTRACT\.md$/i.test(filePath);

if (needsContract && !isContract && !fs.existsSync(contractPath)) {
  block(
    `BLOCKED by the Master Design Guide Line (rule DS-025).\n\n` +
      `You are about to write UI code, but DESIGN-CONTRACT.md does not exist.\n` +
      `Without it there is no art direction and no token derivation, so this file\n` +
      `would be built on defaults — which is exactly the failure this system prevents.\n\n` +
      `Required next step:\n` +
      `  1. Run the /design-intake skill to interview the user and produce\n` +
      `     DESIGN-CONTRACT.md at the project root.\n` +
      `  2. Run: node tools/token-gen.mjs --theme theme.ts\n` +
      `     (App Edition. React Native cannot evaluate oklch(), so the generator\n` +
      `      emits resolved hex to theme.ts and the NativeWind config consumes it.\n` +
      `      --out app/globals.css is the LEGACY web target: gate G3 reads theme.ts,\n` +
      `      so CSS generated here is a file nothing loads and nothing checks.)\n` +
      `  3. Then write this file.\n\n` +
      `Do not create a placeholder contract to get past this gate. The contract\n` +
      `must reflect answers from the user.`
  );
}

/* ---------------------------------------------------------------- gate 2
 * Lint the proposed content itself.
 */
if (!isUi || !fs.existsSync(LINT)) allow();

// Reconstruct what the file will look like after this tool call.
let proposed = null;
if (toolName === "Write") {
  proposed = input.content ?? "";
} else if (toolName === "Edit") {
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  proposed =
    input.replace_all
      ? current.split(input.old_string).join(input.new_string ?? "")
      : current.replace(input.old_string ?? "", input.new_string ?? "");
} else if (toolName === "MultiEdit" && Array.isArray(input.edits)) {
  let current = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  for (const e of input.edits) {
    current = e.replace_all
      ? current.split(e.old_string).join(e.new_string ?? "")
      : current.replace(e.old_string ?? "", e.new_string ?? "");
  }
  proposed = current;
}

if (proposed == null) allow();

// Lint a temp copy that keeps the real extension and relative location, so
// path-scoped rules (excludes, allowIn) behave identically.
let tmpDir = null;
let result = null;
const relPath = path.relative(PROJECT, filePath) || path.basename(filePath);
try {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mdgl-"));

  // The relative path must be CONTAINED. An unguarded join lets a target
  // outside the project (or a deep project root) resolve onto a real absolute
  // path, where the write would clobber an unrelated file.
  const tmpFile = path.resolve(tmpDir, relPath);
  const safe = tmpFile.startsWith(path.resolve(tmpDir) + path.sep)
    ? tmpFile
    : path.join(tmpDir, path.basename(filePath));

  fs.mkdirSync(path.dirname(safe), { recursive: true });
  fs.writeFileSync(safe, proposed);

  result = spawnSync(process.execPath, [LINT, safe, "--json"], {
    encoding: "utf8",
    env: {
      ...process.env,
      // Lint root is the temp dir so `rel()` reproduces the real path shape…
      CLAUDE_PROJECT_DIR: tmpDir,
      // …but waivers must still come from the REAL contract, or a waiver an
      // agent adds has no effect here and the block becomes inescapable.
      MDGL_WAIVER_ROOT: PROJECT,
    },
    maxBuffer: 16 * 1024 * 1024,
  });
} catch {
  result = null;
} finally {
  if (tmpDir) {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

if (!result) allow();

let data;
try {
  data = JSON.parse(result.stdout || "{}");
} catch {
  allow();
}

const blocking = (data.blocking || []).filter((b) => b.rule !== "DS-025");
if (!blocking.length) allow();

const byRule = new Map();
for (const b of blocking) {
  if (!byRule.has(b.rule)) byRule.set(b.rule, { ...b, count: 0 });
  byRule.get(b.rule).count++;
}

const lines = [...byRule.values()].map(
  (b) =>
    `  ${b.rule}  ${b.name}${b.count > 1 ? ` (×${b.count})` : ""}\n` +
    `      line ${b.line}: ${b.snippet}\n` +
    `      fix: ${b.fix}`
);

block(
  `BLOCKED by the Master Design Guide Line.\n\n` +
    `${relPath} violates ${byRule.size} rule(s):\n\n` +
    lines.join("\n\n") +
    `\n\nRewrite the file so it complies, then write it again. These are hard\n` +
    `rules from DESIGN-CONTRACT.md and tools/rules.json — they are not\n` +
    `suggestions, and this hook will refuse the write until they are met.\n` +
    `If a rule genuinely does not apply here, add it to the \`waivers:\` list in\n` +
    `DESIGN-CONTRACT.md with a written justification — do not work around it.`
);
