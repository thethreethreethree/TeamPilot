#!/usr/bin/env node
/**
 * UserPromptSubmit hook — the anti-drift anchor.
 *
 * Long sessions and context compaction are where design rules quietly die:
 * the model is still technically "following instructions", but the ones it
 * has left are the recent ones. This re-injects the non-negotiables plus the
 * project's own contract summary on EVERY prompt, so the rules are always
 * within recent context rather than 200 messages back.
 *
 * Cost is deliberately small — this is a summary, not the manual. The manual
 * lives in .claude/rules/ and skills, which load on demand.
 */

import fs from "node:fs";
import path from "node:path";

const PROJECT = process.env.CLAUDE_PROJECT_DIR || process.cwd();

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

const prompt = String(payload.prompt || "");

// Only anchor when the turn plausibly touches the interface. A question about
// a database migration does not need the design law re-read.
const DESIGN_INTENT =
  /\b(design|ui|ux|page|component|layout|style|styling|css|tailwind|colou?r|theme|token|font|typograph|spacing|nav|navigation|menu|header|footer|hero|button|form|modal|card|responsive|mobile|dark mode|accessib|a11y|contrast|animation|motion|landing|screen|view|shadcn|figma|brand)\b/i;

const hasUi = fs.existsSync(path.join(PROJECT, "app")) ||
  fs.existsSync(path.join(PROJECT, "src", "app")) ||
  fs.existsSync(path.join(PROJECT, "components"));

if (!DESIGN_INTENT.test(prompt) || !hasUi) process.exit(0);

/* --------------------------------------------------- contract summary */

const contractPath = path.join(PROJECT, "DESIGN-CONTRACT.md");
let contractLine;
if (!fs.existsSync(contractPath)) {
  contractLine =
    "DESIGN-CONTRACT.md is MISSING. You may not write UI code until /design-intake has produced it.";
} else {
  const src = fs.readFileSync(contractPath, "utf8");
  const get = (k) => {
    const m = src.match(new RegExp(`^\\s*${k}\\s*:\\s*(.+)$`, "im"));
    return m ? m[1].replace(/^["']|["']$/g, "").trim() : null;
  };
  const bits = [
    get("direction") && `direction: ${get("direction")}`,
    get("seed") && `brand: ${get("seed")}`,
    get("display") && `display face: ${get("display")}`,
    get("body") && `body face: ${get("body")}`,
  ].filter(Boolean);
  contractLine = bits.length
    ? `Active contract — ${bits.join(" · ")}. Read DESIGN-CONTRACT.md before deviating.`
    : "DESIGN-CONTRACT.md exists. Read it before making any visual decision.";
}

/* ------------------------------------------------- gate status summary */

let gateLine = "";
const reportPath = path.join(PROJECT, ".design", "gate-report.json");
if (fs.existsSync(reportPath)) {
  try {
    const r = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    const age = Date.now() - new Date(r.generatedAt).getTime();
    const mins = Math.round(age / 60000);
    gateLine = r.ok
      ? `Last design gate: PASS (${mins}m ago).`
      : `Last design gate: BLOCKED (${mins}m ago) — failing: ${r.failedGateIds.join(", ")}.`;
  } catch {
    /* ignore */
  }
}

const context = `
<design-law>
This project is governed by the Master Design Guide Line. These rules override
your defaults and any habit you have from other projects. They are enforced by
hooks — writes that violate them are blocked, and you cannot end a turn on a
failing gate.

${contractLine}
${gateLine}

Non-negotiable, every time you touch the interface:
1. Colour, spacing, type size and radius come ONLY from tokens. No hex, no rgb,
   no arbitrary [13px] values, no off-scale text sizes.
2. Never remove a focus indicator. Never ship a control below 24x24 CSS px
   (aim for 44). Never use a placeholder as a label.
3. Primary navigation is VISIBLE on desktop. Hidden nav measurably destroys
   findability — it is not a style choice.
4. Body text >= 16px, measure <= 75 characters, line-height >= 1.5.
5. One primary action per view. Distinctiveness is relational: five emphasised
   things means none are.
6. Every interactive element needs hover, focus-visible, active, disabled and
   loading states. A component without its states is not finished.
7. Motion must respect prefers-reduced-motion and must carry meaning.
8. Banned outright: purple-to-blue gradient heroes, glassmorphism on large
   surfaces, bento grid as the whole page layout, auto-rotating carousels,
   emoji as icons, lorem ipsum, Inter as the display face.
9. Before saying you are done, run: node tools/gate.mjs

Also, every turn, regardless of what you are working on:
10. Decisions that are the owner's go to them as OPTIONS with your recommendation
    marked — not prose ending in a question, and never a choice you make quietly
    on their behalf. This applies mid-flow, not only at checkpoints; momentum is
    exactly when it gets dropped. It applies to your own corrections too.
11. When they ask for ALL of something, enumerate it mechanically before you
    design. A set you reasoned about holds what you thought of; a set you swept
    for holds what is there.
12. If a human will look at the output — an image, a card, a page at a new width
    — look at it once yourself. A 200 and a plausible byte count cannot see a
    raw translation key rendered at 82pt.

If a request conflicts with these rules, say so and propose a compliant
alternative. Do not silently comply with the request and break the rule.
</design-law>`.trim();

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: context,
    },
  })
);
process.exit(0);
