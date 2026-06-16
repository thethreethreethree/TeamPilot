# Pre-merge checklist — UI feature

**Source asset:** [[A14]] (ThinkerThinker.md) — *Data path complete ≠ render path complete (verification discipline).*
**Triggered by:** Catastrophic event CAT-001 + Close-button silent-failure regression (2026-06-16). A14 was authored 2026-06-12 and violated four days later because the discipline lived only in the asset library, not as a pre-merge gate.
**Purpose:** Make the silent-render-path failure mode structurally impossible to ship.

---

## When to run this checklist

Before claiming ANY of the following kinds of work "shipped":

- A new UI feature with more than one visible state (collapsed/expanded, loading/loaded/error, empty/populated, hover/focus, modal open/closed, mobile/desktop breakpoint, multi-tab, multi-step wizard, drill-down view).
- A change to an existing UI feature where the data shape changed and the render branches relate to that data.
- An action handler (button, form, API call from the client) where the action's *success* implies a state transition that the user needs to see.
- A bug fix whose claim of "fixed" rests on a UI rendering a different value than it did before.

If the work is non-UI (data layer only, migration only, API only with no UI consumer), skip this checklist — but verify the consumer the next time it changes.

---

## The diagnostic (run all three)

### 1. Enumerate the render branches

Is there ANY of the following related to the changed data?

- [ ] Collapsed / expanded toggle (chips, accordions, drawer)
- [ ] Hover / focus / active state (button affordance, link preview)
- [ ] Modal, drawer, popover, or tooltip
- [ ] Loading / loaded / error / empty state
- [ ] Mobile / tablet / desktop breakpoint
- [ ] Print view, PDF export, email render
- [ ] Multi-tab or multi-page conditional content
- [ ] Animation entry / exit state
- [ ] Authenticated / unauthenticated / authorization-denied state
- [ ] Theme variant (light / dark / high-contrast)
- [ ] Any conditional render with `&&`, `?:`, `switch`, or `if/else` keyed on the changed data

If **yes** to any: proceed to step 2. If **no** (single-state render only): note that explicitly in the commit message and skip step 2.

### 2. Verify the changed data reaches each branch

For each render branch identified in step 1:

- [ ] **Read the JSX/template** for that branch. Confirm it consumes the new data path (not a stale variable name, not a fallback string, not a comment).
- [ ] **Render it** in your local environment (or staging) and confirm the rendered output reflects the new data. Screenshot or note "verified by manual render at <time>" in the commit message.
- [ ] If you cannot render the branch locally (uncommon state, requires production data, blocked by auth/role), state the gap explicitly in the commit message.

### 3. If gaps remain, name them

If step 2 surfaced any branch you did NOT verify:

- [ ] Name each unverified branch in the commit message: `*Unverified: <branch name> — needs <reason>.*`
- [ ] Tag the commit `partial-render-verification: yes` in the commit body.
- [ ] Either:
  - **Complete the verification before merging** (preferred), OR
  - **Open a follow-up issue** named `Verify <branch> renders changed data` and link the commit to it.

A partial-verification merge that doesn't surface the gap is the A14 failure shape repeated.

---

## What this checklist explicitly forbids

- "I changed the data, the type-check passed, shipping." (The Close button passed type-check.)
- "The state variable holds the new value; the render path was fine before." (It wasn't.)
- "I tested the happy path; the edge cases will surface in QA." (A14 came from QA never running.)
- "It's a small change." (The Close button was a small change. Six commits' worth of follow-up.)

---

## What this checklist is NOT

- It is not a substitute for the [[A11]] count-vs-verdict check (Coach v6 work).
- It is not a substitute for [[A16]] composition-with-other-AI-surfaces (Co-Pilot ↔ Coach work).
- It is not a substitute for [[A17]] multi-contract design review (experiential contract has its own surface).
- It is not a substitute for [[A18]] label-as-defense review (leader-visible surfaces).

A UI feature touching Coach behavior runs this checklist AND the A11/A17/A18 reviews. A UI feature surfacing data to leadership runs this checklist AND A10/A18. The checks compose; they don't substitute.

---

## Worked example — the Close button regression (CAT-001 era)

- **Step 1.** Did the Close button have render branches? **Yes** — the conversation status badge ("Needs first response"), the inbox filter ("All open" vs "Closed"), the conversation header buttons (Resolve/Close visibility conditional on `status !== "closed"`). All three keyed on the status field the Close button mutates.
- **Step 2.** Did the changed data (status='closed') reach all three?
  - Inbox filter: VERIFIED (the filter logic strips closed, would have been rebuked if the agent had refreshed).
  - Status badge: NOT VERIFIED. The badge re-renders from the conversation row; the conversation row's status didn't actually change because of the silent-failure path. So even though the badge had the right LOGIC to render "Closed", the data never reached it.
  - Header buttons: NOT VERIFIED (same root cause).
- **Step 3.** Two branches unverified. The pre-merge claim of "Close button shipped" should have read: *"Close button: confirmation flow shipped. Status badge and header buttons unverified — open follow-up to confirm post-close state propagation."* That single line in the commit message would have triggered a verification round that would have caught the silent-failure path BEFORE the user did.

The silent-failure path itself was a separate root cause ([[A13]] vocabulary-once + the void-returning write function). But A14 would have caught the symptom — the badge not updating — independent of why. **A14 catches the leak even when you don't yet know the source of the leak.**

---

## Why this lives in `docs/pre-merge-checklists/` and not in TT.md

ThinkerThinker.md holds the discipline. This file holds the **pre-action invocation** of the discipline. Per [[A19]] the discipline must live where the agent will encounter it — at the moment of action, not at the moment of reflection. A14 in TT.md is the *insight*; this file is the *gate*. The agent (or future-me, or any maintainer) running `find . -iname "UI-FEATURE.md"` before claiming a UI feature shipped is the structural lock-in that prevents the next instance.

Future checklists in this folder follow the same pattern: one asset, one gate file, named `<DOMAIN>.md`. Candidates queued:

- `MIGRATION.md` (from [[A12]]) — the safe-to-re-run-by-construction diagnostic.
- `AI-FEATURE.md` (from [[A16]] + [[A17]]) — the multi-tool composition + multi-contract design review.
- `LEADER-VISIBLE-DATA.md` (from [[A10]] + [[A18]]) — the self-view-exists + label-invites-help test.
- `AUDIT-CLOSURE.md` (from [[A15]]) — the not-a-defect-vs-defect 3-question diagnostic before shipping a fix.

These are NOT pre-built. Per [[A4]] the checklist content should be informed by the first real use, not invented in a vacuum. They land when the first relevant surface lands.
