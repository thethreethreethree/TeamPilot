# BUILD-PROTOCOL.md — Standing Build Discipline

> **Status:** Operational. Auto-triggered. Not reference material.
>
> This file converts the THINK · BUILD · CHECK prompts from something the founder
> pastes into something the agent runs unprompted. It is governed by `CLAUDE.md`
> (the constitution) and `ThinkerThinker.md` (the Methodology Asset Library).
> Where this protocol and either of those conflict, they win and this file is
> amended under §7.
>
> **Installation:** see §9. This file does nothing until the CLAUDE.md block in
> §9.1 is present.

---

## 1. Trigger

This protocol runs **automatically**, without founder invocation, on every action in the table below. Per §1.5.2, the audit lens is on for *every build action* — it is not a separate phase the founder requests.

| Action | Protocol | Can it be skipped? |
|---|---|---|
| New feature | BUILD → VERIFY → REPORT → SWEEP | No |
| Bug fix | BUILD → VERIFY → REPORT → SWEEP | No |
| Refactor | BUILD → VERIFY → REPORT → SWEEP | No |
| Migration | BUILD → VERIFY → REPORT → SWEEP | No |
| Copy / UI change | BUILD → VERIFY → REPORT | No |
| Audit request | AUDIT | No |
| Remediation of audit findings | REMEDIATE (BUILD variant) | No |
| Answering a question, no file written | — | N/A |

**"I'll skip the protocol because this change is small" is the §5 builder-under-pressure move.** A30's evidence: the recurrence is not a discipline failure to apologise for, it is proof the fix was structurally incomplete. Small changes are where the protocol is cheapest and most often skipped.

---

## 2. PREFLIGHT — runs before any file is written

> Operationalizes §0.1 (AMD-005), A19, A22.

Emit this block **verbatim, filled in**, before the first edit. If any line cannot be honestly completed, **STOP and escalate** — do not proceed under reconstruction.

```
PREFLIGHT
  methodology-present:
    CLAUDE.md            <path from `find`>            [FOUND | MISSING]
    ThinkerThinker.md    <path from `find`>            [FOUND | MISSING]
    docs/amendments/     <count of AMD files>          [FOUND | MISSING]
  constitution-source-of-truth: CLAUDE.md
  scope: <one sentence — what this build changes>
  canonical-gate: <the command name from package.json, e.g. `npm run check`>
```

### 2.1 Two files, one name — read this before resolving the constitution

`ThinkerThinker.md` **opens with the heading `# CLAUDE.md — Project Operating Constitution`** and embeds a copy of the constitution. That embedded copy is **older than the ratified text** — it predates AMD-004, AMD-005 and AMD-006, so it is missing §0.1, §1.5.1, §1.5.2, §1.7 and §7, and its §6 checklist lacks items 1a, 5a and 5b.

**Consequence:** an agent that reads `ThinkerThinker.md` and believes it has therefore read `CLAUDE.md` is operating on a pre-amendment constitution while sincerely reporting compliance. That is A19's failure mode reproduced by the file layout itself.

**Rule:** `CLAUDE.md` is the sole source of truth for constitutional text. `ThinkerThinker.md` is the sole source of truth for assets A1–A39. Never satisfy a constitutional read from `ThinkerThinker.md`'s header block.

### 2.2 Asset index is stale — do not trust it as an entry point

The **Index by topic** in `ThinkerThinker.md` states it was rebuilt to cover A1–A23, and its tag lists reach roughly A29. The library runs to **A39**. Assets **A30–A39 are unreachable through the index**, including the four that govern this protocol most directly: A30 (gate, not prose), A33 (precise gate or none), A35 (the citation incentive inversion), A38 (the canonical command).

**Rule:** topical lookup is `grep`, not the index, until the index is rebuilt. Treat rebuilding it as an open residual (§7).

---

## 3. UNDERSTANDING — runs before any file is written

> Operationalizes §0, §2 ("diagnose before patching"), §3.2.

```
UNDERSTANDING
  request-restated: <the founder's ask, in my own words>
  why-this-problem-exists: <root cause from the record — logs, prior commits,
                            past failures — not a forward theory>
  record-consulted: <what I actually read to establish the above>
  conflicts-with-framework: <list, or NONE>
  ambiguities: <list, or NONE>
```

**On ambiguities — check for precedent before escalating.** Per A28, a parallel surface's existing pattern often already decides what looks like a founder decision. Per A20, "founder decision needed" is frequently the agent substituting its own quality bar for the founder's. Before any line lands under `ambiguities`:

1. Grep the codebase for a precedent that already decides it. If one exists, follow it and record it as an alignment, not an ambiguity.
2. If no precedent exists, escalate **with a recommendation and its reasoning** — never bare. A bare "how would you like this?" is the A20 offload.

---

## 4. FOUR-LAYER TRACE — user-facing features only

> Operationalizes §1.5.1 (AMD-006). **The clause is executed as output, not quoted as input.** Quoting AMD-006 satisfies nothing; producing this block does.

Evaluate foundation-up. The order is a sieve — a break at layer *n* is not survivable by quality at layer *n+1*.

```
FOUR-LAYER
  1 build-structure:   <is the code organized, data shape sound, decisions
                        defensible — maintainable in six months?>
  2 operational-effect:<invoked the way a real user invokes it, does it deliver?
                        Not "the unit test passes.">
  3 synergetic-comp:   <what does the user do immediately before and after? Does
                        completion leave them flowing, or stalled — empty state,
                        dead end, unnecessary step?>
  4 surface:           <UI/design alignment with the product and the user's
                        mental model>
  verdict: [SHIPPABLE | SHIPPABLE-WITH-FOLLOWUP | NOT-SHIPPABLE]
```

A feature failing layer 3 **must not ship**, however green the tests. A feature passing 1–3 and failing 4 may ship with a follow-up polish commit. Passing 4 while failing any of 1–3 is never shippable.

---

## 5. VERIFICATION — runs before the word "verified" appears anywhere

> Operationalizes A38. **This is the clause most often satisfied in appearance and skipped in substance.**

**"Verified" is not a property of the work. It is a claim about a command you executed.** The agent chooses that command, and given a canonical gate and a faster subset, the subset wins every time — because it is quicker, it covers the files just edited, it passes, and *the report reads identically*. `tsc clean, ESLint clean, tests green` and `npm run check exits 0` are the same sentence to a reader.

**Rule: run the project's canonical command by name and paste what it printed.** Not your recipe — *its* name.

```
VERIFICATION
  canonical-command: <name from package.json — do not paraphrase>
  invoked: [YES | NO]
  output: |
    <pasted terminal output, exit code included>
  coverage: <n>-of-<n> gates run
  not-run: <named gates skipped, with reason — or NONE>
  untested: <behavior claimed but not executed — or NONE>
```

Three constraints:

- **A gate you point at yourself is a mirror, not a gate.** `eslint <files I touched>` cannot fail on anything you did not think to name. The project's gate lists *itself* precisely so it does not depend on the author's list.
- **Report coverage, not verdict.** A stated four-of-six is honest. An unqualified "verified" is a mood.
- **If you do not know the canonical command, finding it is the first action, not the last.** It is written in `package.json` scripts, the CI workflow, and the pre-merge checklist.

Never write *verified*, *green*, *gates pass*, or *confirmed working* without this block above it. Untested behavior is labelled **untested** — always, without softening.

---

## 6. BUILD REPORT

> Operationalizes the THINK_BUILD_CHECK build report, §2 ("explain the WHY"), §A24.

```
BUILD REPORT
  built:
    <path>  — <what it does>  — <clause it satisfies>
    ...
  changed-from-request:
    <what I changed>  — <why>  — <founder approval: SOUGHT | NOT SOUGHT>
  not-completed:
    <what, and why>
  uncertain:
    <what I am not confident works>  → filed to RESIDUALS (§7)
  verification: <reference the §5 block>
```

Two prohibitions, both load-bearing:

- **Do not describe intended behavior as confirmed behavior.** The most dangerous report is one where every individual sentence is true and the aggregate implies more assurance than was earned.
- **Do not manufacture output to appear productive.** Per §A24, under a continuous-output mandate the §5 temptation becomes manufacturing work rather than admitting genuine completion. "Nothing further is needed here" is a valid report.

---

## 7. RESIDUALS — the queue, not the disclaimer

> Operationalizes A36.

**The residual you wrote is the highest-yield queue in the audit — and writing it as a disclaimer is what stops you returning to it.** A line reading "this area may need further review" in a build report is closed the moment it is written. A line in a queue is not.

Every `uncertain`, `not-completed`, and un-swept class from §8 is appended to `docs/residuals/OPEN.md`:

```markdown
- [ ] <date> · <build ref> · <the residual, stated as a checkable claim>
      why-unresolved: <reason>
      next-action: <the specific thing that would close it>
```

At the start of every subsequent build, read `docs/residuals/OPEN.md`. Per §1.1, residuals are assets, not admin.

---

## 8. CLASS SWEEP AND GATE — before any fix is called complete

> Operationalizes A26, A29, A30, A33.

**A reported bug is one instance of a class.** The fix is incomplete until the class is swept to its codebase-wide boundary — and per A30, **the boundary of a class is not the last instance in the code, it is the gate that prevents the next one.**

```
SWEEP
  class: <the general shape of the defect, named>
  boundary-searched: <the grep/glob that defines the search space>
  instances-found: <n>  ·  instances-fixed: <n>
  gate-or-promise: [GATE | PROMISE]
  gate: <the check that will fail on recurrence, by name>
       | <or: DECLINED — see below>
```

### 8.1 When to decline a gate

Per A33, **a gate must be precise or not exist.** A check that fires on correct code is one people learn to skip — and then the real defect rides in behind six false positives. If the pattern resists precise detection:

1. Look for a **chokepoint** where the invariant holds by construction, rather than a detector that pattern-matches.
2. If no chokepoint exists, **name the hole and decline the gate.** Record it in the asset library. Declining honestly is a valid outcome; shipping a noisy gate is not.
3. Every exception a gate tolerates is allowlisted **with its reason**. A bare path list records that someone silenced the audit, not that it was safe to.

### 8.2 High-yield sweep anchors

Per A29, a recent bug **fix** is the best place to look for unswept siblings — a fix made under pressure addresses the reported instance and usually leaves the class. Mine `git log` for recent fixes and sweep their neighbours.

---

## 9. AUDIT PROTOCOL

Triggered on founder request, and proactively per §1.5.2 on the surfaces adjacent to every build.

```
AUDIT PREFLIGHT
  reading: [ACTUAL BUILT FILES | memory of intent]     ← must be the former
  standard: <clauses being audited against, quoted from CLAUDE.md / TT.md>
  inspected: <explicit list of files and surfaces examined>
  NOT-inspected: <explicit list — this is the load-bearing half>
```

Per issue:

```
  file+location: <path:line>
  clause-violated: <§ or A-ID>
  evidence: <the actual code or behavior, quoted — not paraphrased>
  severity: [CRITICAL | HIGH | MEDIUM | LOW]
  class-check: <does this shape appear elsewhere? Where did I look?>
```

Then a remediation plan: each issue, the fix, the clause the fix satisfies, the risk the fix introduces, and — per §8 — whether the fix ships a gate or a promise.

**Two symmetric prohibitions.** Do not fabricate issues to appear thorough. Do not omit issues to appear successful. **Do not report a clean bill of health for anything you did not inspect** — the `NOT-inspected` list is what makes the audit honest, and an empty flag list at any layer is itself a suspicious finding worth questioning (§1.7).

### 9.1 Proactive audit is not optional

Per §1.5.2: **THINK first, then search.** Form hypotheses about how the surface and its neighbours could fail before grepping; the hypotheses guide the search and the search confirms or denies them. Five sharp findings you thought through beat fifty from pattern-matching. The bar for surfacing: evidence, or a clear path to confirm — not "things SaaS tools usually get wrong."

This does not license refactoring without need, blocking on perfection, or drowning the founder. Ship the requested task; concerns become follow-up proposals. The founder retains decision authority on every proposal.

---

## 10. CLOSURE — the un-hooked half

> Operationalizes A22 and A35. **Read this section before declaring any multi-commit build complete.**

The `Session-Reads` commit hook enforces A22's manifest by grepping the diff for `§` tokens. It works, and its scope is its limit.

**A35's finding: the hook's cost attaches to the citation, not to the reliance.** Write `§A11` in a comment and you owe a timestamp you cannot honestly fabricate. Build the same surface on cached memory of A11 and name nothing, and no gate fires. The compliant-looking move and the compliant move come apart — **an agent under output pressure that learns citing is expensive learns to stop citing, and the codebase gets quieter and less compliant at the same time, its audit trail improving as its behavior degrades.**

There is no precise detector for "this code should have consulted A11," and per A33 a check on it would be worse than nothing. So this is prose, deliberately, and it is asked out loud at every closure:

```
CLOSURE
  cited-and-read:
    <§/A-ID>  — re-read at <in-session timestamp>  — <one concrete way this
                build's runtime behavior embodies or violates its intent>
    ...
  leaned-on-without-naming:
    <which clauses did this build actually depend on that I never cited?>
    → open each. Report what you find.
  green-hook-caveat: A green Session-Reads trailer certifies only that what I
                     NAMED I READ. It says nothing about what I quietly relied on.
```

**Before writing any new asset:** `grep ThinkerThinker.md` for its thesis first. Per A35, the confidence that an insight is novel is generated by the same compression that hides the asset already holding it. If it feels fresh and important, that is evidence you should search — not evidence you should write.

---

## 11. Where this protocol stops

Stated plainly, per A33 and A35, so nobody mistakes protocol compliance for correctness:

| This protocol enforces | This protocol cannot enforce |
|---|---|
| That the methodology files are present | That the right assets were the ones consulted |
| That citations were read | That un-cited reliance was read (§10) |
| That the canonical command ran | That the canonical command covers the real risk |
| That a class was swept to a stated boundary | That the boundary was the true boundary |
| That residuals were queued | That residuals get worked |
| That a gate was shipped or declined | That the gate is precise enough to be heeded |

A green protocol run is a statement about the protocol's vocabulary, never about the system. **An audit cannot detect the class it has no concept of.**

---

## 12. Installation

### 12.1 CLAUDE.md block — required

This file is inert until the following is present in `CLAUDE.md`. Add it under §2 ("How the Agent Must Behave"), referencing its amendment ID per §7.4.

```markdown
### 2.1 Standing build protocol

> Added by [AMD-XXX](docs/amendments/AMD-XXX-standing-build-protocol.md).

`BUILD-PROTOCOL.md` is operational, not reference. It runs automatically on
every build action per its §1 trigger table — no founder invocation required.

Before writing any file, the agent emits the PREFLIGHT and UNDERSTANDING
blocks. Before writing "verified", it emits the VERIFICATION block naming the
canonical command. Before declaring closure, it emits the CLOSURE block
including the un-named-reliance half.

Skipping the protocol because a change seems small is the §5 failure mode and
is forbidden. If the protocol conflicts with this constitution, the
constitution wins and BUILD-PROTOCOL.md is amended under §7.
```

### 12.2 Amendment required

Per §7.4, `CLAUDE.md` may only be modified as the consequence of a ratified amendment. Draft `docs/amendments/AMD-XXX-standing-build-protocol.md` against the §7.2 soundness gate:

| Gate | Basis available in the record |
|---|---|
| 1 · Triggered by evidence | CAT-001; the A22→A35 recurrence; A38's two-consecutive-sessions gate substitution |
| 2 · Diagnosed, not preferred | The founder currently pastes THINK_BUILD_CHECK manually — the discipline depends on founder memory, which is A30's "prose lesson will return" at the process altitude |
| 3 · Ripple-traced | Touches §0.1, §1.5.1, §1.5.2, §1.7, §2, §6; introduces no contradiction — it operationalizes rather than amends |
| 4 · Alternative-tested | The alternative is the current manual-paste process, which did not prevent A35 or A38 |
| 5 · Outside-view checked | Pending |
| 6 · Does not soften under pressure | This protocol increases per-build friction; it reduces none |

### 12.3 Open residuals created by this file

File these to `docs/residuals/OPEN.md` on installation:

```markdown
- [ ] Reconcile ThinkerThinker.md's embedded constitution with CLAUDE.md
      why-unresolved: TT.md carries a pre-AMD-004/005/006 copy under the
                      heading "# CLAUDE.md — Project Operating Constitution"
      next-action: replace the embedded block with a pointer to CLAUDE.md, so
                   there is exactly one constitutional source of truth

- [ ] Rebuild ThinkerThinker.md's Index by topic
      why-unresolved: index covers to ~A29; library runs to A39, so A30, A33,
                      A35, A36 and A38 are unreachable by topical lookup
      next-action: regenerate the index and add a gate that fails when the
                   highest indexed asset lags the highest captured asset

- [ ] Correct "ThinkThinker.md" → "ThinkerThinker.md" in THINK_BUILD_CHECK
      why-unresolved: the prompt's own stop-condition ("if you cannot locate
                      either file, stop") fires on a literal `find` for the
                      misspelled name
      next-action: fix the string in the source prompt
```

---

*Governed by `CLAUDE.md`. Assets referenced live in `ThinkerThinker.md`. This
file is amended only under §7.*
