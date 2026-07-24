# C.A.R.E accessibility (a11y) audit — 2026-07-24

**Scope:** keyboard operability + focus management + ARIA semantics of the C.A.R.E agent surface's
interactive primitives (the portaled dropdowns, the modal, the composer/toolbar). Read-only audit —
**no code changed.** These are pre-existing gaps, surfaced during this session's dropdown/modal work.

**Why this is an audit, not a patch:** a11y done piecemeal is often worse than none — e.g. adding
`role="menu"` without arrow-key navigation announces a menu to a screen reader that then doesn't behave
like one (a broken expectation). And the behavioral fixes (focus trap, roving focus) touch `FloatingMenu`,
the shared component behind the Assign/Priority dropdowns just stabilized this session — changing it under
time pressure risks reintroducing the very bug we fixed (§5). So this is scoped as a deliberate, testable
pass for founder prioritization, not a reflexive edit.

**Standard:** WCAG 2.1 AA. The extension/widget were previously verified ADA-accessible; this is the
authenticated agent surface, which hasn't had the same pass.

---

## Findings

### A1 — Portaled dropdowns (`FloatingMenu`: Assign, Priority, sidebar status) — MEDIUM
`src/components/ui/FloatingMenu.tsx` renders a bare positioned `<div>`. It has Escape-to-close and
click-outside (good), but:
- **No focus management.** On open, focus stays on the trigger; a keyboard/screen-reader user isn't
  moved into the menu and can't reach the items with Tab in a predictable order. On close, focus isn't
  restored to the trigger. (WCAG 2.4.3 Focus Order.)
- **No arrow-key navigation** between items (WCAG 2.1.1 — the ARIA menu/listbox pattern expects ↑/↓).
- **No roles.** No `role="menu"`/`menuitem` (or `listbox`/`option`). (WCAG 4.1.2 Name/Role/Value.)
- **Trigger** lacks `aria-haspopup` + `aria-expanded` (`ConversationsApp.tsx` AssignDropdown ~2553,
  PriorityDropdown ~2615; CareShell status ~498).
**Fix (deliberate pass):** move focus to the first item on open + restore to trigger on close; add ↑/↓/Home/
End roving focus + Enter/Space to select; add `role` + `aria-activedescendant` (or roving `tabindex`);
add `aria-haspopup`/`aria-expanded` on triggers. Do it once in `FloatingMenu` with an opt-in `role` prop
so `MentionInput` (which handles its own input keys) isn't disturbed. **Re-run the Assign flow after** —
this is the just-fixed component.

### A2 — `ResolutionCaptureModal` (and modal-style overlays) — MEDIUM/HIGH
`src/components/care/ResolutionCaptureModal.tsx` (`fixed inset-0 z-[80]`) has an `aria-label="Close"` on
the X, but:
- **No `role="dialog"` + `aria-modal="true"` + `aria-labelledby`** → screen readers don't announce a
  dialog opened or its title. (WCAG 4.1.2.)
- **No focus-on-open** → keyboard focus stays behind the modal.
- **No focus trap** → Tab escapes to the (inert) content behind the backdrop.
- **No Escape-to-close** and **no focus-restore** to the trigger on close. (WCAG 2.1.2 No Keyboard Trap /
  2.4.3.)
Same gaps likely apply to the other modals (TaskRefinementPanel, debrief, AskCoach/Dissect panels) —
they share the pattern. A small reusable `useModalA11y(ref, { onClose })` hook (focus-on-open, trap,
Escape, restore) would fix the class at once; none exists today.

### A3 — Composer / toolbar — LOW (mostly OK)
Icon-only buttons largely carry `aria-label` (13 present in ConversationsApp) and the text buttons
(Summarize/Dissect/Coach) have visible labels — good. Spot-check remaining icon-only controls
(sound toggle, collapse rails, priority dot) for names, and confirm the composer `<textarea>` has an
associated label (placeholder is not a label — WCAG 3.3.2).

### A4 — Live regions — LOW
Async results (Summarize/Dissect/Coach output, toasts) should live in an `aria-live` region so screen
readers announce them when they arrive. The transient hint toast already uses `role="status"` (good);
extend the pattern to the AI-result panels.

---

## Recommendation (priority order)

1. **`useModalA11y` hook** → fixes A2 across every C.A.R.E modal at once. Highest value, self-contained,
   no risk to the dropdowns. Start here.
2. **`aria-haspopup`/`aria-expanded` on the dropdown triggers** — genuinely safe + complete on its own
   (announces the button's state without implying full menu semantics). Can ship independently of A1's
   behavioral work.
3. **Full `FloatingMenu` keyboard pattern** (A1) — most involved; do it deliberately with the Assign flow
   re-verified, ideally once component-test infra exists so it's regression-guarded.
4. A3/A4 — quick spot-fixes.

**Not started by design:** none of the above was edited. Piecemeal ARIA and pressure-time changes to the
just-fixed dropdown infra are the wrong move (§2 surface-don't-overtake, §5 builder-under-pressure). This
is on the record (§1.7.4) for the founder to schedule as a proper a11y pass.
