# CHECK — sales-coach revision completion audit

Audited the built files: the LiveCoachingPanel declutter and the session-page redirect.

## Within-module pass (four layers)

- **1 structure:** declutter = removals; routing = one load-time redirect that folds in the
  end-only push (one source of truth, not two).
- **2 effectivity:** grep confirms the four struck strings are gone and the kept line remains; a
  Standard rep on an ended session is replaced to after-pitch. typecheck exit 0.
- **3 composition:** the rep's post-session moment now lands on the actionable After-Pitch (Start
  Next Door), not the dense manager page. Managers (Expert) keep the full page. after-pitch does not
  loop back (it advances to the next session).
- **4 surface:** the live screen is decluttered to only the load-bearing line.

## Cross-module pass (A21)

Post-session routing now has ONE behaviour: `isStandard && status!==active → after-pitch`, applied
both on End and on any later view — instead of an end-only special case plus a page that still
showed the manager view. Consistent with the existing `!isStandard` post-call gates on the page.

## Class sweep (A26)

- class A (declutter): a struck helper string still rendering. sweep: grep the four strings → 0
  remain. The other muted helper lines on the panel were NOT in the founder's markup, so they are
  intentionally left (removing them would overtake the instruction).
- class B (routing): a Standard rep seeing the dense Expert/manager surface. sweep: `grep
  "!isStandard" [id]/page.tsx` → the Expert-only sections are already gated (lines 408/450/498/647/
  709/827/904); the post-session redirect now covers the whole-page case. No other Standard-sees-
  dense gap on this page.
- **class C (the recurring META class — founder-invoked):** "a founder revision reported done while
  a subset was never implemented." This is bigger than this fix and gets its OWN permanent-solution
  build (durable unfinished-work + risks ledger; revision-completeness checklist). Recorded as the
  top residual, opened.

## Findings

No findings left open in this fix. The recurring META class is escalated to its own build (not
silently absorbed).

## Inspected / not-inspected

- **Inspected:** both changed files; the four strings (grep); the after-pitch redirect (no loop);
  the isStandard post-call gates; typecheck.
- **NOT inspected (→ residual):** the permanent structural fix for the recurring-revision class —
  the founder's meta-request; its own build.
