# Session-Read Manifests (per ThinkerThinker.md A22)

This directory holds the **session-read manifests** that A22 (captured
2026-06-19) requires before any multi-commit feature closure.

## What lives here

One markdown file per closure, named `YYYY-MM-DD-<slug>.md`.

Each file documents:

1. **The build** — what was built or inspected, with commit refs.
2. **Constitutional assets cited** — every `§A` / `§N.N` / `§N` reference
   that appeared in the commits' messages or the diff content.
3. **In-session re-read timestamps** — for each cited asset, the
   timestamp at which it was opened and read DURING this session
   (not "I read it last week and remember what it says").
4. **Intent-vs-behavior comparison** — for each re-read asset, one
   concrete sentence naming how the build's runtime behavior either
   embodies or violates the asset's intent.
5. **Findings + remediation order** — what's broken, what's deferred,
   what's resolved this commit. Recommended order per A20 (never
   "founder decides A/B/C").
6. **Outside-perspective audit** — four personas (new user, new
   engineer, adversary, CFO) per `feedback_outside_perspective_post_build.md`.

## What this is, honestly

This is **friction against forgetfulness**, not enforcement of
constitutional compliance.

The pre-commit hook (`scripts/hooks/pre-commit`) checks that every
commit citing a constitutional asset has a `Session-Reads:` trailer
referencing one of these files. The hook does NOT verify:

- That the assets were actually opened in this session
- That the timestamps are real
- That the intent-vs-behavior analysis is accurate

All three depend on the agent's own truthful writing. Per A22's own
context: a system built from inside the agent's writable artifacts
cannot enforce against a determined or pressured violation. The
structural defense against drift is the founder's periodic
interrogation ("show me what §A14's three pre-flight questions
say without looking at the file").

What the hook catches: forgetting to write the manifest. That's
real value. Friction against forgetfulness reduces the
forgetfulness-class of violations. It does not reduce the
willful-deception-class.

## Bypass log

If a commit is intentionally created with `--no-verify` (e.g., a
typo fix in a constitutional doc that doesn't change cited intent),
the bypass is appended to `bypasses.log`. The log is the founder's
audit trail — how often does the agent bypass? On what shape of
commit? Bypass concentration is a signal that A22 has stopped
operating.

## Template

```markdown
# Session-Read Manifest: <slug>

**Date:** YYYY-MM-DD
**Session:** <agent session identifier, if available>
**Commits in scope:** `<sha1>`..`<sha2>` (or list)
**Builder:** Agent

## 1. What this build does

<One paragraph. Plain English. No constitutional citations here —
those go in section 2.>

## 2. Constitutional assets cited

For each asset cited in commit messages, code comments, or migration
headers in this build's diff:

| Asset | First cited in | Re-read in session at | One-sentence intent | Behavior in this build |
|---|---|---|---|---|
| §A14 | commit `abc123` | 2026-06-19T16:23Z | Data path complete ≠ render path complete; verify every render branch. | Embodies — attachment kind branch added to chat MessageRow + C.A.R.E MessageRow + customer widget. Verified all three render paths. |
| §3.1 | migration 0058 | 2026-06-19T16:24Z | Events are immutable; entity state derived from event replay. | VIOLATES — declared `asset_event_kinds` view with 9 event kinds but emitted zero from any API route. |

Every cited asset has a row. Empty cells in "Re-read at" = violation.

## 3. Findings

### Resolved this commit
- ...

### Deferred with recommended remediation order (per A20)
1. ...
2. ...

### Open uncertainties (per A4 — to be answered by data later)
- ...

## 4. Outside-perspective audit (per A19/feedback_outside_perspective_post_build)

### New user
- ...

### New engineer
- ...

### Adversary
- ...

### CFO / operator
- ...

## 5. Cross-module check (per A21)

Same-name-different-feature surfaces touched by this build:
- ...

## 6. Verification checklist

- [ ] `npx tsc --noEmit` green
- [ ] `npm run build` green
- [ ] Every constitutional citation in commit messages has a row in section 2
- [ ] Every row in section 2 has a session-read timestamp
- [ ] Every row in section 2 has a one-sentence behavior comparison
- [ ] Section 4 has at least one finding per persona (or honest "none surfaced — and here's why I think that's true")
```
