---
started_at: 2026-08-27T06:21:00+08:00
---

# THINK — Fixes from the scenarios/materials + brief-scheduling reviews

## Why (the record — the two adversarial reviews I ran this session)
Three confirmed defects, each checked against the code before fixing (a finding is a suspect):

1. **HIGH — practice-scenario auto-fetch loops forever on the null/error/rate-limited path.** The setup-screen effect
   guarded on `!scenario && !scenarioLoading`; a null generation leaves `scenario` null and toggles `scenarioLoading`
   false, re-satisfying the guard → back-to-back POSTs + a stuck "Writing a scenario…" UI, precisely on the honest
   fallback path. FIX: a `useRef` attempt-latch keyed on focus — auto-fetch ONCE per focus; "New scenario" still
   refetches explicitly. (The material side already had a one-shot guard; the scenario side lacked it.)
2. **MEDIUM — coaching-material "couldn't load" is a dead-end.** `toggleLearn` refetched only when `material===undefined`;
   after a null (failed) load, reopening never retried, so the "try again" the error text promises was inoperative.
   FIX: refetch when material is undefined OR null (retry on reopen); a loaded guide is kept.
3. **MEDIUM — team-brief Day/Week toggle mislabels the displayed brief.** The intro bound the window label to the
   pending toggle, but the shown brief doesn't change until Rebuild → a 7-day brief could read "from the last day".
   FIX: the intro describes the BUILD action for the selected period; a separate "Showing {brief.periodLabel}" line
   labels the displayed brief by its OWN window (decoupled from the toggle).

## What the reviews REFUTED (left unchanged): tenant scoping on both LLM routes, the injection fence, the after() write,
the manager leader-visibility path, honest empties elsewhere, FocusItem state isolation, event-schema acceptance, period off-by-one.

## §3.4 / §1.5.1
The loop fix restores the intended honest fallback (null → plain seed) AND stops a request storm (layer-2/3). The retry
fix makes the promised recovery real. The label fix stops a stale-as-fresh window label (honesty).

## Ripple (§6 item 5)
Three isolated UI-logic fixes (a ref latch, a retry condition, a label source). No route/engine/schema change; the
default paths are otherwise unchanged.

## Session-read manifest (A22 — read_at ≥ started_at 06:21:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-12", "read_at": "2026-08-27T06:24:02+08:00",
    "why_it_governs": "Verify each review finding against the code before fixing.",
    "how_this_build_will_embody_it": "Confirmed all three against the source; left the refuted hypotheses unchanged." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-24", "read_at": "2026-08-27T06:24:20+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Cited axioms re-read this session." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "88-92", "read_at": "2026-08-27T06:24:06+08:00",
    "why_it_governs": "Layers 2/3 — a request-storm loop + a dead-end retry break the flow the feature promises.",
    "how_this_build_will_embody_it": "Latched the auto-fetch once per focus; made the retry actually retry." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "144-146", "read_at": "2026-08-27T06:24:12+08:00",
    "why_it_governs": "Proactive audit — the reviews are the search; act on what they confirm.",
    "how_this_build_will_embody_it": "Fixed the confirmed three; recorded the refuted set." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-366", "read_at": "2026-08-27T06:24:08+08:00",
    "why_it_governs": "Honesty — the fallback/label must be true, not stale-as-fresh.",
    "how_this_build_will_embody_it": "Loop fix restores the plain-seed fallback; the brief label reflects the displayed brief's own window." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-435", "read_at": "2026-08-27T06:24:22+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: verified the suspects, fixed at the right depth, isolated changes." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-456", "read_at": "2026-08-27T06:24:24+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-595", "read_at": "2026-08-27T06:24:26+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a read_at; the trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-771", "read_at": "2026-08-27T06:24:28+08:00",
    "why_it_governs": "A prose-only fix returns — but these are UI effect/render fixes with no pure seam; the latch/condition are self-documenting in code.",
    "how_this_build_will_embody_it": "The fixes carry explaining comments; no unit seam exists for a React effect loop, bounded honestly in check.md." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1002", "read_at": "2026-08-27T06:24:30+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the full `npm run check` output + EXIT code." }
]
```
