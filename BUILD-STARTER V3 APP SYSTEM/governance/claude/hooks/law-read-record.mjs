#!/usr/bin/env node
/**
 * PostToolUse recorder — the evidence half of the session-read gate.
 *
 * Constitution A19 requires the methodology to be IN the working tree; A22
 * requires it to have been READ IN THIS SESSION, not cited from cached labels.
 * A19's own third question ("have I read the relevant assets in the current
 * session?") is a MENTAL check, and A22 records that it did not take: the agent
 * cited §A11, §A14, §A10, §3.1 across ~3,800 LoC having actually re-read one
 * asset. A22's prescribed fix is a shipping artefact that records what was read.
 *
 * This is that artefact, produced automatically instead of by good intentions.
 * It watches Read (and the Bash equivalents, because Shape 7 forbids routing
 * around a guard with a tool it does not watch) and stamps the law documents
 * this session has actually opened into .governance/read-<session>.json.
 *
 * It NEVER blocks and never speaks. Its only output is the stamp file that
 * law-read-gate.mjs reads. A recorder that could fail a turn would be a second
 * failure mode for no benefit.
 */

import fs from "node:fs";
import path from "node:path";

const PROJECT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const STATE_DIR = path.join(PROJECT, ".governance");

/**
 * The documents that count. Matched on BASENAME, so it does not matter whether
 * the agent read the copy at the project root, the copy inside the kit folder,
 * or an absolute path from another drive — reading any of them is reading the
 * law.
 */
const LAW = ["01-CONSTITUTION.md", "03-ANTI-FAULT.md", "00-START-HERE.md"];

const quiet = () => process.exit(0);

let payload = {};
try {
  // JSON.parse("null") returns null WITHOUT throwing, so `|| {}` is load-bearing
  // and not defensive noise — every property access below would otherwise throw.
  payload = JSON.parse(fs.readFileSync(0, "utf8") || "{}") || {};
} catch {
  quiet();
}
if (typeof payload !== "object") quiet();

const input = payload.tool_input || {};

// A Read carries a path; a Bash `cat`/`sed -n` carries the name inside the
// command string. Both are legitimate ways to actually read the file, so both
// count as evidence. This is deliberately generous: the gate exists to stop the
// agent building on remembered labels, not to police HOW it opened the file.
const haystack = [
  input.file_path || input.path || "",
  input.command || "",
].join("\n");

if (!haystack.trim()) quiet();

const seen = LAW.filter((name) => haystack.includes(name));
if (!seen.length) quiet();

const sessionId = String(payload.session_id || "nosession");
const stateFile = path.join(STATE_DIR, `read-${sessionId}.json`);

let state = { session: sessionId, read: {} };
try {
  const prior = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  if (prior && prior.session === sessionId && prior.read) state = prior;
} catch {
  /* first write of the session */
}

const now = new Date().toISOString();
for (const name of seen) {
  // Keep the FIRST timestamp: A22 asks "name the in-session moment you re-read
  // it", and the first read is that moment. Overwriting on every subsequent
  // glance would make a late skim look like early diligence.
  if (!state.read[name]) state.read[name] = now;
}

try {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
} catch {
  /* a recorder that cannot write must not break the turn */
}

process.exit(0);
