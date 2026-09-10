#!/usr/bin/env node
/**
 * Stop hook — prevents Claude from ending its turn on a failing build.
 *
 * Exit 2 on a Stop hook blocks the stop and continues the conversation, with
 * stderr fed back as the reason. This is the mechanism that converts the
 * guide from advice into a loop the agent must actually close.
 *
 * Loop safety: an agent that cannot fix the gate would otherwise be trapped
 * forever. We cap consecutive blocks per session and then let it stop with a
 * loud, explicit report so a human can intervene.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const PROJECT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const GATE = path.join(PROJECT, "tools", "gate.mjs");
const STATE_DIR = path.join(PROJECT, ".design");
const REPORT = path.join(STATE_DIR, "gate-report.json");

const MAX_BLOCKS = 4;

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

let payload = {};
try {
  payload = JSON.parse(readStdin() || "{}") || {};
} catch {
  /* ignore */
}

const allow = () => process.exit(0);

/**
 * Report and let the turn end. Exit 0 permits the stop; the message still
 * reaches the user and Claude, so a build that cannot be fixed is handed over
 * with its failures stated rather than silently.
 */
function releaseWith(message) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "Stop",
        systemMessage: message,
        additionalContext: message,
      },
    })
  );
  process.exit(0);
}

// Nothing to gate if this project was never set up with the toolkit.
// But if .claude/hooks exists while tools/gate.mjs does not, the gate has been
// removed or renamed — fail CLOSED rather than silently disabling enforcement.
if (!fs.existsSync(GATE)) {
  const installed = fs.existsSync(path.join(PROJECT, ".claude", "hooks", "stop-gate.mjs"));
  if (!installed) allow();
  process.stderr.write(
    `The design gate is missing: tools/gate.mjs was not found, but this project\n` +
      `has the Master Design Guide Line hooks installed.\n\n` +
      `Restore it (re-run install.sh) or tell the user it has been removed.\n` +
      `Do not proceed as though the build were verified.\n`
  );
  process.exit(2);
}

// Only gate projects that actually contain UI source.
const hasUi = (() => {
  const stack = [PROJECT];
  const skip = new Set(["node_modules", ".next", ".git", "dist", "build", ".design"]);
  let n = 0;
  while (stack.length && n < 4000) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      n++;
      if (e.isDirectory()) {
        if (!skip.has(e.name) && !e.name.startsWith(".")) stack.push(path.join(dir, e.name));
      } else if (/\.(tsx|jsx)$/.test(e.name)) {
        return true;
      }
    }
  }
  return false;
})();

if (!hasUi) allow();

/* ------------------------------------------------------------ run gates */

const res = spawnSync(process.execPath, [GATE, "--json"], {
  cwd: PROJECT,
  encoding: "utf8",
  env: { ...process.env, CLAUDE_PROJECT_DIR: PROJECT },
  maxBuffer: 32 * 1024 * 1024,
  timeout: 180000,
});

let report = null;
try {
  report = JSON.parse(res.stdout || "{}");
} catch {
  if (fs.existsSync(REPORT)) {
    try {
      report = JSON.parse(fs.readFileSync(REPORT, "utf8"));
    } catch {
      /* ignore */
    }
  }
}

// If the gate itself is broken, do not trap the session.
if (!report || !Array.isArray(report.gates)) allow();
if (report.ok) {
  try {
    fs.rmSync(path.join(STATE_DIR, "stop-attempts"), { force: true });
  } catch {
    /* ignore */
  }
  allow();
}

/* --------------------------------------------------------- loop guard
 *
 * The counter — not `stop_hook_active` — is what bounds the loop. Bailing out
 * on `stop_hook_active` would let the gate block exactly once per user turn
 * and then fall silent, which is far weaker than it looks.
 *
 * The counter is stored with the session id so a previously-failing project
 * does not start a fresh session already at its limit.
 */

const counterFile = path.join(STATE_DIR, "stop-attempts");
const sessionId = String(payload.session_id || "nosession");
let attempts = 0;
try {
  const raw = JSON.parse(fs.readFileSync(counterFile, "utf8"));
  if (raw && raw.session === sessionId) attempts = Number(raw.n) || 0;
} catch {
  attempts = 0;
}
attempts++;
try {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(counterFile, JSON.stringify({ session: sessionId, n: attempts }));
} catch {
  /* ignore */
}

const failed = report.gates.filter((g) => g.status === "fail" || g.status === "error");

const detail = failed
  .map((g) => {
    const items = g.items.slice(0, 8).map((i) => `      ${i}`).join("\n");
    return `  ${g.id}  ${g.name}: ${g.detail}${items ? "\n" + items : ""}`;
  })
  .join("\n\n");

if (attempts > MAX_BLOCKS) {
  // Genuinely release. Exiting 2 here would be a deadlock, not an escape.
  releaseWith(
    `The design gate failed ${MAX_BLOCKS} times in a row and is no longer blocking, ` +
      `so this turn may end — but the build is NOT verified.\n\n` +
      `Report this to the user in your first sentence. Do not describe the work ` +
      `as done, verified, or accessible.\n\nStill failing:\n\n${detail}`
  );
}

process.stderr.write(
  `The design gate is BLOCKED. You may not finish this turn yet.\n\n` +
    `${failed.length} gate(s) failing (attempt ${attempts} of ${MAX_BLOCKS}):\n\n` +
    `${detail}\n\n` +
    `Fix these now, then re-run:  node tools/gate.mjs\n\n` +
    `Rules:\n` +
    `  - Fix the underlying design problem. Do not delete or weaken a rule in\n` +
    `    tools/rules.json, and do not add a waiver you cannot justify.\n` +
    `  - If gate G5 was skipped, the runtime audit has not run. Start the dev\n` +
    `    server and run: node tools/gate.mjs --url http://localhost:3000\n` +
    `  - If you genuinely cannot fix a gate, say so explicitly to the user and\n` +
    `    explain why. Never present a blocked build as finished.\n`
);
process.exit(2);
