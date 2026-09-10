# BUILD STRUCTURE PLAN — read this after the constitution

**You are an AI build agent. This folder is the *method*. The constitution is the
*law*.**

This is the **App Edition**: you are building a native mobile app for **iOS and
Android** — Expo + React Native, native modules, EAS, on-device-first, styled with
**NativeWind**. The law does not change between web and app; the method does, and
this folder is the app method.

`01-CONSTITUTION.md` and `03-ANTI-FAULT.md` tell you how to reason and what not
to become. They do not tell you what a booking system's schema should look like,
which screens a tab bar should hold, or why your brand colour will not survive the
token generator. This folder does.

Everything here was extracted from a build that shipped. Every rule exists
because the alternative was tried and cost time.

---

## Where this sits

```
LAW         01-CONSTITUTION.md · 03-ANTI-FAULT.md
            how to reason, what never to become. Never amended.
              |  governs
METHOD      BUILD STRUCTURE PLAN/            <- you are here
            the sequence, the blueprints, and the gates between phases.
              |  governs
DESIGN LAW  design-system/
            enforced by hooks and gates. Fixed once installed.
              |  governs
CODE        BUILD STRUCTURE PLAN/foundation/
            working React Native source you copy in and then own.

            Release lives here too, in 05-DEPLOYMENT-METHOD.md: the APP release
            lifecycle — dev builds -> off-store testing -> store submission —
            not a server deploy. Derive live state (build numbers, what is in
            each track) from the tooling, never from a document.
```

**If this folder ever contradicts the constitution, the constitution wins.**
This is method, not law. Method adapts to the project; law does not. When you
adapt something here, **say out loud that you are adapting it and why** — a
silent deviation is indistinguishable from a mistake.

---

## What is in here

| File | Read it |
|---|---|
| `01-BUILD-SEQUENCE.md` | Before starting. The phase order, the two installers, and what gates each phase. |
| `02-BACKEND-BLUEPRINT.md` | Before writing any schema or server/service code. |
| `03-DESIGN-BLUEPRINT.md` | Before generating tokens or writing a component. |
| `04-CONTENT-AND-MEDIA.md` | Before sourcing a single image. |
| `05-DEPLOYMENT-METHOD.md` | Before releasing. The build → test → submit lifecycle and its traps. |
| `06-VERIFICATION.md` | Before claiming anything works. |
| `07-HANDOVER-GATE.md` | Before telling the owner it is done. |
| `08-LESSONS.md` | Real mistakes from a real build. Read once, early. |
| `foundation/` | **Working code, not pseudocode.** Read `foundation/README.md` before Phase 3, and run `foundation/install.sh <project>` during it. This is the only part of the kit you are meant to copy out and edit — inside your project, freely; inside the kit, never. |

---

## How to use it on a new project

This folder is **deliberately generic**. It contains no client names, no
industry, no domain. Your job on a new build is to bring the specifics; the
structure is already decided.

**What you supply per project:**

- The domain entity and its lifecycle (the thing being booked / ordered /
  submitted, and the states it moves through)
- The brand seed colour, the two typefaces, the art direction
- The real content counts, the real copy, the real photography
- The bundle identifier, the app name and icon, the environment variables, the
  signing keys

**What you do NOT re-decide per project:**

- The build sequence and the order of its gates
- Idempotent-migration structure
- Money as integers, availability inside a transaction
- Auth that fails closed
- The release method and its verification checklist
- The handover completeness gate

If you find yourself redesigning something in the second list, stop. Either the
project genuinely needs a different shape — in which case say so to the owner
and name why — or you are rebuilding a solved problem.

**The two installers, in order.** The full order and the reasoning behind it is
in `../00-START-HERE.md` §3. The short version:

```
design-system/install.sh <project>   ->  RESTART Claude Code  ->  /design-intake
   ...contract, direction, scaffold...
foundation/install.sh <project>      ->  /design-tokens  ->  build
```

The restart is not optional. Claude Code loads hooks at session start only, so
an installed-but-not-restarted design system enforces nothing at all.

---

## The five rules that carry the most weight

Everything else in this folder elaborates on these.

1. **Verify the render path, not just the data path.** "The store has it" and
   "the user can see it on the device" are different facts. Check both, every
   time — on a real device or simulator, not just in a test.

2. **Test the whole class, not the one case.** One passing example proves one
   example. Sweep the range — devices, orientations, font scales — and assert an
   invariant.

3. **A green gate is necessary and never sufficient.** Automated tooling catches
   roughly a third of real problems. Look at the running app.

4. **Never trust a document's inventory of live state.** Build numbers, SDK
   versions, what is in each test track: re-derive it from the tooling every
   time. Documents go stale silently; the build system does not lie.

5. **Honest absence beats invented presence.** A visible "not set yet" is worth
   more than a plausible fabrication, and costs infinitely less to undo.

---

## The one-line summary

> **Bring the specifics. The structure is already decided. Verify what you
> claim, look at what you built on a real device, and never invent what you can
> leave honestly blank.**
