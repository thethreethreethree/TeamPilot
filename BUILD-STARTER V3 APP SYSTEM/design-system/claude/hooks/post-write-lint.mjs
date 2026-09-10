#!/usr/bin/env node
/**
 * PostToolUse hook — self-correction feedback.
 *
 * PreToolUse blocks hard violations. This catches everything at warn level and
 * anything the pre-write reconstruction could not evaluate, and hands it back
 * to Claude as additionalContext so it fixes the file in the same turn instead
 * of moving on.
 *
 * PostToolUse cannot block (the tool already ran), so this never fails a build.
 * Its job is to make the next action obvious.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const PROJECT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const LINT = path.join(PROJECT, "tools", "design-lint.mjs");

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

const quiet = () => process.exit(0);

let payload = {};
try {
  payload = JSON.parse(readStdin() || "{}") || {};
} catch {
  quiet();
}

const filePath = payload.tool_input?.file_path || payload.tool_input?.path || "";
if (!filePath || !/\.(tsx|jsx|css)$/i.test(filePath)) quiet();
if (!fs.existsSync(LINT) || !fs.existsSync(filePath)) quiet();

const res = spawnSync(process.execPath, [LINT, filePath, "--json"], {
  cwd: PROJECT,
  encoding: "utf8",
  env: { ...process.env, CLAUDE_PROJECT_DIR: PROJECT },
  maxBuffer: 16 * 1024 * 1024,
});

let data;
try {
  data = JSON.parse(res.stdout || "{}");
} catch {
  quiet();
}

const findings = [...(data.blocking || []), ...(data.warnings || [])].filter(
  (f) => f.rule !== "DS-025"
);
if (!findings.length) quiet();

const rel = path.relative(PROJECT, filePath);
const lines = findings
  .slice(0, 12)
  .map((f) => `  [${f.severity}] ${f.rule} line ${f.line} — ${f.name}\n      ${f.fix}`)
  .join("\n");

const blockingCount = findings.filter((f) => f.severity === "block").length;

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext:
        `design-lint on ${rel} found ${findings.length} issue(s)` +
        (blockingCount ? ` (${blockingCount} BLOCKING)` : "") +
        `:\n\n${lines}\n\n` +
        (blockingCount
          ? "Fix the blocking issues before continuing. The design gate will refuse to let this turn end otherwise."
          : "Address these now while the file is in context. Warnings still fail review if left unjustified."),
    },
  })
);
process.exit(0);
