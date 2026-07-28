# SYSTEM-PREP.md — Remediation Runbook

> **Purpose:** fix the three structural defects that sit upstream of
> `THINK_BUILD_CHECK.md`, and prepare the repository so the protocol can be
> installed against a sound foundation.
>
> **Run this before installing `THINK_BUILD_CHECK.md`.** Installing enforcement
> on top of a divergent source of truth gates the wrong thing — the manifest
> verifier would demand clause reads that `ThinkerThinker.md` cannot honestly
> satisfy.
>
> **Governed by:** `CLAUDE.md` §7 (amendment process), §1.5 (ripple-trace),
> §2 (surface don't overtake). Assets: `A16`, `A19`, `A22`, `A26`, `A30`, `A33`.

---

## 0. What this fixes

| ID | Defect | Class | Blocks |
|---|---|---|---|
| **R1** | `ThinkerThinker.md` embeds a pre-amendment constitution under the heading `# CLAUDE.md — Project Operating Constitution` | `A16` — two surfaces on shared data contradicting | Protocol install |
| **R2** | Asset **Index by topic** covers to ~A29; library runs to A39 | `A19` — the entry point to the methodology excludes part of the methodology | Topical lookup |
| **R3** | Source prompt references `ThinkThinker.md`; file is `ThinkerThinker.md` | Naming drift across renames | Preflight `find` |
| **R4** | No `docs/` structure for protocol artifacts | Prerequisite | Protocol install |
| **R5** | No amendment authorising the protocol | `§7.4` — CLAUDE.md may not be edited without one | Protocol install |

R1 is the highest-value item in the set and takes about five minutes.

---

## 1. Order, and why this order

```
R1 (divergence)  ──┐
R2 (index)       ──┼──► R4 (docs scaffold) ──► R5 (AMD-007) ──► install protocol
R3 (naming)      ──┘
```

R1–R3 are independent and can run in any order among themselves, but **all three precede R4**. The reason is `A30`: a gate built on an unsound foundation reports green about its own vocabulary, not about the system. Gating clause-reads while two divergent constitutions exist would certify reads of the wrong text.

R5 precedes install because `CLAUDE.md` §7.4 states plainly that its text may only be modified as the consequence of a ratified amendment, and any edit must reference its amendment ID in the commit message.

---

## R1 — Resolve the constitutional divergence

**Clause served:** `A16` (surfaces on shared data must compose, not contradict), `A19` (methodology in the tree), `§7.3` (CLAUDE.md is the derived current state).

### R1.1 Establish the boundary — do not trust a line number

The constitution block ends immediately before the `# Methodology Asset Library` heading. Find it rather than assuming:

```bash
grep -n "^# Methodology Asset Library" ThinkerThinker.md
```

In the copy reviewed, that heading is at line 207, making the constitution block lines 1–205. **Your repo copy may differ.** Use the grep result.

### R1.2 Verify nothing unique is lost — mandatory before deleting

The stale copy might contain a line that was dropped from `CLAUDE.md` rather than added to it. Confirm the direction of the divergence before removing anything:

```bash
LIB=$(grep -n "^# Methodology Asset Library" ThinkerThinker.md | cut -d: -f1)
sed -n "1,$((LIB-2))p" ThinkerThinker.md > /tmp/tt_const.md

python3 - <<'EOF'
tt = open('/tmp/tt_const.md').read()
cm = open('CLAUDE.md').read()
lines = [l.strip() for l in tt.splitlines() if l.strip() and not l.startswith('#')]
missing = [l for l in lines if l not in cm]
print(f"TT constitution lines NOT present in CLAUDE.md: {len(missing)}")
for m in missing:
    print("  -", m)
EOF
```

**Expected result: `0`.** On the copy reviewed, the stale constitution is a strict subset of `CLAUDE.md` — every line of it appears verbatim in the current text, and the divergence is purely by omission (`§0.1`, `§1.5.1`, `§1.5.2`, `§1.7`, `§7`, and checklist items 1a/5a/5b/9 exist only in `CLAUDE.md`).

**If the count is not 0 — STOP.** Something was dropped from `CLAUDE.md` during an amendment. That is a separate finding requiring its own diagnosis under `§1.2`, and it must be resolved before R1.3.

### R1.3 Replace the block with a pointer

**Recommendation, with reasoning (per `A20` — never a bare decision):**

Two options exist. **Pointer is preferred.**

| Option | Cost | Failure mode |
|---|---|---|
| **Pointer** (recommended) | One-time edit | None structural — one source of truth |
| **Sync both copies** | Recurring obligation on every amendment | `A30` class — the sync is held only by memory, and returns the moment someone forgets |

Syncing creates a permanent duty that nothing mechanical enforces. That is the exact shape `A30` was captured to prevent.

Replace lines 1 through the line before `# Methodology Asset Library` with:

```markdown
# ThinkerThinker.md — Methodology Asset Library

> **This file is the asset library only.** Assets A1–A39 below.
>
> **The constitution lives in `CLAUDE.md`** — §0 through §7, plus the ratified
> amendments in `docs/amendments/`. This file previously embedded a copy of the
> constitution under the heading "# CLAUDE.md — Project Operating Constitution".
> That copy had drifted behind AMD-001, AMD-004, AMD-005 and AMD-006 and was
> removed on <DATE> per <AMD-XXX>. Never satisfy a constitutional read from this
> file.
```

Keep the removal note. Per `§1.1`, the record of the defect is an asset; a silent deletion erases the reason the rule exists.

### R1.4 Sweep the class

Per `A26`, the reported instance is one member of a class. The class here is **any file that embeds a copy of governing text rather than pointing at it.**

```bash
grep -rln "Project Operating Constitution" . --include="*.md"
grep -rln "^## 0\. The One Law" . --include="*.md"
grep -rln "Understanding precedes solving" . --include="*.md"
```

Every hit outside `CLAUDE.md` is either a legitimate quotation in context, or another divergent copy. Inspect each; record the verdict.

### R1.5 Gate

Per `A30`, the fix is incomplete until recurrence fails mechanically. This one is precisely detectable, so it earns a gate rather than a decline:

```javascript
// scripts/tbc/verify-single-constitution.mjs
// Fails when any file other than CLAUDE.md contains a constitutional section
// heading, which would indicate a second copy of governing text has appeared.
```

Fail condition: any `*.md` outside `CLAUDE.md` and `docs/amendments/` matching `^##\s*[0-7]\.` or the string `Project Operating Constitution`.

Allowlist entries carry their reason inline. Per `A30`, a bare path list records that someone silenced the check, not that it was safe to.

### R1.6 Acceptance

- [ ] Boundary established by grep, not assumption
- [ ] Subset check returned 0, or the non-zero result was diagnosed separately
- [ ] Pointer block in place, removal note retained
- [ ] Class swept; hits outside `CLAUDE.md` inspected and recorded
- [ ] `verify-single-constitution.mjs` fails on a deliberately reintroduced copy

**Rollback:** `git revert`. The deleted block is a strict subset of `CLAUDE.md`, so no content is recoverable only from the revert.

---

## R2 — Rebuild the asset index

**Clause served:** `A19` (the methodology must be reachable), `A13` (vocabulary authored once, by category).

### R2.1 The defect

The **Index by topic** header states it was rebuilt to cover A1–A23; its tag lists reach roughly A29. The library contains **39 assets**. A30, A33, A35, A36 and A38 are unreachable by topical lookup — which is to say, the five assets that govern build discipline are invisible to the discovery path an agent would use to find them.

### R2.2 Rebuild

Regenerate the index across A1–A39, preserving the existing tag vocabulary. Per `A13`, author the tag space once by category rather than inventing a tag per asset.

Existing top-level tags to preserve: *Communication · Scoping & design practice · System identity · Holistic discipline · Proactive audit / scope & boundary honesty · Builder submission · Security / data-architecture · Recurring-miss → structural fix · Methodology evolution · Discipline under temptation.*

New assets suggest at least one additional category — **gate design** (A30, A33, A35, A38) — covering when to encode a gate, when to decline one, and what a gate cannot see. Confirm before adding; per `A13` a new category is a vocabulary decision, not a filing decision.

### R2.3 Gate

The index will go stale again. It is precisely detectable, so gate it:

```javascript
// scripts/tbc/verify-index-fresh.mjs
// Fails when the highest asset ID appearing in the Index by topic is lower
// than the highest asset ID appearing as a "## A<n>" heading.
```

This is the durable fix. Rebuilding the index without it guarantees a third rebuild.

### R2.4 Acceptance

- [ ] Index covers A1–A39
- [ ] Tag vocabulary preserved; any new category deliberately decided
- [ ] Stale-index gate fails when a new asset is added without indexing it

---

## R3 — Correct the naming drift

**Clause served:** preflight integrity — the prompt's own stop-condition.

The source prompt references `ThinkThinker.md`. The file is `ThinkerThinker.md`. Given this framework has been renamed at least once, treat this as drift rather than a typo, and sweep for every naming state:

```bash
grep -rn "ThinkThinker" . --include="*.md" --include="*.json" --include="*.mjs" --include="*.ts"
grep -rn "THINKX1\|THINKX2" . --include="*.md" --include="*.json" --include="*.mjs" --include="*.ts"
```

Normalise every hit to the current filenames. Check the same names in: the source prompt document, `CLAUDE.md`, asset bodies in `ThinkerThinker.md`, commit hook scripts, and any CI config.

### R3.1 Gate

`THINK_BUILD_CHECK.md` Appendix A specifies `docs/tbc/DOC_MANIFEST.json` with a `path` and `sha256` per governing document. Once `verify-docs.mjs` exists it fails on a missing path, which catches this class permanently. Until then this is a **promise, not a gate** — record it as such.

### R3.2 Acceptance

- [ ] No occurrences of any superseded filename outside intentional historical notes
- [ ] `find . -iname "ThinkerThinker.md"` and `-iname "CLAUDE.md"` both return exactly one hit

---

## R4 — Scaffold the artifact directories

**Clause served:** prerequisite for `THINK_BUILD_CHECK.md` §§3–4, `A36` (residual queue).

```bash
mkdir -p docs/tbc docs/residuals docs/closures scripts/tbc
```

Create `docs/residuals/OPEN.md` with the schema the protocol expects, and seed it with the residuals this runbook generates (§7 below).

Add to `.gitignore`: nothing from these directories. They are the audit trail — per `§3.1`, append-only and never excluded.

### R4.1 Acceptance

- [ ] All four directories exist and are tracked
- [ ] `docs/residuals/OPEN.md` exists with the correct schema and is seeded

---

## R5 — Draft AMD-007

**Clause served:** `§7.4` — `CLAUDE.md` may only be modified as the consequence of a ratified amendment; any edit must reference the amendment ID in the commit message.

Create `docs/amendments/AMD-007-standing-build-protocol.md`. It must clear all six `§7.2` soundness checks; any single failure denies it.

| §7.2 gate | Basis available in the record |
|---|---|
| **1 · Triggered by evidence** | `CAT-001`; the A22→A35 recurrence (three instances in one session); `A38`'s two consecutive sessions substituting a self-chosen subset for the canonical gate |
| **2 · Diagnosed, not preferred** | The protocol currently depends on the founder remembering to paste it. That is `A30`'s "prose lesson will return" operating at the *process* altitude rather than the code altitude — the defence exists and does not fire because invoking it is discretionary |
| **3 · Ripple-traced** | Touches §0.1, §1.5.1, §1.5.2, §1.7, §2, §6. Introduces no contradiction: it operationalizes existing clauses rather than amending them. Adds `tbc` to the `check` script, changing what `A38`'s canonical command covers |
| **4 · Alternative-tested** | The alternative is the current manual-paste process, which was in force during the sessions that produced A35 and A38 and did not prevent either |
| **5 · Outside-view checked** | **Pending — you must run this.** Read the proposal from a stance with no investment in adopting it |
| **6 · Does not soften under pressure** | The protocol increases per-build friction and reduces none. It creates obligations for the builder, not exemptions |

Gate 5 is genuinely open. Per `§7.1` the constitution holds by default and the burden of proof is on the proposer — so an unrun outside-view check means the amendment is not ratified, regardless of how sound the other five look.

### R5.1 Acceptance

- [ ] Proposal written to `docs/amendments/AMD-007-standing-build-protocol.md`
- [ ] All six gates addressed in writing, gate 5 actually performed
- [ ] Status recorded by appending, never by editing (`§7.3`)

---

## 6. The bootstrap problem — read before starting

**The verifier scripts are themselves a build, and the protocol that would govern them is not yet enforced.**

Run this runbook manually under the protocol's discipline: emit the THINK artifacts by hand, build the verifiers, then let the finished verifiers check their own commit. That first self-check is the protocol's real acceptance test — if the artifact schemas cannot be produced for this work, they cannot be produced for any work, and the schema is wrong rather than the builder.

Expect to amend `THINK_BUILD_CHECK.md` during this step. That is the intended outcome, not a failure.

---

## 7. Residuals created by this runbook

Seed these into `docs/residuals/OPEN.md`:

```markdown
- [ ] <date> · SYSTEM-PREP R1 · Class sweep for embedded governing text is complete
      why-unresolved: sweep commands specified, results not yet recorded
      next-action: run R1.4 greps, record verdict per hit

- [ ] <date> · SYSTEM-PREP R2 · "Gate design" tag category decision
      why-unresolved: A30/A33/A35/A38 suggest a category the existing vocabulary
                      lacks; per A13 this is a vocabulary decision, not a filing one
      next-action: founder confirms or declines the new category before rebuild

- [ ] <date> · SYSTEM-PREP R3 · Naming drift is a promise, not a gate
      why-unresolved: DOC_MANIFEST.json and verify-docs.mjs do not exist yet
      next-action: close when verify-docs.mjs ships and fails on a missing path

- [ ] <date> · SYSTEM-PREP R5 · AMD-007 outside-view check (§7.2 gate 5)
      why-unresolved: cannot be self-performed by the proposer
      next-action: read the proposal from a no-investment stance, record the result

- [ ] <date> · SYSTEM-PREP R6 · Verifier scripts unwritten
      why-unresolved: THINK_BUILD_CHECK.md §6.2-6.5 specifies fail conditions,
                      not implementations
      next-action: implement four verify-*.mjs, wire tbc into check
```

---

## 8. Completion criteria

The system is ready for `THINK_BUILD_CHECK.md` when all of the following hold:

- [ ] Exactly one file in the repo contains constitutional text
- [ ] `ThinkerThinker.md` opens as an asset library and says so
- [ ] Index reaches A39, and a gate prevents it lagging again
- [ ] No superseded filenames outside historical notes
- [ ] `docs/tbc/`, `docs/residuals/`, `docs/closures/`, `scripts/tbc/` exist and are tracked
- [ ] `docs/residuals/OPEN.md` seeded
- [ ] AMD-007 drafted and all six `§7.2` gates addressed, gate 5 genuinely run
- [ ] `THINK_BUILD_CHECK.md` in the repo root, one protocol file only

**Then, and only then:** implement the verifiers, wire `tbc` into `check`, and add the `CLAUDE.md` block referencing AMD-007 in the commit message.

---

## 9. What this runbook does not fix

Stated per `A33` and `A35`, so completion is not mistaken for correctness:

- It resolves the *divergence* between the two documents. It does not verify that `CLAUDE.md`'s current text is itself correct — no one has audited the constitution against the incidents that produced it.
- It makes A30–A39 *reachable*. It does not make them *read*.
- It scaffolds the artifact directories. Whether the artifacts get produced honestly is exactly what `THINK_BUILD_CHECK.md` §6 exists to charge for, and exactly what its §7 admits it cannot fully see.

---

*Governed by `CLAUDE.md`. Assets in `ThinkerThinker.md`. Precedes
`THINK_BUILD_CHECK.md` installation.*
