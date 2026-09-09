#!/usr/bin/env node
// ============================================================================
// graphic-inspection-gate.mjs — you may not place a graphic you have not opened.
//
// PreToolUse hook on Write | Edit | NotebookEdit | Bash.
//
// ─── THE OWNER'S INSTRUCTION, 2026-09-07 ───────────────────────────────────
//
//   "EVERY GRAPHIC WORK EVERY TIME YOU TOUCH OR EDIT A FIELD YOU MUST INSPECT
//    AND DESCRIBE TO ME WHAT THE IMAGE IS AND WHAT THE CONTENT IS. AND THEN
//    APPLY THE SOLUTION/EDIT. BUT YOU CAN NOT APPLY WITHOUT DESCRIBING IT
//    FIRST."
//
//   "descrive every single image in our graphic folder ever single one image
//    by image"  ...  "as a gate that you can not break"  ...  "a coding
//    structure behavior that you can not by pass or lie or defy about"
//
// ─── THE FAILURES IT EXISTS FOR ────────────────────────────────────────────
//
// All four are from one session, and all four were invisible to every other
// gate in this repository:
//
//   1. 26 subject images were placed as low-opacity page backgrounds because
//      ONE generic treatment could be applied to all of them without looking
//      at any of them. Exactly one of the 26 had been opened.
//
//   2. `Nebula_cloud_drifting_in_space.jpeg` is not a nebula. It is a
//      craftsman at a workbench, with two thirds of the frame empty sky.
//      Trusting the filename would have made it a background texture.
//
//   3. A favicon whose largest area was #fff shipped onto a white browser tab
//      strip and vanished. tsc sees valid SVG; axe never looks at a tab strip.
//      Only a human looking at it could see it, and the human was the owner.
//
//   4. Caught mid-session: the agent MONTAGED eighteen brand logos into
//      contact sheets and described them in groups, then wrote up 44 favicons
//      and app-icons from a folder listing without opening one. That is the
//      same evasion as reading the filename, with extra steps.
//
// ─── HOW IT CANNOT BE LIED TO ──────────────────────────────────────────────
//
// The agent never writes the ledger. `graphic-inspection-ledger.mjs` writes it
// on PostToolUse, from the harness's own record that a Read happened. This gate
// refuses any Write/Edit aimed at the ledger. So an entry exists if and only if
// the file was actually opened.
//
// It also refuses the contact-sheet dodge mechanically: an ffmpeg/montage
// command that stacks or tiles two or more images into one output is blocked,
// because the next step is always to describe them as a group.
//
// ─── AND WHY IT DOES NOT INTERRUPT ORDINARY WORK ───────────────────────────
//
// It fires only when a change INTRODUCES a reference to a graphic that is not
// already referenced in that file. Moving a line, renaming a class, editing
// copy around an existing image — none of that trips it. A guard that
// interrupts ordinary work is one that gets removed, and then it is not there
// for the real thing (A30).
// ============================================================================
import fs from "node:fs";
import path from "node:path";

const LEDGER = ".claude/graphic-inspections.json";

const MEDIA_EXT = "png|jpe?g|webp|avif|gif|bmp|ico|svg|mp4|webm|mov|m4v";

/** Where a bare asset NAME (e.g. name="x") could resolve to on disk. TeamPilot/Elostate keeps its
 *  graphics FLAT in public/ (no public/img|video|brand), so map bare names there. Direct refs with an
 *  extension (src="/elostate-logo.svg") are resolved without this list, via the public/<bare> candidate. */
const SEARCH = [
  (n) => `public/${n}.svg`,
  (n) => `public/${n}.png`,
  (n) => `public/${n}.webp`,
  (n) => `public/${n}.avif`,
  (n) => `public/${n}.jpg`,
  (n) => `public/${n}.ico`,
];

const keyFor = (p) => path.basename(p).replace(/\.[^.]+$/, "").toLowerCase();

const exists = (p) => {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
};

/** Pull every graphic reference out of a blob of source text. */
function assetsIn(text) {
  if (typeof text !== "string" || text === "") return new Set();
  const found = new Set();

  // BrandImage / BrandVideo name="foo"  and  <Image name="foo">
  for (const m of text.matchAll(/\bname\s*=\s*["'`]([A-Za-z0-9._-]{3,})["'`]/g)) {
    found.add(m[1]);
  }
  // src="/img/foo.webp", href="/brand/bar.svg", url(/video/baz.mp4)
  for (const m of text.matchAll(
    new RegExp(`[\\w./-]+\\.(?:${MEDIA_EXT})\\b`, "gi"),
  )) {
    found.add(m[0]);
  }
  return found;
}

/** Only the assets this edit ADDS, relative to what the file already had. */
function introduced(after, before) {
  const b = assetsIn(before);
  const out = [];
  for (const a of assetsIn(after)) if (!b.has(a)) out.push(a);
  return out;
}

/** A reference is in scope only if it names a file that actually exists. */
function resolve(ref) {
  const bare = ref.replace(/^\/+/, "");
  const candidates = [bare, `public/${bare}`];
  if (!/\.[A-Za-z0-9]+$/.test(ref)) for (const f of SEARCH) candidates.push(f(ref));
  for (const c of candidates) if (exists(c)) return c;
  return null;
}

function readLedger() {
  try {
    return JSON.parse(fs.readFileSync(LEDGER, "utf8"));
  } catch {
    return {};
  }
}

function block(lines) {
  process.stderr.write(
    [
      "",
      "⛔ GRAPHIC INSPECTION GATE — you have not opened this.",
      "",
      ...lines,
      "",
      "   The owner's rule, 2026-09-07, and it is a gate:",
      "",
      '     "you can not apply without describing it first"',
      '     "every single one image by image"',
      '     "a coding structure behavior that you can not by pass or lie about"',
      "",
      "   Open each file with the Read tool and DESCRIBE it — what it shows,",
      "   what is in it including any visible text and what that text says, and",
      "   what surface it sits on. Then make the change.",
      "",
      "   One file at a time. A contact sheet is not an inspection. A folder",
      "   listing is not an inspection. Reading an SVG's source is not looking",
      "   at it — render it.",
      "",
    ].join("\n"),
  );
  process.exit(2);
}

let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let payload;
  try {
    payload = JSON.parse(raw || "{}");
  } catch {
    process.exit(0);
  }

  const tool = payload?.tool_name ?? "";
  const input = payload?.tool_input ?? {};

  // ── 1. the ledger is not yours to write ─────────────────────────────────
  const target = String(input.file_path ?? "").replace(/\\/g, "/");
  if (target.endsWith("graphic-inspections.json")) {
    block([
      "   You tried to write the inspection ledger yourself.",
      "",
      "   That file is written by the harness when a Read actually happens.",
      "   Writing it by hand is the lie this gate exists to make impossible.",
    ]);
  }

  // ── 2. no contact sheets ────────────────────────────────────────────────
  if (tool === "Bash") {
    const cmd = String(input.command ?? "");
    const stacking = /\b(hstack|vstack|tile=|xstack|montage)\b/i.test(cmd);
    const inputs = (cmd.match(new RegExp(`\\.(?:${MEDIA_EXT})\\b`, "gi")) || [])
      .length;
    if (stacking && inputs >= 2) {
      block([
        "   This command builds a CONTACT SHEET from two or more graphics.",
        "",
        "   Montaging images into a grid and describing them together is not",
        "   inspecting them. The owner named this exact dodge and forbade it.",
        "",
        "   Open them one at a time instead.",
      ]);
    }
    process.exit(0); // Bash is otherwise none of this gate's business
  }

  if (tool !== "Write" && tool !== "Edit" && tool !== "NotebookEdit") {
    process.exit(0);
  }

  // ── 3. which graphics does this change INTRODUCE? ───────────────────────
  let before = "";
  try {
    before = fs.readFileSync(input.file_path, "utf8");
  } catch {
    before = "";
  }

  const after =
    tool === "Write"
      ? String(input.content ?? "")
      : String(input.new_string ?? input.new_source ?? "");
  const removedContext =
    tool === "Write" ? before : String(input.old_string ?? input.old_source ?? "");

  const refs = introduced(after, tool === "Write" ? before : removedContext);
  if (refs.length === 0) process.exit(0);

  const ledger = readLedger();
  const missing = [];
  for (const ref of refs) {
    const file = resolve(ref);
    if (!file) continue; // not a real asset in this repo — not our business
    if (!ledger[keyFor(file)]) missing.push({ ref, file });
  }

  if (missing.length === 0) process.exit(0);

  block([
    `   ${missing.length} graphic${missing.length === 1 ? "" : "s"} in this edit ${
      missing.length === 1 ? "has" : "have"
    } never been opened in this session:`,
    "",
    ...missing.map((m) => `     ${m.file}${m.ref === m.file ? "" : `   (as "${m.ref}")`}`),
  ]);
});

process.on("uncaughtException", () => process.exit(0));
