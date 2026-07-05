#!/usr/bin/env node
// Stop hook. While `.claude/autonomous-build.flag` exists AND its first line is not a
// stop command, this BLOCKS EVERY stop. No agent self-authorized stop. Ends ONLY on
// the founder's command: first line = STOP (or HALT/STAND DOWN/END/DONE), or delete flag.
import fs from "node:fs";

const FLAG = ".claude/autonomous-build.flag";
const STOP_WORDS = new Set(["STOP", "HALT", "STAND DOWN", "END", "END BUILD", "DONE", "CEASE"]);

process.stdin.on("data", () => {});
process.stdin.on("end", () => {
  if (!fs.existsSync(FLAG)) process.exit(0);                 // no flag → allow stop

  let control = "";
  try {
    const text = fs.readFileSync(FLAG, "utf8");
    control = (text.split(/\r?\n/).find((l) => l.trim()) || "").trim().toUpperCase();
  } catch { process.exit(0); }                               // unreadable → fail open

  if (STOP_WORDS.has(control)) process.exit(0);              // founder's command → allow stop

  process.stdout.write(JSON.stringify({ decision: "block", reason:
    "BUILD-CONTINUATION GUARD (A23 · HARD MODE) — autonomous build is ACTIVE.\n\n" +
    "You may NOT stop. No self-authorized stop: 'hard-blocked' / 'nothing left to build' / " +
    "'waiting on the founder' are NOT permission to stop. Flag what you need, then build the " +
    "next element (or do verification/tests/docs/refactors/an audit). Keep going.\n\n" +
    "Ends ONLY on the founder's command: set the flag's FIRST LINE to STOP (or HALT/STAND " +
    "DOWN/END/DONE), or delete the file."
  }));
  process.exit(0);
});
