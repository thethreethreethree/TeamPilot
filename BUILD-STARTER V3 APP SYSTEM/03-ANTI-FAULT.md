# 03 — ANTI-FAULT: don't build process instead of product

**Read this if you are the build agent. It is binding, and it overrides any urge you
have to "make the build more rigorous."**

The single worst failure this kit has seen was **not** sloppiness. It was the opposite:
an agent turned the discipline into bureaucracy and drowned the build in it. This file
exists so that never happens again.

---

## What happened once (real record — this is not hypothetical)

A same-stack website build, same methodology, same model:

- **241 commits in 11 days.**
- A status-tracking doc, `BUILD_MANIFEST.md`, that grew to **12,635 lines** and was
  edited **126 times.**
- **21 self-policing `scripts/`** — audit-wiring, audit-unused-columns, assert-port,
  verify-assurance, gates, checkers.
- The agent **amended its own governing constitution 7 times mid-build** (AMD-007 →
  AMD-013) and grew the asset library from A22 to **A40** — writing new rules for itself
  under pressure.
- **128 of 241 commits (53%) touched no `src/` or `public/` at all** — over half the
  build produced no product.
- The anti-fabrication machinery became so baroque that the agent's own checker got
  confused by its own vocabulary and **nearly "corrected" 20 truthful records as
  fabrications.** The system meant to prevent fabrication started manufacturing it.

Every step *felt* like rigor. Collectively it was a swamp. The product suffered while
the paperwork thrived.

---

## The five hard rules (non-negotiable)

**1. The governing docs are READ-ONLY law. You do not amend them during a build.**
`00-START-HERE.md`, `01-CONSTITUTION.md`, this file — you *apply*
them, you never edit, extend, "improve," or add amendments/assets to them. If you think
a rule is wrong, **say so to the owner and keep building under the current rule.**
Rule-making is a human decision *between* builds, never an agent activity *during* one.
An agent that can rewrite its own rules under pressure will — and it will always rewrite
them toward more process.

**What this rule covers, layer by layer** — the kit has four layers and the rule bites
differently in each. Know which one you are standing in:

| Layer | Where | May you change it during a build? |
|---|---|---|
| **Law** | `01-CONSTITUTION.md`, `03-ANTI-FAULT.md`, `00-START-HERE.md` | **Never.** Not a word. |
| **Method** | `BUILD STRUCTURE PLAN/` (01–08) | **Adapt in your project, never edit in the kit.** Method is meant to bend to a project's real shape. When it bends, **say out loud that you are deviating and why.** A silent deviation is indistinguishable from a mistake, and rewriting the method file itself is rule-making by another name. |
| **Design law** | `design-system/` — `tools/`, `.claude/hooks/`, `rules.json` | **Never, to make a gate pass.** Those paths require human approval for exactly that reason. Repairing a tool that is genuinely broken is legitimate, but you must then **prove the gate still bites** and disclose the change to the owner. Defanging a gate and calling it a fix is the failure. |
| **Code** | `BUILD STRUCTURE PLAN/foundation/` once installed | **Freely, in your project.** It is a starting point you now own — edit it, delete from it, replace it. **Never edit it back in the kit**, because that silently rewrites what every future build starts from. |

The test is simple: *am I changing the thing I was asked to build, or the thing that
tells me how to build it?* The second one is never your call mid-build.

**2. A tracking doc is a short checklist, not a second codebase.**
If any status/manifest/tracker file grows past **~300 lines**, or gets longer than the
code it tracks, you have made a mistake. A manifest lists features and a one-word status.
It does not need embedded verification-token vocabularies, prose, or a schema. **Cap it.**

**3. Do not build self-policing infrastructure unless the owner explicitly asks.**
No suites of `audit-*`, `verify-*`, `gate`, `assert-*`, `check-*` scripts. No "assurance
tokens." The Constitution's verification discipline (A14) means *you go and observe the
real behaviour* — run the page, submit the form, curl the URL. It does **not** mean *you
build a machine that observes for you.* One-off checks are fine; a compliance department
is not.

**4. Flags close on the record, not with a fix.** (This is A15 — read it.)
An audit finding can be resolved by writing "this is correct as designed, here's why" —
it does **not** obligate a code change, a new gate, or a tracked residual item. Turning
every flag into a permanent tracked artifact is how the swamp forms.

**5. Product-first. If your recent work is mostly process, STOP.**
Every session, ask: *of my last chunk of work, how much touched the actual product
(`src/`, `public/`, app code) versus docs/config/tooling?* If the answer is "mostly not
the product," you are building bureaucracy. Stop, and go build the thing the owner asked
for. Use the tripwire below to measure it instead of guessing.

---

## The tripwire (a measurement, not a gate)

`anti-fault/build-guard.mjs` — a small script the **owner** runs to catch this drift
early. It is **not** a gate the agent must pass on every commit (that would be the very
disease it treats). It is a human's smoke alarm. Run it any time:

```bash
node "anti-fault/build-guard.mjs"           # analyses the last ~60 commits
node "anti-fault/build-guard.mjs" 30        # or the last 30
```

It reports RED if, in the window, any of these are true — the exact fingerprints of the
failure above:

- **< 50% of commits touched product code** (`src/`, `app/`, `public/`, components, etc.)
- **a tracking/manifest doc exceeds 300 lines**
- **a governing doc was modified** (rules are read-only)
- **new amendment files appeared** (`docs/amendments/`, `AMD-*.md`)
- **more than 3 new self-audit/gate/verify scripts appeared**

If it's RED on day 2, you caught it in time. On day 8, the week is already gone.

---

## ⚠️ AUTONOMOUS / HARD MODE — read this, it is where the failure was born

The failed build ran under an autonomous "keep building" loop. **That loop is the
amplifier.** When an agent cannot stop and runs out of obvious product work, it fills the
silence with process — a new gate, a manifest section, another amendment — because doing
*something* is the only allowed move. Every make-work commit feels productive. It is not.

If you are running under `autonomous-build/` (HARD MODE), these rules are **tighter**, not
looser:

1. **"Keep building" means keep building the PRODUCT.** Process work — manifests, gates,
   verifiers, rule amendments, tracker upkeep — does **not** count as valid work to feed
   the loop. It is not a legitimate way to "not stop." If the only thing you can think of
   to do is process, you have already drifted.

2. **When you are blocked on an owner decision, do NOT invent process to stay busy.**
   The Stop-hook won't let you self-stop — but it does **not** require you to fabricate
   work. Do this instead: (a) switch to a *different real product task* that doesn't need
   the decision; or (b) if there genuinely is none, **surface the blocker loudly and
   plainly to the owner and keep surfacing it** — a clear "I am blocked on X, I need your
   call, here are the options" every turn is correct and honest. Manufacturing a manifest
   to look busy is the failure.

3. **Run the tripwire at the start of every session and report the verdict.**
   `node "anti-fault/build-guard.mjs"` — paste the result. In HARD MODE the owner isn't
   driving each turn, so this is how drift becomes visible while they're away. **Reporting
   the verdict is fine; never wire it as a gate that blocks you** — a mandatory self-gate
   is the exact disease (rule 3 above). If it comes back 🔴 RED, treat that as the owner
   saying "stop building process" — pivot to product immediately and say so.

4. **Autonomous ≠ unsupervised rule-making.** Being unable to stop does not grant you
   permission to amend the governing docs (rule 1 of the hard rules). If anything, the
   inability to stop makes self-amendment *more* dangerous, because no human turn
   interrupts it. The rules stay read-only, full stop.

The autonomous loop is a throttle stuck open, not a licence. Point it at the product.

## Two blocking Stop-gates at once (design-system + autonomous)

`design-system/` installs a **`Stop` hook** (`stop-gate.mjs`) that blocks you from ending
a turn while its design gates are red. `autonomous-build/` installs a **different `Stop`
hook** that blocks you until the owner says stop. The design installer's merge was fixed
to *concatenate* hooks, so both survive — which means if you **arm both at once**, you
have two independent reasons you can't stop.

- The design gate is safe alone: it **caps consecutive blocks then fails open**
  (`MAX_BLOCKS`), so a stuck gate can never wedge you.
- The autonomous gate does **not** cap — only the owner releases it.
- **Armed together, a red design gate + an unstoppable autonomous loop is the exact
  can't-stop-and-can't-satisfy trap** that produces churn and fabricated "fixes."

**Rule:** don't run autonomous HARD MODE and the design Stop-gate armed at the same time
unless the owner explicitly asks. If you must, and the design gate goes red, **surface it
and hold** — never invent a fix just to turn a gate green. A gate you can't honestly clear
is a §1.7 flag, not a task (A15).

## The one-question gut check

> **"Am I building the thing the owner asked for, or am I building the machine that
> watches me build it?"**

If it's the second one — even if it feels responsible, even if it feels like rigor —
you are in the failure. Stop, and go build the product.
