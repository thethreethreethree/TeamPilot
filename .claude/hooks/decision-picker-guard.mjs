#!/usr/bin/env node
// Stop hook (AMD-013). Enforces the founder's standing, repeatedly-restated rule:
// EVERY decision that depends on the founder MUST be presented via the AskUserQuestion
// tool (an interactive picker) WITH a recommendation — never as a prose option-list,
// "which do you want?", "should I X or Y?", or "your call". Memory + intent proved
// insufficient (the rule failed 3x while documented), so this is a STRUCTURAL gate that
// fails without the agent's cooperation (A30): if the agent's final message offers the
// founder a choice in prose and no AskUserQuestion was fired this turn, the stop is BLOCKED.
//
// Fails OPEN on any error (never break the session). Reads only the transcript TAIL.
import fs from "node:fs";

const TAIL_BYTES = 512 * 1024; // last 512KB is far more than one turn
const MAX_SCAN_LINES = 250;

// Strong phrasings that almost always mean "I am handing the founder a choice in prose".
const STRONG = [
  /\bwhich (one|option|approach|way|of these|of those)\b/i,
  /\bwhich (do|would|should) you\b/i,
  /\bwould you like me to\b/i,
  /\bdo you want (me|us) to\b/i,
  /\byour call\b/i,
  /\blet me know (which|how you|if you|whether|what you|your)/i,
  /\bshould i\b[^.?!\n]{0,80}\bor\b[^.?!\n]{0,80}\?/i,
  /\bshall i\b[^.?!\n]{0,80}\?/i,
  /\bhere (are|'s|s) (the |your |a few )?(options|choices)\b/i,
  /\bpick (one|which|the option|an option)\b/i,
  /\bwant me to (proceed|go ahead|start|build|do|apply|commit)\b/i,
  /\bwhat.?s your (call|preference|pick)\b/i,
];

// A prose numbered/lettered option list PLUS a choice cue nearby (weaker, so gated).
function offersDecision(text) {
  if (!text) return false;
  for (const re of STRONG) if (re.test(text)) return true;
  const numbered = (text.match(/^\s*(?:option\s*)?[1-9][.)]\s+\S/gim) || []).length >= 2;
  const cue = /\b(which|prefer|recommend(ed)?|your call|let me know|choose|pick|want me to|would you|do you want)\b/i.test(text);
  return numbered && cue;
}

function textOf(msg) {
  const c = msg?.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.filter((b) => b?.type === "text").map((b) => b.text || "").join("\n");
  return "";
}
function hasPicker(msg) {
  const c = msg?.content;
  return Array.isArray(c) && c.some((b) => b?.type === "tool_use" && b?.name === "AskUserQuestion");
}
// A genuine human prompt (turn boundary) — NOT a tool_result and NOT the assistant.
function isHumanBoundary(o) {
  if (o?.type !== "user" || o?.message?.role !== "user") return false;
  const c = o.message.content;
  if (typeof c === "string") return true;
  if (Array.isArray(c)) return c.some((b) => b?.type === "text");
  return false;
}

function readTail(path) {
  const fd = fs.openSync(path, "r");
  try {
    const { size } = fs.fstatSync(fd);
    const len = Math.min(size, TAIL_BYTES);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, size - len);
    const lines = buf.toString("utf8").split(/\r?\n/).filter(Boolean);
    if (len < size) lines.shift(); // drop the partial first line
    return lines;
  } finally {
    fs.closeSync(fd);
  }
}

let raw = "";
process.stdin.on("data", (d) => (raw += d));
process.stdin.on("end", () => {
  try {
    const payload = JSON.parse(raw || "{}");
    const path = payload.transcript_path;
    if (!path || !fs.existsSync(path)) process.exit(0); // fail open

    const lines = readTail(path);
    let finalText = null;
    let usedPicker = false;
    let scanned = 0;
    for (let i = lines.length - 1; i >= 0 && scanned < MAX_SCAN_LINES; i--, scanned++) {
      let o;
      try { o = JSON.parse(lines[i]); } catch { continue; }
      if (o?.type === "assistant" && o?.message?.role === "assistant") {
        if (hasPicker(o.message)) usedPicker = true;
        if (finalText === null) {
          const t = textOf(o.message);
          if (t) finalText = t;
        }
      } else if (isHumanBoundary(o)) {
        break; // reached the start of the current turn
      }
    }

    if (finalText && !usedPicker && offersDecision(finalText)) {
      process.stdout.write(JSON.stringify({
        decision: "block",
        reason:
          "DECISION-PICKER GUARD (AMD-013) — your final message offers the founder a choice in prose, but you did NOT fire the picker this turn.\n\n" +
          "EVERY decision that depends on the founder MUST be presented via the AskUserQuestion tool (an interactive picker) WITH your recommendation (recommended option first, labelled). NEVER a prose option-list, 'which do you want?', 'should I X or Y?', 'want me to…?', or 'your call'. The founder has directed this repeatedly; prose choices read as undermining the request.\n\n" +
          "FIX: re-present the decision as an AskUserQuestion picker now. If this was genuinely NOT a decision for the founder (just reporting), rephrase to remove the choice-offering language and continue — do not leave an un-pickered choice in your final message.",
      }));
    }
  } catch {
    // fail open — never break the session on a guard error
  }
  process.exit(0);
});
