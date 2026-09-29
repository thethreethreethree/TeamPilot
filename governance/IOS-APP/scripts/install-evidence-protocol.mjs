#!/usr/bin/env node
// ============================================================================
// install-evidence-protocol.mjs — registers the Evidence Protocol guard.
//
// WHY THIS EXISTS AS A SCRIPT AND NOT AS A HAND EDIT.
//
// `.claude/settings.json` is on the DENY list and `.claude/hooks/**` is behind
// the tamper lock, so the agent cannot install this itself — which is correct,
// and is the same rule that stops it quietly removing a gate it finds
// inconvenient (03-ANTI-FAULT rule 1). The install is therefore the owner's,
// and hand-editing a 200-line JSON file at 3am is how a settings file ends up
// unparseable and every hook in the project silently stops running.
//
// So this does the merge instead: it reads the file, adds ONE entry, and
// refuses rather than guesses if anything is not as it expects.
//
// IT IS SAFE TO RUN TWICE. If the hook is already registered it says so and
// changes nothing. It writes a timestamped backup beside the original before
// touching it, matching the convention already in that folder.
//
// Run it from the project root:  node scripts/install-evidence-protocol.mjs
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';

const SETTINGS = '.claude/settings.json';
const HOOK = '.claude/hooks/evidence-protocol-guard.mjs';
const STAGED = 'scripts/evidence-protocol-guard.mjs';
const PROTOCOL = 'docs/EVIDENCEPROTOCOL.md';

const die = (msg) => {
  console.error(`\n  STOPPED — ${msg}\n`);
  process.exit(1);
};

// ── preconditions, each one a way this install is known to go wrong ─────────

if (!fs.existsSync(SETTINGS)) die(`${SETTINGS} is not here. Run this from the project root.`);

// ── put the hook in place ───────────────────────────────────────────────────
//
// The agent staged it at `scripts/` because the tamper lock refuses it the
// `.claude/hooks/` path — correctly, since that same rule is what stops it
// removing a gate it dislikes. Copying it across is the one part that needs a
// human, so the script does it here rather than making it a separate step
// somebody does at 3am and gets half right.
if (!fs.existsSync(HOOK)) {
  if (!fs.existsSync(STAGED)) {
    die(
      `neither ${HOOK} nor ${STAGED} exists.\n` +
        `  There is nothing to install. Re-export the Evidence Protocol folder.`,
    );
  }
  fs.mkdirSync(path.dirname(HOOK), { recursive: true });
  fs.copyFileSync(STAGED, HOOK);
  console.log(`\n  Copied ${STAGED}\n      to ${HOOK}`);
}

if (!fs.existsSync(PROTOCOL)) {
  die(
    `${PROTOCOL} is missing.\n` +
      `  The guard resolves it from the project root and prints "governing document\n` +
      `  NOT IN THE TREE" without it — a warning where a gate should be. INSTALL.md\n` +
      `  calls this the single most likely way the install goes wrong.`,
  );
}

let settings;
const raw = fs.readFileSync(SETTINGS, 'utf8');
try {
  settings = JSON.parse(raw);
} catch (e) {
  die(`${SETTINGS} is not valid JSON, so nothing was changed. ${e.message}`);
}

settings.hooks ??= {};
settings.hooks.UserPromptSubmit ??= [];

const already = JSON.stringify(settings.hooks.UserPromptSubmit).includes(
  'evidence-protocol-guard.mjs',
);
if (already) {
  console.log('\n  Already registered. Nothing to do.\n');
  process.exit(0);
}

// ── the entry, in THIS project's shape ──────────────────────────────────────
//
// The exported INSTALL.md uses `"command": "node .claude/hooks/x.mjs"`. Every
// hook already in this file uses `"command": "node"` with the path in `args`
// and anchored to ${CLAUDE_PROJECT_DIR}. That difference is not cosmetic here:
// this session changes working directory constantly, and a relative path would
// resolve against whatever directory was current when the hook fired.
settings.hooks.UserPromptSubmit.push({
  matcher: '*',
  hooks: [
    {
      type: 'command',
      command: 'node',
      args: ['${CLAUDE_PROJECT_DIR}/.claude/hooks/evidence-protocol-guard.mjs'],
      timeout: 15,
      statusMessage: 'Loading the evidence protocol',
    },
  ],
});

const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
const backup = `${SETTINGS}.backup-${stamp}`;
fs.writeFileSync(backup, raw);
fs.writeFileSync(SETTINGS, `${JSON.stringify(settings, null, 2)}\n`);

// Read it straight back. A settings file this script made unparseable would
// take every other hook in the project down with it, silently.
try {
  JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
} catch (e) {
  fs.writeFileSync(SETTINGS, raw);
  die(`the merge produced invalid JSON, so the original was restored. ${e.message}`);
}

console.log(`
  Registered.

    hook     ${HOOK}
    rulebook ${PROTOCOL}
    backup   ${path.basename(backup)}

  Hooks load when a session starts, so restart Claude Code for it to take
  effect. You will know it worked: every prompt is preceded by the R1-R7
  block, headed "EVIDENCE PROTOCOL - in force".

  If it instead says "governing document NOT IN THE TREE", the rulebook is
  not where the guard looks for it.
`);
