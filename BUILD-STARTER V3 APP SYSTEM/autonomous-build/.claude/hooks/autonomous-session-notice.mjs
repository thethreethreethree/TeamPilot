#!/usr/bin/env node
// ============================================================================
// Autonomous SessionStart notice.
//
// Runs once at the START of every Claude Code session (this is the moment hooks
// are actually loaded). If `.claude/autonomous-build.flag` is armed (first line
// is NOT a stop word), it injects a loud directive into the session context so
// the agent knows from turn ONE that HARD MODE is active and the Stop guard is
// loaded — closing the failure mode where the agent stops because it did not
// realize the guard was in force.
//
// Prints nothing for a normal (disarmed) session, so it is invisible unless armed.
// ============================================================================
import fs from "node:fs";

const FLAG = ".claude/autonomous-build.flag";
const STOP_WORDS = new Set(["PAUSE", "PAUSED", "STOP", "HALT", "STAND DOWN", "END", "END BUILD", "DONE", "CEASE"]);

let control = "";
try {
  const text = fs.readFileSync(FLAG, "utf8");
  control = (text.split(/\r?\n/).find((l) => l.trim()) || "")
    .trim()
    .toUpperCase()
    .replace(/^[<"'\s]+|[>"'\s]+$/g, "");
} catch {
  process.exit(0); // no flag / unreadable → normal session, say nothing
}

// Disarmed or empty control line → normal session.
if (STOP_WORDS.has(control) || control === "") process.exit(0);

// Armed → announce it. SessionStart stdout is added to the session context.
const notice = [
  "════════════════════════════════════════════════════════════════════════",
  "AUTONOMOUS BUILD — HARD MODE IS ACTIVE. The Stop guard is loaded and WILL",
  "block every attempt to end a turn.",
  "",
  "RULES FOR THIS SESSION:",
  "• You may NOT stop until the user issues <Pause> or <Stop>.",
  "• 'Nothing left to build', 'waiting on the user', and 'hard-blocked' are NOT",
  "  permission to stop.",
  "• When no requested feature is buildable, switch to a DIFFERENT real product",
  "  task. Process work — audits, manifests, gates, verifiers, refactors, rule",
  "  edits — is NOT valid loop-work (03-ANTI-FAULT rule 1); it does not count as",
  "  'not stopping'. If nothing is buildable, surface the blocker loudly instead.",
  "• Flag anything that genuinely needs the user, then continue building.",
  "• Halt ONLY on the user's <Pause>/<Stop> (write it to the flag's first line).",
  "════════════════════════════════════════════════════════════════════════",
].join("\n");

process.stdout.write(notice + "\n");
process.exit(0);
