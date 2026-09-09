#!/usr/bin/env node
// ============================================================================
// graphic-inspection-ledger.mjs — records that a graphic was ACTUALLY opened.
//
// PostToolUse hook on Read. When the agent reads an image or video file, this
// writes an entry to `.claude/graphic-inspections.json`.
//
// ─── WHY THE LEDGER IS MACHINE-WRITTEN ─────────────────────────────────────
//
// The owner's instruction (2026-09-07) was: describe every graphic before you
// touch it, one file at a time, and this is a gate you cannot bypass or LIE
// about.
//
// A rule the agent records for itself is a rule the agent can record without
// doing. So the agent never writes this file. It is written here, from the
// harness's own observation that a Read tool call happened against that path.
// The companion gate refuses any Write/Edit aimed at this file, so the only
// way an entry appears is that the file was genuinely opened.
//
// That is the difference between "I inspected it" and evidence of inspection.
// ============================================================================
import fs from "node:fs";
import path from "node:path";

const LEDGER = ".claude/graphic-inspections.json";

const MEDIA = new Set([
  ".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".bmp", ".ico",
  ".svg", ".mp4", ".webm", ".mov", ".m4v",
]);

/** The key is the BASENAME without extension.
 *
 *  A source master in `Image and Video Assets/` and the derived `public/img/`
 *  copy are the same picture. Inspecting either one is inspecting it. Keying on
 *  the full path would demand the agent open both, which is busywork, and
 *  busywork is what gets a guard deleted. */
const keyFor = (p) => path.basename(p).replace(/\.[^.]+$/, "").toLowerCase();

let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let payload;
  try {
    payload = JSON.parse(raw || "{}");
  } catch {
    process.exit(0);
  }

  if (payload?.tool_name !== "Read") process.exit(0);

  const file = payload?.tool_input?.file_path;
  if (typeof file !== "string" || file === "") process.exit(0);

  const ext = path.extname(file).toLowerCase();
  if (!MEDIA.has(ext)) process.exit(0);

  let ledger = {};
  try {
    ledger = JSON.parse(fs.readFileSync(LEDGER, "utf8"));
  } catch {
    ledger = {};
  }

  let bytes = null;
  try {
    bytes = fs.statSync(file).size;
  } catch {
    /* the file may be outside the tree; the opening still counts */
  }

  ledger[keyFor(file)] = {
    path: file,
    bytes,
    opened: new Date().toISOString(),
  };

  try {
    fs.mkdirSync(".claude", { recursive: true });
    fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1) + "\n");
  } catch {
    /* never take the session down over bookkeeping */
  }

  process.exit(0);
});

process.on("uncaughtException", () => process.exit(0));
