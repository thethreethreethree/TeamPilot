# AMD-008 — The automatic build protocol (THINK · BUILD · CHECK) becomes mandatory

- **Status:** ratified — approved by the founder 2026-07-28 ("I approve the patch"; "commit AMD-008 as long as it doesn't break our build structure system"). The founder is the §7.2.5 disinterested outside-view party, and per AMD-001 §7.2 the founder is the ratifier. The original proposal text below is preserved unedited (§7.3 append-only); the decision is appended at the end.
- **Date proposed:** 2026-07-28
- **Proposed by:** founder directive ("update our build structure … apply the files … make sure it does not break our system"), formalized by the agent into the §7.2 soundness gate.
- **Numbering note:** the operational docs (`THINK_BUILD_CHECK.md` Appendix C, `BUILD-PROTOCOL.md` §12.2) instruct filing as "AMD-007-…". That number is **already occupied** by `AMD-007-PROPOSED-cite-only-what-you-read.md` (a different, still-PROPOSED amendment). Amendments are sequential and append-only (§7.3), so this is **AMD-008**. The two are complementary, not competing — see Ripple-trace.
- **Affects:** CLAUDE.md §2 (adds §2.1 "Standing build protocol"); CLAUDE.md §6 (the checklist items become gated rather than mental); reinforces §0.1, §1.5.1, §1.5.2, §1.7; §7.4 becomes mechanically enforced for the first time by `verify-docs.mjs`. Introduces the operational documents `docs/BUILD-PROTOCOL.md` + `docs/THINK_BUILD_CHECK.md` and the `scripts/tbc/` gates.

---

## Trigger (§7.2.1 — triggered by evidence)

Three documented incidents from the project record, in each of which the existing rule was **correct** and produced **wrong behaviour** because invocation was discretionary:

- **`A38`, 2026-07-17.** Four defenses present, correct, and bypassed in a single session — `ThinkerThinker.md` unread, AMD-006 unread, `UI-FEATURE.md` never run, `npm run check` never invoked. Each required the agent to *choose* to invoke it; none fired.
- **`A22`, 2026-06-19.** ~3,800 LoC of constitutional citations produced from cached memory rather than session reads.
- **`CAT-001`, 2026-06-16.** The methodology-outside-the-tree catastrophe that AMD-005 was written to answer.

The build/audit prompt this protocol replaces has the same shape as the defenses in `A38`: it works when pasted and is absent when not pasted. `A30` states the terminal form: *a lesson recorded only in prose will return; a fix is not complete until the class is encoded in a gate that fails without the author's cooperation.*

## Diagnosis (§7.2.2 — diagnosed, not preferred)

The existing rules fail for a **stated mechanism**, not a missing one:

- `A22`: the citation mechanism runs at the speed of language, the reading mechanism at the speed of attention; they drift, and labels accumulate while content fades.
- `A35`: the enforcement charges for the **citation**, not the **reliance**, so silence dodges it.
- `A38`: the claiming mechanism runs at the speed of a summary, the verification mechanism at the speed of a command.

All three describe a **fast half impersonating a slow half**, and none is fixed by intending better. The amendment attaches the slow half to an **artifact a script reads** (`docs/tbc/<build>/`), so the discipline no longer depends on the agent remembering to apply it — which is the `A9` failure AMD-005 already documents at the process altitude.

## Ripple-trace (§7.2.3)

| Section / asset | Effect | Coherence check |
|---|---|---|
| **§0.1** | Integrity check (find + hash the docs) becomes mechanical via `verify-docs.mjs` + `verify-manifest.mjs`. Substance unchanged. | No conflict. |
| **§1.5.1** | The four-layer pre-walk becomes a recorded artifact (`think.md` `layers.*`) rather than a mental step. | No conflict — operationalizes, does not amend. |
| **§1.5.2** | Hypotheses-before-search become schema'd (`think.md` `hypotheses[]`). | No conflict. |
| **§1.7** | TBC's CHECK phase is a scoped ground-up audit. **§1.7.5's flags-not-blockers rule is explicitly preserved** in `THINK_BUILD_CHECK.md` §7 and `BUILD-PROTOCOL.md` §7. | No conflict — the anti-delay protection is restated so TBC cannot be abused as a blocker. |
| **§6** | Checklist items 1a/5a/5b become gated rather than mental. | No conflict. |
| **§7.4** | `verify-docs.mjs` enforces "no CLAUDE.md/ThinkerThinker.md edit without a referenced AMD" mechanically **for the first time**. | Strengthens §7.4; introduces nothing that contradicts it. |
| **AMD-007 (PROPOSED, cite-only-what-you-read)** | Complementary. AMD-007 widens §0.1's *prohibition* ("cite only what you read"); the TBC manifest gate is the *mechanism* that makes that prohibition checkable. AMD-007's own second pass notes "the constitution is currently the weaker document than its own hook" — this amendment is the hook. | Coherent. Neither depends on the other; ratifying both aligns rule and mechanism. |

No silent contradictions introduced. Nothing existing is loosened. **§1.7.5's anti-delay protection is the one to watch and is explicitly carried forward** so TBC is not weaponized into a stall.

## Alternative-test (§7.2.4 — tested on the triggering incidents)

| Incident | Existing rule | Under TBC |
|---|---|---|
| **`A38`** (four-of-six substitute reported as "verified") | Caught none in advance — surfaced by founder escalation. | `verify-artifacts.mjs` fails on any "verified"/"green"/"passing" not adjacent to a pasted canonical-command output with an exit code. The substitute would have gone red at the first "verified." |
| **`A22`** (~3,800 LoC from cached labels) | Did not prevent it. | The minimum-set manifest (`§0, §0.1, §1.5.1, §1.5.2, §6, A19, A22, A30, A38`, unconditional) means the session could not close without timestamped, line-range-verified reads. |
| **`A31`** (7 features schema-correct, unreachable) | File-by-file report described them as BUILT. | `verify-artifacts.mjs` fails any feature in `build.md` lacking BOTH write-path and read-path assertions — caught at BUILD, before "BUILT" is written. |

The existing rules caught **none** of these in advance; all three were caught by founder escalation. The proposed rule catches each at gate-time. §7.2.4 bar met on evidence.

## Outside-view (§7.2.5) — **PENDING, founder-only**

The agent assembled this install; a §7.2.5 reading "by a stance with no investment in adopting it" cannot be self-supplied by the invested party. Two objections are pre-answered on their own terms; the founder must run the actual read:

- *"Process overhead that slows the build."* — The manifest costs 10–20 min per closure (`A22`'s own estimate) against `A38`'s cost: a `main` branch with failing lint for a day and ~30 false assurances shipped.
- *"Gates produce false positives and get skipped."* — This is `A30`'s own load-bearing constraint, addressed at `THINK_BUILD_CHECK.md` §6.7 / `BUILD-PROTOCOL.md` §8.1: **fix the gate or delete it**; every exception is allowlisted with a ≥20-char reason (enforced by `lib.mjs::loadAllowlist`).

## Does not soften under pressure (§7.2.6)

This amendment **increases** friction for the builder and produces better outcomes for the System — the correct direction under §7.2.6. The specific risk to watch (stated so ratification is not mistaken for a solution): TBC becoming a checkbox ritual where artifacts are generated without the thinking. **Its own test (§7.5):** does the first TBC-governed build produce a residual that gets *worked* and a class sweep that names a boundary the agent would not have swept unprompted — or five well-formed JSON files and the same build that would have shipped anyway? If the latter, TBC did not take and is eligible for counter-amendment. The constitution is not a one-way ratchet.

## Proposed change

Add to **CLAUDE.md** under §2, referencing this amendment ID per §7.4:

```markdown
### 2.1 Standing build protocol

> Added by [AMD-008](docs/amendments/AMD-008-PROPOSED-automatic-build-protocol.md).

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

And wire the gates into the canonical command (`package.json`) + the `.husky/pre-commit` hook per `THINK_BUILD_CHECK.md` §6.1 / §6.6. **These enactment steps happen only on ratification**, and only after the bootstrap build directory (`docs/tbc/2026-07-28-install-tbc-gates/`) is green, so the wire-in cannot turn `npm run check` or the commit flow red.

## Decision

**PENDING — founder ratifies or denies.** Per §7.1 the default is denial. The one gate the agent cannot self-clear is §7.2.5 (outside-view). Per §7.3 this file is append-only: a denial is recorded by appending, not by editing.

---

## Decision — RATIFIED 2026-07-28 (appended, §7.3)

The founder ratified this amendment across two directives: **"I approve the patch, but make
sure nothing breaks"** and **"commit AMD-008 as long as it doesn't break our build structure
system."** Per AMD-001 §7.2 the founder is the ratifier, and per §7.2.5 the founder is the
disinterested outside-view stance the agent could not supply itself — so gate 5 is cleared by
this approval.

**Enacted the same day** via `docs/tbc/WIRE-IN.md`:
- CLAUDE.md §2.1 (Standing build protocol) added, referencing this amendment.
- `src/lib/constitution.ts` bumped to `amendmentCount: 7`, `lastAmendmentId: AMD-008`
  (INVARIANT 12 keeps the customer-facing version metadata honest against the ratified record).
- `docs/tbc/DOC_MANIFEST.json` regenerated for the new CLAUDE.md hash.
- `tbc` wired into `npm run check`; `tbc:docs` + `tbc:manifest` added to `scripts/hooks/pre-commit`.

The founder's binding condition — **"as long as it doesn't break"** — was met: `npm run check`
returns exit 0 after enactment (the bootstrap build `docs/tbc/2026-07-28-install-tbc-gates/` is
green, so the newly-wired `tbc` gate passes).

**§7.5 watch (does it take?):** the first TBC-governed build already produced a real finding
(F1, fixed at a chokepoint) and a worked residual — recorded in the bootstrap. If future
TBC-governed builds produce only well-formed artifacts and no real findings, this amendment is
eligible for counter-amendment. The constitution is not a one-way ratchet.
