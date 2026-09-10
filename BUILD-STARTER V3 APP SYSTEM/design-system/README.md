# Master Design Guide Line

**A design system that AI coding agents cannot ignore.**

Version 1.0.0 (App Edition) · Expo · React Native · NativeWind · expo-router · WCAG 2.2 AA

---

## Where this sits

This folder is one layer of BUILD STARTER v3 (App Edition), not the whole thing.
It governs **design decisions only**.

```
LAW         01-CONSTITUTION.md · 03-ANTI-FAULT.md    how to reason, never amended
METHOD      BUILD STRUCTURE PLAN/                    the phases and their gates
DESIGN LAW  design-system/                           ← this folder
CODE        BUILD STRUCTURE PLAN/foundation/         working source to install
```

If anything here conflicts with the constitution, the constitution wins. If you
are looking for the build sequence, the backend blueprint, the deployment
method or the handover gate, they are in `BUILD STRUCTURE PLAN/`.

**Install order matters.** This one goes first, followed by a Claude Code
restart, because its hooks are what make the "no UI before a contract" rule real
and hooks load at session start only. The foundation code installs later, after
the scaffold. `../00-START-HERE.md` §3 has the full order and the reason behind
each step.

---

## What this is

A folder you drop into a project. It gives Claude Code a design specification
**and the machinery to enforce it** — static linting, contrast maths, an
on-device runtime check, and five hooks that block violating writes and refuse to
let a turn end on a failing build.

It exists because a design document that is merely *read* gets ignored around
the point where the context window fills up. Every rule here is either checked
by a program, blocked by a hook, or explicitly labelled as a human judgement
call.

## Why it exists

Ask any generative system for "a beautiful modern website" and you get the same
page: dark hero, purple-to-blue gradient, Inter, three rounded cards with
outline icons, a grey logo wall.

The reason is structural. Models regress toward the mean of their training data,
and that mean is the last decade of the web. The output is *maximally
prototypical* — which genuinely does test as "fine", because typicality is one
of the strongest predictors of aesthetic rating in the literature. It is also
completely forgettable.

This system's answer:

> **Conventional structure. Distinctive surface.**

Be prototypical where deviation costs comprehension — navigation position, page
order, form behaviour. Be distinctive where it costs nothing — typography,
colour, material, composition, motion character.

---

## Install

```bash
./install.sh /path/to/your/project
```

Then restart Claude Code so the hooks load, and run `/design-intake`. Scaffold
the app itself with Expo (React Native + TypeScript) + NativeWind, then install
the foundation — see the build sequence in `BUILD STRUCTURE PLAN/`.

The installer backs up anything it would overwrite, merges rather than replaces
`settings.json`, appends rather than replaces `CLAUDE.md`, and verifies that the
gates actually run before it reports success.

The **runtime gate is an on-device check**, not a browser one: run the core flow
on a real iOS and Android device / simulator. Automating it needs a device
harness (Detox / Maestro — **verify current**).

---

## How enforcement works

Five layers, each covering a different failure mode.

| Layer | Mechanism | Prevents |
|---|---|---|
| 1 | `CLAUDE.md` — auto-loaded, survives compaction | Never knowing the rules |
| 2 | `SessionStart` hook — injects live project status | Stale assumptions on resume |
| 3 | `UserPromptSubmit` hook — re-injects non-negotiables each turn | **Drift in long sessions** |
| 4 | `PreToolUse` hook — **blocks** violating writes | Violations entering the codebase |
| 5 | `Stop` hook — **refuses** to end a turn on a failing gate | "Done" on a broken build |

Layers 4 and 5 are the ones that matter. They are not advice — they are exit
codes. A `PreToolUse` hook exiting 2 blocks the tool call outright; a `Stop`
hook exiting 2 refuses to let the turn end and feeds the reason back.

Layer 3 is the specific answer to drift: the rules are re-stated on every
design-related prompt, so they are always in recent context rather than 200
messages back.

**Tampering is blocked too.** Everything under `tools/` and `.claude/hooks/`
requires human approval to edit or delete. An agent that can silently rewrite
or remove its own gates has no gates — and the Stop hook fails *closed* if the
gate goes missing.

---

## The workflow

```
/design-intake      → DESIGN-CONTRACT.md      (UI writes blocked before this)
/design-direction   → art direction, chosen and justified
/design-tokens      → theme.ts + NativeWind config, contrast-verified
   ...build...
/design-review      → independent audit by a separate subagent
/design-ship        → all gates green, release report
```

The order is enforced. Tokens derive from direction; direction derives from
audience and category. Building components first means inventing values ad hoc
and retrofitting a system that was never a system.

---

## What's in the folder

```
Master-Design-Guide-line.Md   The specification. Read this first.
README.md                     This file
install.sh                    Installer

claude/                       Dropped into <project>/.claude/
  CLAUDE.md                   The always-loaded anchor (~120 lines)
  settings.json               Hook registration + permissions
  hooks/                      5 enforcement hooks
  rules/                      5 path-scoped rulesets (load on demand)
  skills/                     5 slash commands
  agents/design-auditor.md    Independent reviewer subagent

tools/                        The programs that do the checking
  lib/oklch.mjs               Colour-space maths, verified round-trip exact
  lib/wcag.mjs                WCAG 2.2 contrast + APCA (advisory)
  rules.json                  Machine-readable rule registry, DS-001…DS-025
  design-lint.mjs             Static source linting
  token-gen.mjs               Derives + verifies the whole token system → theme.ts
  contrast-audit.mjs          Verifies what actually landed in theme.ts
  runtime-audit.mjs           Runtime gate — the on-device / simulator flow check
  gate.mjs                    Orchestrator — the ship/no-ship decision

templates/
  DESIGN-CONTRACT.template.md The per-project brief

reference/                    13 documents, loaded on demand
  00-evidence-ledger.md       What is strong, what is folklore
  01-perception-and-hierarchy.md
  02-color.md   03-typography.md   04-layout-and-space.md
  05-navigation-and-ia.md   06-components-and-states.md
  07-motion.md  08-forms.md  09-accessibility.md  10-performance.md
  11-art-directions.md        12 complete directions — the anti-sameness engine
  12-banned-patterns.md       What is forbidden, and why
```

---

## The tools, standalone

They work without Claude Code. Any of these can go in CI.

```bash
node tools/design-lint.mjs                  # static rules
node tools/token-gen.mjs --out theme.ts
node tools/contrast-audit.mjs --file theme.ts   # verify what shipped
node tools/runtime-audit.mjs                 # runtime gate — device / simulator flow
node tools/gate.mjs                          # everything
```

`token-gen` is the interesting one. It does not pick colours — it **solves** for
them. Give it a brand seed and it derives an 11-step OKLCH ramp with tapered
chroma, biases the neutrals toward the brand hue, and then walks each foreground
value until the *emitted hex* clears its contrast target — RN cannot evaluate
`oklch()` at runtime, so the perceptual work happens at generation time and only
resolved hex reaches `theme.ts`. Tested against hostile seeds (near-black,
near-white, pure yellow, neon green): zero contrast failures across all of them.

---

## On the evidence

Every empirical claim in this system was verified against primary sources, and
graded. A manual that presents folklore and replicated findings with equal
confidence teaches an agent to trust the wrong things.

A large fraction of what circulates as design law does not survive contact with
the literature. `Master-Design-Guide-line.Md` §14 lists what this system
**rejects** and why, including:

- "7±2 items in navigation" — Miller measured something else entirely and called
  the number "a pernicious, Pythagorean coincidence"
- "Users read in an F-pattern, so design to it" — inverts the source's own
  conclusion; F-scanning is a *symptom* of bad formatting
- The Zeigarnik effect — **failed** a 2025 meta-analysis of 38 studies, recall
  ratio 0.99
- The thumb-zone heatmap — **retracted by its own author** in 2017
- "Blue conveys trust", "60-30-10", "sticky menus are 22% faster", "APCA is the
  WCAG 3 contrast method" — all unsupported or actively wrong

And what does hold up, which is the part worth building on:

1. Low visual complexity is the strongest single predictor of aesthetic appeal
2. Prototypicality is comparably powerful — a floor, not a ceiling
3. Hidden navigation degrades every measured UX metric (≥39% slower tasks)
4. Serif vs sans does not affect legibility; x-height and letter
   discriminability do
5. Field count, not step count, drives form abandonment

---

## Verification

The toolkit was independently audited before release — the reviewer ran the
code rather than reading it, and found nine significant bugs including a waiver
deadlock that could trap an agent with no legitimate way out. All are fixed and
re-tested.

`VERIFICATION.md` has the full record: what was tested, the measured numbers,
every bug found, and the known limits. Headline results:

- Colour engine round-trips **exactly**; matches `culori` to ~1e-8
- **800 token pairs** across 144 seed colours re-verified with continuous
  maths: zero below 4.5:1
- Runtime auditor: 33 defects caught on a broken page, **zero false positives**
  on a clean one
- Every hook behaviour verified, including the block, the release, and the
  fail-closed paths

## Limits

Stated plainly, because a system that enforces rigour should be honest about
its own edges.

- **Automated tooling catches roughly a third of WCAG failures.** Contrast,
  name/role/value and landmark checks are reliable. Focus order, meaningful alt
  text and error-recovery flows are not. A green gate is necessary, never
  sufficient.
- **The linter is a regex and scanner pass, not an AST parser.** It is tuned to
  avoid false positives, so it will miss some real violations. A file that
  passes is not proven correct.
- **The Stop gate blocks at most four times per session**, then releases with a
  warning. A deliberate deadlock guard — but it means an agent that cannot fix
  the gate is eventually allowed to stop, and must report the failure.
- **Taste is not automatable.** Every gate can pass on a build that is dull.
  §16 of the manual is the part that matters, and no program checks it.
