# GOVERNANCE — the law, enforced by exit codes

**A layer that makes the agent incapable of amending the rules or building
against rules it has not read.** Owner-requested, per `03-ANTI-FAULT.md` rule 3.

```
LAW         01-CONSTITUTION.md · 03-ANTI-FAULT.md      how to reason
              ^ enforced by THIS folder
METHOD      BUILD STRUCTURE PLAN/                      how a build runs
DESIGN LAW  design-system/                             enforced by its own hooks
CODE        BUILD STRUCTURE PLAN/foundation/           what you start from
```

`design-system/` already enforces the *design* layer with five hooks. Nothing
enforced the layer above it. This is that.

---

## Install

```bash
bash "BUILD-STARTER V3 APP SYSTEM/governance/install.sh" /path/to/project
```

Then **restart Claude Code.** Hooks load at session start and at no other time;
an installed-but-not-restarted layer enforces exactly nothing. `/hooks` should
then list `SessionStart`, `UserPromptSubmit`, `PreToolUse` and `PostToolUse`.

It merges `settings.json` rather than replacing it — hooks are concatenated per
event, so the design-system's five and the autonomous kit's Stop guard all
survive, and a re-run does not double them. Verified both ways.

Install order: it is independent of `design-system/install.sh` and safe either
side of it. Doing governance **first** means the law is enforced while you run
`/design-intake`.

---

## What it does

| # | Mechanism | Stops |
|---|---|---|
| 1 | `SessionStart` — states the order of authority, locates the law in the tree, and reports the **anti-fault tripwire's verdict** | Starting a session with no idea what governs, and process-drift going unseen |
| 2 | `UserPromptSubmit` — re-injects the eight standing rules on **every** prompt | 08-LESSONS Shape 14: a standing instruction summarised away twenty turns in |
| 3 | `PreToolUse` **tamper lock** — no write to `00`/`01`/`03`, `tools/`, `.claude/hooks/`, `.claude/settings.json`, `governance/`, by *any* tool including Bash | 03-ANTI-FAULT rule 1: the build that amended its own constitution seven times mid-flight |
| 4 | `PreToolUse` **session-read gate** — product-code writes blocked until `01-CONSTITUTION.md` **and** `03-ANTI-FAULT.md` have been read *in this session* | §0.1 / A19 / A22: citing clauses from cached labels while violating them |
| 5 | `PostToolUse` recorder — stamps which law files this session actually opened | Nothing. It is the evidence (3) and (4) run on |

Mechanisms 3 and 4 are exit codes, not advice. A `PreToolUse` hook exiting 2
blocks the tool call outright and feeds its reason back to the agent.

**Deliberately not included: a Stop hook.** `03-ANTI-FAULT.md` §"Two blocking
Stop-gates at once" is explicit that stacking Stop hooks — the design gate plus
another — produces the can't-stop-and-can't-satisfy trap that manufactures
fabricated fixes. This layer adds none.

---

## The escapes, and why each one is safe

A gate with no escape is a deadlock; a gate with a cheap escape is decoration.

- **The read-gate releases** the moment the two files are read. No cap, no
  counter — unlike a failing build gate, the remedy is always available and it is
  the thing the constitution already required before the first build action.
- **The tamper lock has no agent-side escape at all.** That is the point. You
  lift it by editing `.claude/settings.json` yourself — the one file denied to
  the agent and writable by you. A legitimate repair to a genuinely broken gate
  goes through you, and must then be proven to still bite against deliberately
  broken input (`06-VERIFICATION.md` §7).
- **Everything fails OPEN on error.** Bad stdin, missing state, an unreadable
  file — exit 0. A broken guard blocking every write is worse than a missed
  violation. Verified against `null`, empty and non-JSON stdin.

---

## What it deliberately does not gate

- **Documents, notes, and `DESIGN-CONTRACT.md`** — writing a document is not
  building a feature, and gating `/design-intake` would deadlock the build
  sequence at Phase 1.
- **The anti-fault tripwire.** `03-ANTI-FAULT.md` calls `build-guard.mjs` "a
  measurement, NOT a gate ... a human's smoke alarm," and rule 3 forbids
  mandatory self-gates. Session start **reports** the verdict; nothing enforces
  it, at any colour.

---

## Known limits

Stated plainly, because a layer that enforces honesty should be honest about its
own edges.

- **It cannot tell whether a file was read *carefully*.** It proves the file was
  opened this session, which is a floor A22 shows was not being met — not
  comprehension.
- **It cannot see the shape of a decision.** Whether a choice reached you as
  options with a recommendation (A20, Shape 14) is judgement; mechanism 2
  re-states the rule every turn, which is the strongest available structural
  answer, and it is not enforcement.
- **The Bash tamper lock is heuristic.** It blocks redirects whose *destination*
  is a governed path, and in-place editors (`sed -i`, `tee`, `rm`, `mv`,
  `chmod`…) that name one. A sufficiently indirect shell construction — a path
  assembled from variables, a script that writes the file — slips past. The
  file-tool `permissions.deny` is the hard half; this closes the obvious
  route-around (08-LESSONS Shape 7), not every conceivable one.
- **It shadows the design-system's `ask` on `tools/**` with a `deny`.** Deny
  wins in Claude Code. If you want the old prompt-and-approve behaviour on the
  gate tools, remove those two deny entries.
- **Hooks only load at session start.** Arming this mid-session does nothing.

---

## Verification record

`install.sh` runs nine probes on every install and prints each result. It does
not report success on an unproven gate — a gate that did not fire is a gate that
is not there.

| Probe | Expected | Result |
|---|---|---|
| Write to `01-CONSTITUTION.md` | blocked | exit 2 ✓ |
| `echo x >> 03-ANTI-FAULT.md` (shell route-around) | blocked | exit 2 ✓ |
| `sed -i … 01-CONSTITUTION.md` (in-place) | blocked | exit 2 ✓ |
| `cat 01-CONSTITUTION.md` | allowed | exit 0 ✓ |
| `grep … 01-CONSTITUTION.md > /tmp/out` | allowed | exit 0 ✓ |
| Write `app/probe.tsx`, law unread | blocked | exit 2 ✓ |
| Same write after both law files read | allowed | exit 0 ✓ |
| Anchor and session notice execute | no crash | ✓ |

Additionally verified by hand, outside the installer:

- `null`, empty and non-JSON stdin → **exit 0** (fails open) on every hook
- `NOTES.md` and `DESIGN-CONTRACT.md` writes with the law unread → allowed
- `lib/db.ts`, `tools/gate.mjs`, MultiEdit on a hook → blocked
- Read stamps are keyed to `session_id`: a second session does **not** inherit
  the first session's reads
- Merged onto the design-system's `settings.json`: all five of its hooks intact,
  its Stop gate untouched, `allow`/`ask` preserved, and a second install adds
  nothing

The `.governance/` state directory and the root copies of `00`/`01`/`03` are
git-ignored by the installer (anchored with a leading `/`, so the kit's own
copies stay tracked).
