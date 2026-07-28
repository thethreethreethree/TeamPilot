# THINK_BUILD_CHECK.md — Automatic Build Protocol

> **Status:** operational protocol. Adopting it as *mandatory* is a constitutional
> change and must clear §7.2. The amendment proposal is in Appendix C.
>
> **Governs:** every substantive build action in this repository.
> **Trigger:** automatic. See §1. The agent does not wait to be asked.

---

## 0. Why this file exists

`A38`'s closing line records four things in a single session that were **present,
correct, and bypassed**: ThinkerThinker.md unread, AMD-006 unread, `UI-FEATURE.md`
never run, `npm run check` never invoked. Each was a real defense. None of them
fired, because each required the agent to *choose* to invoke it.

The build/audit/remediate prompt this protocol replaces has the same shape: it works
when pasted, and it is absent when not pasted. `A30` states the terminal form of this
problem — *a lesson recorded only in prose will return; a fix is not complete until
the class is encoded in a gate that fails without the author's cooperation.*

This file is the gate. Its requirements are artifacts, not intentions. Every phase
below ends by writing a file with a checkable schema, and §6 defines the scripts that
fail the build when those files are absent, stale, or internally inconsistent.

**The design rule for everything below:** if a requirement can be satisfied by the
agent *saying* it did something, it is not a requirement. It must be satisfiable only
by the agent *producing something a script can read*.

---

## 1. Trigger conditions

TBC fires automatically. There is no invocation step and no founder prompt.

| Trigger | Phases required |
|---|---|
| Any new feature, surface, route, table, column, or migration | Full: THINK → BUILD → CHECK → REMEDIATE → CLOSE |
| Any bug fix | Full (the class sweep in CHECK is the point — see `A26`) |
| Any refactor touching >1 file | Full |
| Any change to shared state, schema, RLS, or cross-module behavior | Full |
| Single-file change, no shared state, no schema | THINK (short form) → BUILD → CHECK (scoped) → CLOSE |
| Typo, comment, formatting, doc-only edit | Exempt — record in `closure.residual` if it touches a governed doc |
| Any edit to `CLAUDE.md`, `ThinkerThinker.md`, or `docs/amendments/` | §7 amendment process, not TBC |

**When in doubt, run the full protocol.** The cost of over-running TBC is minutes.
The cost of under-running it is `CAT-001`.

**Continuous-mandate note (`A24`, `A36`).** When the obvious work queue is empty, the
agent does **not** manufacture a build to have output. It opens the residual queue
(§4.5) and works it. An empty residual with an empty backlog is a legitimate report
of completion, and saying so is not failure.

---

## 2. The state machine

```
        ┌──────────┐
        │  THINK   │  produce think.md      — cannot be skipped
        └────┬─────┘
             │ gate: doc integrity + session-read manifest + hypotheses
             ▼
        ┌──────────┐
        │  BUILD   │  produce build.md      — spec-fidelity enforced
        └────┬─────┘
             │ gate: canonical command run BY NAME + reachability assertions
             ▼
        ┌──────────┐
        │  CHECK   │  produce check.md      — audits the artifact, not the intent
        └────┬─────┘
             │ gate: within-module AND cross-module passes + class sweep
             ▼
      findings? ──no──► ┌───────┐
             │          │ CLOSE │  produce closure.md
            yes         └───────┘
             ▼
        ┌───────────┐
        │ REMEDIATE │  produce remediate.md
        └────┬──────┘
             │ gate: re-run CHECK on the fixes (loop max 2 — see §5.3)
             └──────► CLOSE
```

All five artifacts live in `docs/tbc/<YYYY-MM-DD>-<slug>/`. The directory is the unit
of record. A build with no directory did not happen.

---

## 3. Phase specs

### 3.1 THINK

**Cannot be skipped, cannot be abbreviated below the short form, and produces
`think.md` before any file is edited.**

#### 3.1.1 Document integrity (§0.1, `A19`)

Run and paste the literal output:

```bash
find . -iname "CLAUDE.md" -o -iname "ThinkerThinker.md"
sha256sum CLAUDE.md ThinkerThinker.md
wc -l CLAUDE.md ThinkerThinker.md
```

Compare the hashes against `docs/tbc/DOC_MANIFEST.json` (§Appendix A). Three outcomes:

- **Match** → proceed.
- **Mismatch** → the governing documents changed since the manifest was written.
  **Stop.** Report which file changed and its new hash. A changed constitution
  without a corresponding `AMD-XXX` is a §7.4 violation and must be surfaced, not
  absorbed.
- **Missing** → escalate per §0.1 verbatim: *"the methodology source for this domain
  is not in the working tree — should I request it, or proceed under reduced
  confidence?"* Do not proceed on cached labels.

#### 3.1.2 Session-read manifest (`A22`, `A35`)

This is the clause the prior prompt was missing, and it is the reason for this
protocol's existence.

The prior prompt charged for the **citation** — *"quote the specific clauses that
govern this build."* `A35` names the resulting gap exactly: *the hook charges for the
citation, not the reliance, so the check is dodged by staying quiet.* An agent that
cites nothing is charged nothing.

**Therefore: the manifest is required whether or not the agent intends to cite
anything.** Its scope is not "what I will cite" but **"what governs this work."**

For each governing clause and asset:

```json
{
  "id": "A26",
  "read_at": "2026-07-28T09:14:22Z",
  "source_file": "ThinkerThinker.md",
  "line_range": "861-892",
  "why_it_governs": "This is a bug fix; A26 defines the completion criterion as class-swept, not instance-fixed.",
  "how_this_build_will_embody_it": "The sweep boundary will be a repo-wide grep for the root shape, recorded in check.md §class_sweep."
}
```

Rules:

- `read_at` must be **this session**. "Earlier session" or "I remember it" → stop,
  open the file, read it, then write the timestamp.
- `line_range` must be real. The gate script in §6.2 verifies the range exists and
  that the ID appears within it.
- `why_it_governs` in the agent's own words. A restatement of the asset title is not
  a reason.
- **Minimum set, always:** §0, §0.1, §1.5.1 (all four layers), §1.5.2, §6, `A19`,
  `A22`, `A30`, `A38`. Plus every asset the work's shape implicates.

**Where to read AMD-006 from.** Its full text is `CLAUDE.md` §1.5.1 and §1.5.2.
It is **not** in `ThinkerThinker.md` — see §Appendix A, DIVERGENCE. Reconstructing
AMD-006 from asset entries that merely reference it is the `A22` failure with extra
steps.

#### 3.1.3 Hypotheses before search (§1.5.2)

§1.5.2 is explicit that thinking precedes searching: *form hypotheses about how the
surface and its neighbors could fail or could be improved; hypotheses guide the
search; the search confirms or denies them.* Grep-first is non-compliant.

Write, before touching the codebase:

```json
{
  "hypotheses": [
    {
      "id": "H1",
      "claim": "The write path for <column> may not exist — A31 class.",
      "confidence": "medium",
      "test": "grep for INSERT/UPDATE naming the column across app/ and api/",
      "outcome": null
    }
  ]
}
```

Every hypothesis carries a test. Every `outcome` is filled in during BUILD or CHECK.
A hypothesis with a permanently null outcome is a residual entry, not a closed item.

#### 3.1.4 Specification fidelity

- Restate the request in the agent's own words.
- State explicitly: *does this match the request as written, or a version I find
  cleaner?*
- List every point where the request and the framework conflict, and every ambiguity.
- **Do not resolve ambiguity silently.** Surface it. Per `A20`, surfacing is not
  offloading — each surfaced item carries a recommendation, never a bare "you decide."
- Per `A28`: before flagging anything as a founder decision, search for a codebase
  precedent that already decides it. Record the search. A precedent found converts a
  flag into an alignment.

#### 3.1.5 Four-layer pre-walk (§1.5.1)

For user-facing work, walk the layers **in order, foundation up**, before building:

| Layer | Question | Recorded as |
|---|---|---|
| 1 · Build structure | Is the code organization, data shape, and architecture defensible in six months? | `layers.structure` |
| 2 · Operational effectivity | Invoked the way a real caller invokes it, does it deliver? | `layers.effectivity` |
| 3 · Synergetic composition | What does the user do immediately before and after? Does this leave them flowing or stalled? | `layers.composition` |
| 4 · Interface and design | Does the surface match the substance? | `layers.surface` |

The order is a sieve. A failure at layer N is not survivable by quality at N+1.
Passing 1–3 and failing 4 may ship with a follow-up. Passing 4 and failing any of
1–3 is **never shippable**.

**THINK gate:** `think.md` exists, hashes match, every manifest entry has a
this-session timestamp and a verified line range, ≥1 hypothesis with a test, layers
walked in order. Fail any → BUILD does not start.

---

### 3.2 BUILD

**Produces `build.md`. Build the specification as written, governed by the framework.**

#### 3.2.1 The fidelity rule

Deviating from the request *or* the framework because it is "better practice" is a
violation, not an improvement. If a deviation is genuinely necessary, **stop and flag
before acting** — not after, and not in the report.

#### 3.2.2 Reachability, not file inventory (`A31`)

The prior prompt asked for *"what was actually built, file by file."* File-by-file is
the exact altitude at which `A31` failed seven times in one session: schema correct,
views correct, page correct, and the feature could never have worked because nothing
could write the column.

**File-by-file is necessary and insufficient.** For every feature, assert both
directions of the seam:

```json
{
  "feature": "problem_id tagging on cost lines",
  "files": ["migrations/0191_...", "app/costs/page.tsx", "api/costs/route.ts"],
  "write_path": {
    "exists": true,
    "where": "app/costs/CostRow.tsx:142 — picker writes problem_id",
    "human_can_set": true
  },
  "read_path": {
    "exists": true,
    "where": "app/analytics/cost-per-outcome/page.tsx:88",
    "human_can_see": true
  }
}
```

If `write_path.exists` is false or `read_path.exists` is false, the feature status is
`NOT_BUILT` regardless of schema correctness. Not "incomplete" — **not built.**

**Dead config is the worst instance.** A settings column that nothing writes *and*
nothing reads makes a promise to every future reader that a control exists. Either
wire it or do not ship it.

#### 3.2.3 Verification is a command, not a mood (`A38`)

Before the word "verified," "green," or "passing" appears anywhere:

1. Run the project's **canonical** command **by its name**: `npm run check`.
2. Paste what it printed, including exit code.
3. Report **coverage, not verdict.** "npm run check — all six, exit 0" is checkable.
   "Gate-verified" is a mood.

A self-scoped substitute — `npx eslint <files I chose to name>` — is strictly weaker
and its weakness is invisible. **A gate you point at yourself is not a gate; it is a
mirror.** If the canonical command is too slow for a given commit, state explicitly
which gates ran and which did not. A stated four-of-six is honest; an unqualified
"verified" is not.

Anything not executed is labelled `UNTESTED`. Intended behavior is never described in
the register of confirmed behavior.

#### 3.2.4 Clause mapping

For each part of the build, name the clause it satisfies and the manifest entry that
governed it. A citation whose ID is absent from §3.1.2's manifest fails the gate in
§6.2 — this is the `A35` closure: **the citation must resolve to a read, or the build
does not close.**

**BUILD gate:** `build.md` exists; every feature has write-path and read-path
assertions; canonical command output pasted with exit code; every citation resolves
to a manifest entry; every `UNTESTED` labelled.

---

### 3.3 CHECK

**Produces `check.md`. Audits the built artifact, never the intent.**

#### 3.3.1 Read the files, not the memory

State explicitly that the audit read the built files. Where the audit relies on a
file's content, cite path and line. An audit conducted against what the agent
*intended* to build is not an audit.

#### 3.3.2 Two passes, both required (`A21`)

- **Within-module.** Each changed surface against the four layers of §1.5.1.
- **Cross-module.** A feature-concept inventory: *which concepts in this change exist
  under the same name elsewhere in the codebase?* Verify parity for each. `A21`'s
  triggering incident was two surfaces named "Team" asserting opposite philosophies —
  invisible to any within-module audit.

A CHECK with no cross-module pass is incomplete, not clean.

#### 3.3.3 Class sweep (`A26`, `A29`)

Every finding is an instance of a class. For each:

1. **Name the class by its root shape**, not its symptom or location.
2. **Find the boundary** — a repo-wide grep/glob, not the neighborhood of the first
   find. Record the command.
3. **Verify each candidate adversarially.** A pattern match is a *suspect*, not a
   defect. Read each intentional exception; do not assume it.
4. **Fix real instances. Flag the ones turning on a founder decision** — with a
   recommendation and a precedent search (`A20`, `A28`).
5. **Record the swept boundary** as a baseline for the next §1.7 audit.

`A29`: recent bug **fixes** are high-yield sweep anchors. A fix under pressure
addresses the reported instance and usually leaves the class unswept. Mine
`git log` for recent fixes and sweep their siblings.

#### 3.3.4 Gate-the-lesson (`A30`)

For every finding fixed, answer in `check.md`:

> **Is this fix a gate, or a promise?** What would have to be true for this to come
> back, and does anything mechanical notice?

If prose is the only thing preventing recurrence, the fix is **not finished**. Either
encode a check, or record explicitly under `A33` that the pattern resists precise
detection and prose is the deliberate choice — with the reason.

**The false-positive constraint is load-bearing.** A gate that cries wolf on correct
code is one people learn to skip, and the real leak rides in behind six fake ones.
Every exception must be allowlisted **with its reason**. A bare path list records only
that someone silenced the audit, never that it was safe to.

#### 3.3.5 Empty findings are suspicious (§1.7.3)

An empty flag list at a layer is itself a finding worth questioning. If a layer
returns clean, state what was inspected to reach that conclusion. **Never report a
clean bill of health for a component that was not inspected** — list what was
inspected and what was not, and the latter becomes residual (§4.5).

#### 3.3.6 Severity scale

Undefined severity makes audits incomparable across sessions, which breaks §1.2.

| Level | Definition |
|---|---|
| `CRITICAL` | Data exposure, cross-tenant leak, privilege escalation, or silent financial misstatement. Blocks all work. |
| `HIGH` | Feature does not work as promised, or a surface asserts an invariant the write path does not enforce (`A27`). Blocks the closure. |
| `MEDIUM` | Layer 1–3 defect that degrades but does not break. Fix this cycle or record as residual with a date. |
| `LOW` | Layer 4, polish, or naming. May ship with a follow-up commit. |
| `NOT_A_DEFECT` | Diagnosed as intentional under the constitution. Requires an on-the-record diagnosis (`A15`) — closes the flag legitimately, without code change. |

#### 3.3.7 Honesty in both directions

Do not fabricate findings to appear thorough. Do not omit findings to appear
successful. `A24`: under a continuous-output mandate, the temptation is to
**manufacture** output rather than admit genuine completion. Both inflation and
suppression are violations.

**CHECK gate:** both passes recorded; every finding has file, line, clause, quoted
evidence, and severity; every finding has a named class and a recorded sweep command;
every fix answers gate-or-promise; inspected/not-inspected lists present.

---

### 3.4 REMEDIATE

**Produces `remediate.md`. Applies the plan from CHECK — not a redesign.**

- Each fix restates which finding it closes and which clause it satisfies.
- Surface any fix that conflicts with the framework or with another fix **before**
  acting.
- `A32`: **advice is subject to the same verification as findings.** A recommendation
  the founder will rationally act on is a §3.3 overtake wearing the costume of
  guidance. Do not recommend an action that has not been designed — **the design is
  the confirmation.** If a fix was recommended in CHECK as "cheap," design it before
  the founder reads that word.
- Report per file: what changed, which finding it closed, which clause governs it,
  what remains unresolved, what is untested.
- Re-run the canonical command by name. Paste output.

**REMEDIATE gate:** every finding from CHECK has a disposition (`FIXED` /
`FLAGGED` / `NOT_A_DEFECT` / `RESIDUAL`); canonical command re-run; no fix shipped on
an unverified recommendation.

---

### 3.5 CLOSE

**Produces `closure.md`.**

Required sections:

1. **Session-read manifest** — carried from `think.md`, plus anything read later.
2. **Build inventory** — features with write-path/read-path status.
3. **Verification record** — canonical command name, output, exit code, coverage.
4. **Findings ledger** — every finding, severity, disposition, class boundary swept.
5. **Gates added** — what now fails mechanically that did not before.
6. **Residual queue** — see below.
7. **Hypothesis outcomes** — every H from THINK, resolved or moved to residual.
8. **Doc hashes** — the governing document hashes this build was conducted against.

---

## 4. The residual queue (`A36`, `A26`)

`A36` is the sharpest operational finding in the asset library and the prior prompt
does not implement it. The prompt asks for *"anything you could not complete"* —
which is precisely the **disclaimer grammar** `A36` identifies as the mechanism that
closes the door. *"Not assessed," "no obvious hook," "stated, not claimed clean"*
read as the end of an audit rather than the start of one.

`A36`'s record: seven times the agent asserted "no obvious hook," seven times it was
wrong, and four of the last five real findings came from the residual rather than
from the audit — in code already reported as sound.

**Therefore the residual is a work queue with a schema, not a paragraph:**

```json
{
  "id": "R-2026-07-28-03",
  "item": "A16 — multiple AI surfaces on shared data",
  "why_skipped": "Cached summary read as 'AI tools composing on a draft'; felt irrelevant to a cron.",
  "confidence_it_does_not_matter": "high",
  "opened_at": null,
  "outcome": null
}
```

Two rules, both cheap:

1. **A residual is a work queue, not a footnote.** An audit that closes with an
   un-worked residual is *bounded*, which is honest — but the bound is a to-do, not a
   result. Schedule its reading before closure.
2. **"No obvious hook" is a hypothesis, not a finding, and costs one read to test.**
   **Rank the residual by how sure you are it does not matter, and read from the top
   of that list.** Confidence about irrelevance is generated by the summary, and the
   summary is exactly what is wrong — *the cached label that made it feel irrelevant
   is the cached label that let you violate it.*

The gate in §6.4 sorts the residual by `confidence_it_does_not_matter` descending and
fails closure if the top entry has `opened_at: null`.

---

## 5. Stop conditions and escalation

### 5.1 Hard stops

The agent stops and reports, rather than proceeding, when:

- A governing document is missing or its hash does not match the manifest.
- The request and the framework conflict irreconcilably.
- A deviation from the specification appears necessary.
- A `CRITICAL` finding is open.
- The canonical command fails and the failure is not from this build.
- A constitutional edit is required (→ §7 amendment, not TBC).

### 5.2 No error loops (§2)

If a fix fails, **STOP.** Do not retry variations. A repeated failure means the
*identification* was wrong, not the implementation. Return to the Understanding Gate
and re-diagnose from the record.

### 5.3 Loop ceiling

CHECK → REMEDIATE → CHECK may run at most **twice**. A third iteration is evidence of
misdiagnosis under §5.2 and escalates to the founder with the record of both attempts.

### 5.4 Escalation format

Never a bare "you decide" (`A20`). Every escalation carries: what was found, what the
options are, which the agent recommends, why, what the recommendation was verified
against (`A32`), and what precedent search was run (`A28`).

---

## 6. Enforcement — the gates

Per `A30`, this protocol is worthless if it depends on the agent remembering to run
it. These are the mechanical checks. **Prose above, gates here.**

### 6.1 Wire into the canonical command

```json
{
  "scripts": {
    "tbc:docs":     "node scripts/tbc/verify-docs.mjs",
    "tbc:manifest": "node scripts/tbc/verify-manifest.mjs",
    "tbc:artifacts":"node scripts/tbc/verify-artifacts.mjs",
    "tbc:residual": "node scripts/tbc/verify-residual.mjs",
    "tbc":          "npm run tbc:docs && npm run tbc:manifest && npm run tbc:artifacts && npm run tbc:residual",
    "check":        "typecheck && lint && theme:audit && rls:audit && invariant:audit && tbc && test"
  }
}
```

Adding `tbc` to `check` is the load-bearing line. It makes the protocol part of the
command `A38` requires the agent to run by name, so the protocol cannot be bypassed
without the bypass showing up as a red gate.

### 6.2 `verify-manifest.mjs` — closes the `A35` gap

Fails when:

- Any `§`/`A\d+` citation in the session's commit messages, code comments, or
  `docs/tbc/<dir>/*.md` has **no** corresponding manifest entry.
- Any manifest entry's `read_at` predates the session start.
- Any `line_range` does not exist in the named file, or the entry's ID does not appear
  within it.
- The minimum-set clauses (§3.1.2) are absent.

The last condition is the `A35` fix: because the minimum set is required
unconditionally, **staying quiet no longer dodges the check.**

### 6.3 `verify-artifacts.mjs`

Fails when: any phase artifact is missing for a triggering change; any feature in
`build.md` lacks write-path/read-path assertions; any use of "verified"/"green"/
"passing" is not adjacent to a pasted canonical-command output with an exit code; any
finding in `check.md` lacks class, sweep command, or severity; any fix lacks a
gate-or-promise answer.

### 6.4 `verify-residual.mjs`

Fails closure when the residual sorted by `confidence_it_does_not_matter` descending
has `opened_at: null` at the top. Implements `A36`'s ranking rule mechanically.

### 6.5 `verify-docs.mjs`

Fails when `CLAUDE.md` or `ThinkerThinker.md` hashes differ from `DOC_MANIFEST.json`
without a matching `AMD-XXX` in `docs/amendments/` — enforcing §7.4.

### 6.6 Pre-commit hook

```bash
#!/usr/bin/env bash
# .husky/pre-commit
set -e
npm run tbc:docs
npm run tbc:manifest
```

Cheap checks at commit time; the full set in CI. Both altitudes, per `A38`'s note that
enforcement existing at three altitudes did not help when none was invoked.

### 6.7 The gate's own honesty

Every allowlisted exception carries its reason inline. A bare path list is a disabled
check that records only that someone silenced it. If any of these gates produces
false positives in practice, **fix the gate or delete it** — a noisy gate is one
people learn to skip, and that is worse than no gate.

---

## 7. What this protocol is NOT

Per §1.5.2's own limits:

- Not a license to refactor without explicit need.
- Not permission to block on perfection.
- Not a reason to drown the founder in findings. **Five sharp findings the agent
  thought through beat fifty from grep pattern-matching.**
- Not a replacement for founder judgment. The founder retains decision authority on
  every proposal.

The agent **ships the requested task** even when the audit finds concerns. Concerns
become follow-up proposals or commits, not blockers. The actual blockers remain
§3.2 (Understanding Gate) and §7 (Default Deny) — plus `CRITICAL` findings.

TBC must never become a delay mechanism. §1.7.5 anticipates exactly this abuse.

---

## Appendix A — Document manifest

`docs/tbc/DOC_MANIFEST.json`:

```json
{
  "generated_at": "<ISO8601>",
  "documents": [
    { "path": "CLAUDE.md",         "sha256": "<hash>", "lines": 0, "role": "current constitutional state" },
    { "path": "ThinkerThinker.md", "sha256": "<hash>", "lines": 0, "role": "asset library A1-A39" }
  ]
}
```

Regenerate only as the consequence of a ratified amendment. Reference the `AMD-XXX`
in the commit message.

### DIVERGENCE — read this before citing anything

**The two files do not contain the same constitution.** `ThinkerThinker.md`'s embedded
constitution (its lines 1–206) is a **pre-amendment copy**. Verified absent from it:

| Section | In `CLAUDE.md` | In `ThinkerThinker.md` |
|---|---|---|
| §0.1 Precondition gate (AMD-005) | present | **absent** |
| §1.5.1 Four-layer framework (AMD-006) | present | **absent** |
| §1.5.2 Proactive audit (AMD-006 2nd addendum) | present | **absent** |
| §1.7 Ground-up auditing (AMD-004) | present | **absent** |
| §7 Amendment process (AMD-001) | present | **absent** |
| §6 checklist items 1a, 5a, 5b, 9 | present | **absent** (stops at 8) |

`ThinkerThinker.md` references AMD-006 fourteen times inside asset entries (`A21`,
`A31`, `A37`) but **never contains its text.** An agent instructed to quote AMD-006
and pointed at `ThinkerThinker.md` will find references and reconstruct the clause
from them — a fabrication produced by the enforcement mechanism itself.

**Until this is resolved:**

- `CLAUDE.md` is the sole source for §0–§7 constitutional text.
- `ThinkerThinker.md` is the sole source for assets `A1`–`A39`.
- Neither is a substitute for the other, and `ThinkerThinker.md`'s §0–§6 must not be
  read as current.

**Recommended fix (founder decision, with recommendation per `A20`):** replace
`ThinkerThinker.md`'s lines 1–206 with a pointer — *"Constitution: see `CLAUDE.md`.
This file is the asset library."* Rationale: two divergent copies of a governing text
is the `A16` class (multiple surfaces on shared data must compose, not contradict)
applied to the constitution itself. The alternative — syncing both copies — creates a
recurring sync obligation held only by memory, which is the `A30` class. Pointer
preferred.

---

## Appendix B — Artifact skeletons

```
docs/tbc/2026-07-28-cost-tagging/
├── think.md        # integrity, manifest, hypotheses, spec fidelity, layer pre-walk
├── build.md        # inventory w/ reachability, canonical output, clause map
├── check.md        # both passes, findings w/ class sweep, gate-or-promise
├── remediate.md    # dispositions, re-run output      [omit if no findings]
└── closure.md      # 8 required sections incl. residual
```

`think.md` minimum front-matter:

```yaml
---
tbc_version: 1
trigger: feature
started_at: 2026-07-28T09:12:00Z
doc_hashes:
  CLAUDE.md: <sha256>
  ThinkerThinker.md: <sha256>
manifest_entries: 11
hypotheses: 4
---
```

---

## Appendix C — AMD-007 proposal

> Making TBC mandatory adds a rule governing agent behavior. Per §7.4, that may only
> happen as the consequence of a ratified amendment. Dropping this file in without
> §7.2 would be the exact "reduces friction for the builder" shortcut §7.2.6 rejects
> — and adopting a discipline protocol by violating the amendment process would be a
> `A9` failure at the meta-altitude.
>
> File as `docs/amendments/AMD-007-automatic-build-protocol.md`.

**§7.2 soundness gate:**

**1. Triggered by evidence.** `A38`, 2026-07-17: four defenses present, correct, and
bypassed in one session — ThinkerThinker.md unread, AMD-006 unread, `UI-FEATURE.md`
never run, `npm run check` never invoked. `A22`, 2026-06-19: ~3,800 LoC of
constitutional citations from cached memory. `CAT-001`, 2026-06-16. In each, the
existing rule was correct and produced wrong behavior because invocation was
discretionary.

**2. Diagnosed, not preferred.** The existing rules fail for a stated mechanism, not a
missing one. `A22`: the citation mechanism runs at the speed of language, the reading
mechanism at the speed of attention; they drift, and labels accumulate while content
fades. `A35`: the enforcement charges for the citation rather than the reliance, so
silence dodges it. `A38`: the claiming mechanism runs at the speed of a summary, the
verification mechanism at the speed of a command. All three describe a **fast half
impersonating a slow half**, and none is fixed by intending better. The amendment
attaches the slow half to an artifact a script reads.

**3. Ripple-traced.** Touches §0.1 (integrity check becomes mechanical, unchanged in
substance); §1.5.1 (pre-walk becomes a recorded artifact); §1.5.2 (hypotheses become
schema'd); §1.7 (TBC's CHECK is a scoped ground-up audit — §1.7.5's flags-not-blockers
rule is preserved in §7 of this file); §6 (checklist items become gated rather than
mental); §7.4 (`verify-docs.mjs` enforces it mechanically for the first time). **No
contradictions introduced.** §1.7.5's anti-delay protection is explicitly restated so
TBC cannot be abused as a blocker.

**4. Alternative-tested.** Against `A38`'s incident: under TBC, `npm run check` is the
only path to a passing gate, so the four-of-six substitute would have failed
`verify-artifacts.mjs` at the first "verified." Against `A22`: the minimum-set
manifest requirement means the ~3,800 LoC session could not have closed — closure
requires timestamped reads of §0, §1.5.1, §1.5.2, §6, `A19`, `A22`, `A30`, `A38`
regardless of what the agent chose to cite. Against `A31`: the write-path/read-path
assertion catches all seven unreachable features at BUILD, before three were reported
`BUILT`. **The existing rules caught none of these in advance; all three were caught
by founder escalation.**

**5. Outside-view checked.** The obvious outside objection: *this is process overhead
that slows the build.* It is answered on its own terms — the manifest costs 10–20
minutes per closure (`A22`'s own estimate), against `A38`'s cost of a `main` branch
with failing lint for a day and ~30 false assurances. The second objection — *gates
produce false positives and get skipped* — is `A30`'s own load-bearing constraint and
is addressed at §6.7: fix the gate or delete it.

**6. Does not soften under pressure.** This amendment **increases** friction for the
builder and produces better outcomes for the System. It is the correct direction under
§7.2.6. The specific risk to watch: TBC becoming a checkbox ritual where artifacts are
generated without the thinking. **Its own test (§7.5):** does the first TBC-governed
build produce a residual that gets *worked*, and a finding whose class sweep names a
boundary the agent would not have swept unprompted — or does it produce five
well-formed JSON files and the same build that would have shipped anyway?

If the latter, TBC did not take, and it is eligible for counter-amendment. **The
constitution is not a one-way ratchet.**

---

*This protocol is derived from `CLAUDE.md` §0–§7 and `ThinkerThinker.md` `A1`–`A39`.
Where it appears to conflict with either, they win and this file is wrong. Report the
conflict rather than resolving it.*
