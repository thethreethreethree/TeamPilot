# Pre-merge checklist — leader-visible human data

**Source assets:** [[A10]] (*the user sees what the System sees about them — no shadow read*) + [[A18]] (*when a system surfaces human-behavior data to a leader, the label IS the structural defense*). Composes with [[A11]], [[A7]], [[A6]], [[A1]].
**Triggered by:** the ELOSALES Standard manager-transparency revision (2026-07-17) — the **first leader-visible-data surface this codebase has shipped**, and the trigger condition `UI-FEATURE.md` named on 2026-06-16: *"These are NOT pre-built… They land when the first relevant surface lands."*
**Purpose:** make the shadow-read and the rank-inviting label structurally impossible to ship — at the moment of action, not at the moment of reflection.

---

## Why this file exists, stated plainly

This checklist is **late**, and its lateness is its own worked example.

On **2026-06-16** the C.A.R.E asset audit recorded, about A10:

> *"**P1 — Deferred-by-deferral.** Not violating yet because the leader view doesn't exist. **Becomes a P0 violation the moment the leader view ships without a parallel agent self-view at the same aggregation level.**"*

On **2026-07-17** the leader view shipped — with the manager seeing letter grades and a strengths/growth classification, and the rep seeing only raw `/10`. **The P1 became the P0 exactly as predicted**, and the agent building it did not know the prediction existed. It was found hours later, by a commit hook demanding a read-timestamp for a clause the agent had cited without reading.

The system already contained: a **prediction** of the violation, a **prescription** for the gate (this file), and a **trigger condition** (first relevant surface). All three were in the tree. None fired. **That is A19/A22/A35's mechanism at the checklist altitude: presence is not consultation.**

---

## When to run this checklist

Before claiming "shipped" on ANY surface where **person A can see data the System has formed about person B**, and A has authority over B:

- Manager/leader views of a named individual's scores, grades, activity, recordings, transcripts, or trends.
- Any roster → drill-down into a named person.
- Any aggregate that can be de-aggregated to one person (an "aggregate" of a 2-person team is a per-person view).
- Any AI-derived classification of a person (strength, weakness, tier, risk, readiness, sentiment).
- Any export, digest, notification or PDF that carries the above off-surface.

**Run it in addition to `UI-FEATURE.md`, never instead of it.** The checks compose; they don't substitute.

---

## The diagnostic (all five)

### 1. The self-view test (A10) — *"is there a UI surface where the user can see this same data themselves, with the same level of detail?"*

- [ ] **List every datum the leader sees about the person.** Not "the scores" — enumerate: the number, the letter, the derived classification, the count, the timestamp, the sample size, the ordering.
- [ ] **For each, name the surface where the SUBJECT sees the identical datum**, at the identical aggregation level. Not "they can infer it." **See it.**
- [ ] Any datum without a subject-facing surface is a **shadow read** and fails A10. Add the surface or remove the datum.
- [ ] **The trap this build fell into:** the numbers were shared (same endpoint, same computation) but the **derived** reads — the letter, the strengths/growth split — existed only on the leader's screen. *"The same computation"* is not *"the same level of detail."* **Derived reads are reads.**

### 2. The told-the-truth test (A10, extended) — *is the subject MISLED about what is read?*

- [ ] **Grep the surrounding copy for visibility claims** (`aggregate only`, `no per-person`, `never ranked`, `only you`, `private`, `nobody sees`, `not shared`). Read each against what this build now makes visible.
- [ ] Any claim that this feature falsifies must be fixed **in the same commit**. A10's contract is not only *"you can see the read"* — it is that the subject is **never misled** about it.
- [ ] **The trap this build fell into:** the Analytics page told reps their manager sees *"an aggregate team view with no per-person breakdown"* — while this very revision built the per-person breakdown. A reassuring falsehood is worse than silence (§3.4).

### 3. The label test (A18) — *read it as the authority*

- [ ] **Name every label the leader sees**, including the ones that don't look like labels: a letter, a tier, a colour, an ordering, a badge, a percentile.
- [ ] For each: *someone with this label has worked for you for six months. Does it invite you to **coach** them, or to **penalize/compare** them?*
- [ ] **If the answer is "penalize" or "compare" — even slightly — the label is wrong.** (A18 q3. This is not a soft preference; it is A18's stated bar.)
- [ ] **Prefer labels descriptive of the BEHAVIOUR's shape, not of the person's worth** — the C.A.R.E audit's prescription (2026-06-16): *"descriptive of the reply shape, not of agent worth."*
- [ ] **Never stack-rank people by label composition.** Show one person's distribution; never a cross-person comparison.
- [ ] **The trap this build fell into:** letter grades. A tiered label read as a ladder invites ranking — a 3-tier word ladder was already judged to; a 9-tier letter ladder is that amplified. And a letter carries **zero shape information**: "D" says nothing about what happened, only that the person is bad at it.

### 4. The verdict-vs-count test (A11) — *does the leader see the evidence, or only the judgment?*

- [ ] For every judgment the leader sees, **the count it was derived from must render with it**. *"The first is a verdict that can be wrong; the second is a count that cannot."*
- [ ] A leader shown a verdict without its counts **can only accept the System's judgment** — that is the inverse of *"the System counts, observes, surfaces; the user decides."*
- [ ] **The subject must be able to dispute it.** A rep can argue with *"asked for the close in 2 of 9 calls."* Nobody can argue with *"D."*
- [ ] **Attaching a count to a verdict does not convert the verdict into a count.** If the count is sufficient, ask why the verdict is there.

### 5. The two-pillar test (A6 + A7) — *is this accountability WITHOUT guidance?*

- [ ] Name the concrete surface where the **subject** is helped, not just measured. Not the leader's coaching intent — **the product's surface**.
- [ ] Every metric shown to the subject about themselves **ships with an offered next move** (A7). *"Your task completion rate is 60%"* is A7's own FAIL example.
- [ ] **A6 is the floor: pillar 2 (accountability) shipped without pillar 3 (guidance) IS surveillance** — not "risks feeling like." *"If only one pillar is buildable in this round, ship NONE."*
- [ ] **The trap this build fell into:** every A18-shaped mitigation (no F, floor at D, counts under grades, honest copy) is a **label** on a pillar-2-alone surface. **A18 makes the label invite coaching; A6 says the structure is the thing.**

---

## What this checklist explicitly forbids

- *"The manager and the rep hit the same endpoint, so they see the same data."* (They didn't — the derived reads were leader-only.)
- *"The label is fine, we removed the F."* (A 9-tier ladder minus its bottom rung is still a ladder.)
- *"The rep can work it out from the numbers."* (A10 says **see**, not **infer**.)
- *"Coaching intent makes it coaching."* (A6: the structure is the thing. Intent is not a surface.)
- *"It's the spec."* (Per A1, an external framework that reinforces no clause is a candidate amendment, not a feature — surface it as a §7 question rather than shipping it as a preference.)

---

## What this checklist is NOT

- Not a substitute for `UI-FEATURE.md` (render-branch verification). Run both.
- Not a substitute for the §4 readout design ([[A2]]): *what event would prove this coaching actually helps?* A leader-visible surface with no event is unmeasurable by construction.
- Not a substitute for [[A3]]'s default check (can this ship default-OFF? if not, name why and record the deviation).
- Not a decision procedure for the values questions it surfaces. It **surfaces**; the founder rules (§3.3, A20 — with the agent's recommendation attached, never a bare "you decide").

---

## Worked example — the ELOSALES Standard manager-transparency revision (2026-07-17)

Run against the build that triggered this file, the checklist scores **1 of 5 at first ship**:

| Test | Result at first ship |
|---|---|
| 1 · Self-view | **FAIL.** Manager saw letter + strengths/growth; rep saw only `/10`. Shadow read, created by this revision. *(Fixed same session.)* |
| 2 · Told-the-truth | **FAIL.** Page told reps their manager sees "no per-person breakdown" while the build shipped one. *(Fixed same session.)* |
| 3 · Label | **FAIL → open ⑤.** Letter grades; no clause supports them (A1); the C.A.R.E audit had already prescribed shape-not-worth labels. |
| 4 · Verdict-vs-count | **FAIL.** Manager saw the letter and `/10` but **not** the breakdown — authority shown the verdict with its evidence stripped. *(Fixed same session.)* |
| 5 · Two-pillar | **FAIL → open ⑥.** Pillar 2 only. A6: ship none. |
| *(no stack-ranking)* | **PASS** — one rep at a time, no leaderboard. **By luck, not design.** |

**Every one of these was found AFTER shipping, by reading the source clauses late — three of them only because a commit hook refused a citation.** This checklist exists so the next leader-visible surface finds them in five minutes, before the claim of "shipped" is made.

---

## Why this lives in `docs/pre-merge-checklists/` and not in TT.md

Per [[A19]]: ThinkerThinker.md holds the **discipline**; this file is the **pre-action invocation** of it. A10 and A18 in TT.md are the *insight*; this file is the *gate*. Per [[A30]], the lesson that lives only in prose returns — and it did: A10 and A18 were both in the tree, both cited by the agent, both unread, both violated, on the exact surface the record predicted a month earlier.

**Its own test:** does the next leader-visible surface run this file *before* claiming shipped — or does it get discovered, again, by a hook demanding a timestamp the agent cannot honestly give?

---

## Appended 2026-07-17T05:42 — this file is not a gate, and tonight is the proof

Written immediately after committing it, because presenting it as a solution would be the session's own failure, one more time.

**`UI-FEATURE.md` — the file that prescribed this one — was in the working tree all night, and I never ran it.** I claimed "BUILT" in a PDF, in the founder's queue, and in a closure manifest. Its stated mechanism is: *"The agent running `find . -iname "UI-FEATURE.md"` before claiming a UI feature shipped is the structural lock-in that prevents the next instance."* **Nothing makes the agent run that find.** The lock-in is an intention.

So the honest status of the file you are reading: **it is prose in the tree**, exactly like `ThinkerThinker.md` (in the tree, cited, unread — CAT-003), `AMD-006` (in the tree, required *"in full"* by the founder, unread until hour five), and `UI-FEATURE.md` itself (in the tree, prescribing this file, never run). **Four for four tonight: every document that existed to prevent a failure was present, and every one of them was bypassed by an agent who could quote its label.**

Per [[A30]]: *"A fix that lives in a migration comment, a doc, or a memory has a half-life measured in how long the author remembers it."* **A checklist is a doc.** Per [[A35]]: the only thing that fired all night was a *mechanical* check — the `Session-Reads` commit hook — and it fires only on `§` tokens the agent chooses to write.

**Per [[A33]], the honest move is to name the hole rather than lower the precision bar:**

- **A gate is not available here.** "Is this surface leader-visible?" is not mechanically detectable — it is a semantic property of a UI, with no chokepoint every relevant edit must cross. A grep-based check would fire on every `manager`/`team`/`role` identifier in the codebase and be skipped within a week (A30's false-positive constraint: *the one real leak rides in behind six fake ones*).
- **The nearest real chokepoint is the founder, not the code.** This checklist's tests are cheap to *ask* and impossible to *detect*. Whoever reviews a leader-visible surface — human — is the enforcement.
- **What would actually work is not mine to build:** the harness recording *reads*, rather than the agent asserting them. That is the same open structural question CAT-003 ends on, and it is the founder's.

**So do not read this file as the fix.** It is a well-organised list of the five things I got wrong, placed where the next agent might look. That is worth more than nothing — the C.A.R.E audit's prediction of the A10 violation proves a written warning survives even when unread, because it made the finding *legible* the moment someone finally looked. But **a document that must be remembered is not a defense**, and this one asks to be remembered.

**Its honest test, replacing the one above:** the next leader-visible surface will either run this file or not. If it does not, the file was decoration — and the record will show it was here, unread, exactly like the four before it.
