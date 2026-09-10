#!/usr/bin/env node
/**
 * SessionStart hook — establishes the design law at the top of every session,
 * including sessions resumed after compaction.
 *
 * CLAUDE.md is re-injected after /compact, but a session that resumes cold
 * still benefits from a live status read: does a contract exist, is the gate
 * currently passing, what is the active direction. Facts beat instructions.
 */

import fs from "node:fs";
import path from "node:path";

const PROJECT = process.env.CLAUDE_PROJECT_DIR || process.cwd();

const exists = (p) => fs.existsSync(path.join(PROJECT, p));

// Only speak up in projects that are actually governed by this system.
if (!exists("tools/design-lint.mjs") && !exists(".claude/rules")) process.exit(0);

const lines = [];

/* --------------------------------------------------------- contract */

const contractPath = path.join(PROJECT, "DESIGN-CONTRACT.md");
if (!fs.existsSync(contractPath)) {
  lines.push(
    "STATUS: no DESIGN-CONTRACT.md. UI writes are BLOCKED until /design-intake produces one.",
    "If the user asks for any interface work, run /design-intake first — do not begin coding."
  );
} else {
  const src = fs.readFileSync(contractPath, "utf8");
  const get = (k) => {
    const m = src.match(new RegExp(`^\\s*${k}\\s*:\\s*(.+)$`, "im"));
    return m ? m[1].replace(/^["']|["']$/g, "").trim() : null;
  };
  const placeholders = [
    ...src.matchAll(/<>/g),
    ...src.matchAll(/<((?:#RRGGBB|[A-Z0-9][^<>\n]{1,60}))>/g),
  ].map((m) => (m[1] || "<>").trim());
  lines.push(
    `CONTRACT: ${get("project") || "(unnamed)"} · direction "${get("direction") || "?"}" · ` +
      `brand ${get("seed") || "?"} · ${get("display") || "?"} / ${get("body") || "?"}`
  );
  if (placeholders.length) {
    lines.push(
      `WARNING: the contract still has unfilled placeholders (${[...new Set(placeholders)].slice(0, 5).join(", ")}). ` +
        `Complete it before writing UI.`
    );
  }
}

/* ------------------------------------------------------------- gate */

const reportPath = path.join(PROJECT, ".design", "gate-report.json");
if (fs.existsSync(reportPath)) {
  try {
    const r = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    lines.push(
      r.ok
        ? `GATE: last run PASSED (${new Date(r.generatedAt).toISOString().slice(0, 16).replace("T", " ")}).`
        : `GATE: last run BLOCKED — failing ${r.failedGateIds.join(", ")}. Fix before adding new work.`
    );
  } catch {
    /* ignore */
  }
} else {
  lines.push("GATE: never run in this project. Run `node tools/gate.mjs` to establish a baseline.");
}

/* ---------------------------------------------------------- output */

const context = `
<design-system-status>
This project is governed by the Master Design Guide Line (see CLAUDE.md and
.claude/rules/). Design rules are enforced by hooks: writes that violate them
are blocked, and the Stop hook prevents ending a turn on a failing gate.

${lines.join("\n")}

Commands you own:
  /design-intake     interview the user, produce DESIGN-CONTRACT.md
  /design-direction  choose and justify an art direction
  /design-tokens     derive and verify the token system
  /design-review     audit the current build against the guide
  /design-ship       run every gate and produce the release report
</design-system-status>`.trim();

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: context,
    },
  })
);
process.exit(0);
