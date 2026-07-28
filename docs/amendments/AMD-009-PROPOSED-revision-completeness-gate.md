# AMD-009 — Revision-completeness gate + durable build-state ledger

**Status:** proposed
**Proposed:** 2026-07-29
**Proposer:** agent (autonomous build), for founder ratification
**Governs:** BUILD-PROTOCOL.md (adds §7.1 + §8.3); package.json (`tbc` chain). Does NOT edit CLAUDE.md.

---

## 0. One-line ask

Make the already-built, already-runnable revision-completeness gate **mandatory** (add it to
`npm run check`) and insert its standing-protocol text into BUILD-PROTOCOL.md. Everything is written and
tested; this amendment is the on-record governance step so the agent does not self-impose a mandatory gate
while the founder is offline (§3.3 guide-don't-overtake; A28 precedent = AMD-008 ratified before TBC went
mandatory).

**Ratify with:** "ratify AMD-009" → the agent flips this file to ratified, applies the two inserts in §5,
bumps `src/lib/constitution.ts` amendment metadata (INV12), and regenerates nothing else.

---

## 1. §7.2 soundness gate

1. **Triggered by evidence.** The recurring "revision reported DONE while a subset was never implemented"
   class: the sales-coach revision (`ce727c36` shipped rename+reorder+auto-coach but silently dropped the
   declutter removal and the reload-path routing; the founder had to re-report "this isn't fixed",
   `86c987fa`). The founder named it a *pattern* and a critical error under §1 / A26. Root cause recorded
   in `docs/tbc/2026-07-29-sales-coach-revision-completion/closure.md` RES-01.
2. **Diagnosed, not preferred.** Three structural causes, not a discipline slip: (a) capturing every
   discrete change from a marked-up image is lossy — struck *removals* are non-salient vs additions;
   (b) no item-by-item traceability from instruction to build, so a partial build looks complete; (c) an
   interruption leaves no durable record of what's left + its risks, so a resume treats the partial as
   done. A prose promise cannot fix a class (A30); it needs a gate that is precise or declined (A33).
3. **Ripple-traced.** Touches BUILD-PROTOCOL.md (§7 residuals, §8 sweep-to-gate) and package.json (the
   `tbc` chain). Introduces no contradiction — it operationalizes A30/A33/A36 at the revision-scope
   altitude. Does not touch CLAUDE.md text, so §7.4 is not engaged. INV12: while **proposed**, this file
   is not counted (INV12 counts only `**Status:** ratified`), so the build stays green until ratification.
4. **Alternative-tested.** The alternative is the status quo (prose care + the existing TBC gates). The
   existing gates enforce that a build dir + manifest + residual exist — but NOT that every *requested
   change* reached a disposition, which is exactly the gap the sales-coach miss fell through. The new gate
   was detection-tested: it fails (exit 1, REV-3) on a manifest with an un-dispositioned item and is green
   (exit 0) on an honest one — output in `docs/tbc/2026-07-29-x-revision-completeness-mechanism/check.md`.
5. **Outside-view checked.** A reader with no stake: the gate only enforces completeness of the *declared*
   set; it cannot catch an item the author failed to declare (named honestly in the gate + revision.md).
   That is a real limit, not a hidden one — the declaration discipline + the durable ledger close it by
   habit. The gate is additive and green on the current tree, so ratification cannot break the build.
6. **Does not soften under pressure.** It *increases* per-revision friction (every requested change must
   reach an evidenced disposition before closure). It reduces none. It makes "reported done while partial"
   a visible structural state instead of an invisible one — the opposite of a builder-under-pressure
   shortcut (§5).

**Verdict sought:** ratify.

---

## 2. What is already built (this build, committed alongside this file)

- `docs/BUILD-STATE.md` — the durable unfinished-work + risks ledger, read first on resume (defends
  cause (c)). Companion to `docs/residuals/OPEN.md`; not itself amendment-governed (a living queue).
- `scripts/tbc/verify-revision.mjs` + `npm run tbc:revision` — the gate (REV-1..REV-6). Runnable now.
- `docs/tbc/<dir>/revision.md` — the per-build manifest (this build + retro-applied to the sales-coach
  incident), enumerating every atomic requested change to a tracked disposition (defends (a) + (b)).

## 3. What ratification changes

- Inserts §5's two blocks into BUILD-PROTOCOL.md (a §7-governed doc — deliberately not edited while this
  is only proposed).
- Adds `tbc:revision` to the mandatory `tbc` chain (§4 diff).
- Flips this file to ratified and bumps `src/lib/constitution.ts` (INV12).

---

## 4. Exact package.json diff (apply on ratification)

```diff
-    "tbc": "npm run tbc:docs && npm run tbc:manifest && npm run tbc:artifacts && npm run tbc:residual && npm run tbc:freshness",
+    "tbc": "npm run tbc:docs && npm run tbc:manifest && npm run tbc:artifacts && npm run tbc:residual && npm run tbc:freshness && npm run tbc:revision",
```

(The `tbc:revision` script line already exists in package.json; only the chain changes.)

---

## 5. Exact BUILD-PROTOCOL.md inserts (apply on ratification)

### 5a. New §7.1, after §7 (RESIDUALS):

```markdown
### 7.1 The durable build-state ledger — read first on resume

> Operationalizes A36 at the resume altitude, and the founder's 2026-07-29 interruption-resilience ask.

`docs/BUILD-STATE.md` is the single file a resume reads FIRST after any interruption (founder pause,
internet loss, context compaction, machine death). It carries, maintained *during* every build (not
written at the end):

- the ACTIVE build's requested items, each with an honest disposition and — if unfinished — its risk;
- a CARRY-OVER queue of real open work across the project, each with its risk;
- a rolling RECENTLY-CLOSED log.

An item is "done" only with evidence (A38). "Reported done while partial" is structurally impossible when
every requested item lives here with an honest disposition. An empty ACTIVE section means no build is in
flight — safe to stop.
```

### 5b. New §8.3, after §8.2:

```markdown
### 8.3 Revision-completeness manifest — the gate for the "reported done while partial" class

> Operationalizes A26/A30/A33 for founder revisions (esp. from marked-up images/PDFs).

For any build that implements a founder revision, `docs/tbc/<dir>/revision.md` enumerates EVERY atomic
requested change as `{id, verb, item, disposition}`. Enumerate first — before editing — so non-salient
changes (struck removals, edge-path routing) cannot silently drop. `npm run tbc:revision` fails closure
if any item is un-dispositioned (REV-3), "done" without evidence (REV-4), "deferred" without a reason
(REV-5), or deferred but absent from `docs/BUILD-STATE.md` (REV-6).

The honest boundary (A33): the gate enforces completeness of the *declared* set; it cannot detect a
change the author failed to declare. The declaration discipline + the durable ledger (§7.1) close that by
habit; the gate makes the declared set's completeness structural.
```

---

## 6. Ripple to src/lib/constitution.ts (on ratification)

Bump `amendmentCount` and `lastAmendmentId` to include AMD-009 so INVARIANT 12 passes. No CLAUDE.md text
change (this amendment governs BUILD-PROTOCOL.md + package.json, not the constitution body), so §7.4's
CLAUDE.md-edit rule is not engaged.

---

*Proposed under §7. Append-only per §7.3 — status changes are appended, never edited in place.*
