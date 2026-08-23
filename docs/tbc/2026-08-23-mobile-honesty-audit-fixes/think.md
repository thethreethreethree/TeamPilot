---
started_at: 2026-08-23T10:45:00+08:00
---

# THINK — mobile Sales Coach honesty + contrast fixes (from the proactive UX audit)

Under the active autonomous-build guard, after the founder's D1/D2 + nav-revision tasks were complete + deployed, I
ran a proactive mobile Sales Coach UX audit (§1.5.2 — pattern-justified by the founder's repeated mobile-issue
reports, §1.2). It surfaced 6 findings, ALL pre-existing (none introduced by my changes). Each is a SUSPECT (A26);
I verified each against the code before acting.

This build fixes the **three clear, low-risk bugs** that match tracked classes + the founder's demonstrated
standing values; the **three design decisions** are surfaced to the founder via a picker (not built here — §3.3).

## The three fixed here (verified against the code)

- **F4 — PitchDetail renders a load FAILURE as the permanent "This pitch isn't available."** `PitchDetail.tsx`
  mapped only 404 → not-found; any 500 fell to `r.ok ? r.json() : null` → null → the no-data message, and there
  was NO `.catch` (a network drop threw an unhandled rejection + still showed "not available"). This is the
  error-as-no-data class (§3.4 honesty; INV22's client twin) — a REGRESSION against its own siblings
  (PitchPerformance/TodaysMetrics both set an explicit error + Retry). Fix: a distinct `loadError` state → an
  honest, retryable card ("this is an error, not a missing pitch") mirroring the siblings; only a real 404 stays
  "not available".
- **F4b — the mobile home "Pitches" pill shows "0" on a FAILED dashboard fetch.** `page.tsx` `load()` did
  `if (dRes && dRes.ok) setStats(...)` with no else → on failure `stats` stayed null → the pill rendered
  `stats?.sessionsTotal ?? 0` = "0", which a rep reads as "no pitches" not "load failed". The SAME screen's macro
  totals already handle this correctly ("—" via `macroTotalsError`). Fix: a `statsError` flag → the pill shows "—"
  on failure (the desktop tiles keep their own documented "honest empty" 0 — out of this audit's mobile scope).
- **F5 — the mobile "Back to ELOSTATE" link is ~invisible in light mode.** It hardcoded `text-white/50` inside the
  theme-aware `bg-base` container; in light mode (`--bg-base` ≈ #FAFAFA) white-on-near-white is unreadable — and
  this is the ONLY labeled mobile exit (the desktop sidebar's is `hidden md:flex`). This is the tracked
  invisible-text/contrast class. Fix: theme-aware tokens `text-muted hover:text-secondary` (visible in both
  themes; preserves the muted intent), matching the mobile back-link convention (PitchDetail's `text-secondary`).

## Why fix these autonomously (not picker) — and surface the rest

The founder has a demonstrated STANDING directive to "sweep + fix" the error-as-no-data class on client sales
surfaces (2026-08-18/19), and INV22 enforces it server-side; F4/F4b are that class's client instances that slipped
(A26 boundary). F5 is a clear usability bug (invisible = unusable) in a tracked class, low-risk (a token swap). All
three mirror existing conventions/siblings — low blast radius. The remaining three (F1/F2 systemic mobile
back-navigation; F3 "Pitch Performance" label points to two destinations) are genuine DESIGN decisions with
multiple valid resolutions → a picker, matching this session's D1–D5 audit→picker precedent (§3.3 / AMD-013).

## Scope guard (holistic)
`load()` + `stats` are shared with the desktop tiles; `statsError` is set on failure regardless of viewport but
consumed ONLY by the mobile pill, so the desktop tiles are byte-unchanged (their "honest empty 0" is a separate,
documented choice). No route/schema/data change. Prep-less + macro-off homes otherwise unchanged.

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-23T10:59:20+08:00",
    "why_it_governs": "Understand before solving — each audit finding read back against the code (A26) before any fix.",
    "how_this_build_will_embody_it": "F4/F4b/F5 target the traced root (404-only mapping / no-else / hardcoded text-white), not the symptom." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-08-23T10:59:35+08:00",
    "why_it_governs": "Methodology in the tree, read THIS build (not the earlier builds' reads an hour ago).",
    "how_this_build_will_embody_it": "Re-opened every cited section fresh for this build (read_at ≥ started_at 10:45)." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-23T10:59:50+08:00",
    "why_it_governs": "Layer-2 effectivity + layer-4 surface — a mobile screen that lies (0/‘not available’) or hides its exit doesn't actually work for the rep.",
    "how_this_build_will_embody_it": "F4/F4b restore layer-2 honesty; F5 restores the layer-4 legibility of the only mobile exit." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-172", "read_at": "2026-08-23T11:00:05+08:00",
    "why_it_governs": "Proactive audit — THINK then search, quality over quantity, fix the clear ones + surface the rest.",
    "how_this_build_will_embody_it": "This build IS the audit follow-up: 3 verified clear bugs fixed, 3 design decisions surfaced (not unilaterally built)." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-58", "read_at": "2026-08-23T11:02:10+08:00",
    "why_it_governs": "Retrospective / pattern-detection — the audit was justified by the founder's REPEATED mobile-issue reports, a pattern across incidents, not one symptom.",
    "how_this_build_will_embody_it": "The proactive mobile audit reads the record of what actually broke before (mobile capture/UX reports) and sweeps the class, not the one screen." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-362", "read_at": "2026-08-23T11:02:25+08:00",
    "why_it_governs": "Guide, don't overtake — at a genuine decision (F1/F2/F3 design), ask before asserting.",
    "how_this_build_will_embody_it": "Only the clear class-matching bugs are fixed autonomously; the design decisions go to an AskUserQuestion picker for the founder to choose." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-374", "read_at": "2026-08-23T10:58:50+08:00",
    "why_it_governs": "Honesty is the moat — a failure shown as ‘0 pitches’ / ‘not available’ is a lie the rep builds on.",
    "how_this_build_will_embody_it": "F4/F4b make a load failure legible AS a failure (retry / ‘—’), never a false empty." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-455", "read_at": "2026-08-23T11:00:20+08:00",
    "why_it_governs": "The quick-decision checklist — incl. AMD-013 (a decision → a picker) which governs the F1/F2/F3 surfacing.",
    "how_this_build_will_embody_it": "Ran it: verified each finding, fixed the clear class, will picker the design decisions, added detection tests." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-23T11:00:35+08:00",
    "why_it_governs": "Methodology in the working tree — cited labels without content is the CAT-001 failure.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms via Read this build; no citation from cached memory." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-23T11:00:45+08:00",
    "why_it_governs": "Citations without a session-read are undetected A19 violations.",
    "how_this_build_will_embody_it": "Each cited asset carries a current in-session read_at (≥ started_at 10:45); the Session-Reads trailer lists them." },
  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-720", "read_at": "2026-08-23T11:00:55+08:00",
    "why_it_governs": "An audit finding is a SUSPECT; the fix completes the class, not just the instance.",
    "how_this_build_will_embody_it": "Verified each finding against the code; F4/F4b are the error-as-no-data class's client instances that slipped the prior sweep." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-23T11:01:05+08:00",
    "why_it_governs": "Encode the lesson in a gate that fails without cooperation.",
    "how_this_build_will_embody_it": "+2 detection tests: PitchDetail 500→retryable-not-‘missing’; home Pitches ‘—’-on-fail." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-23T11:01:15+08:00",
    "why_it_governs": "'Verified' names the exact command you ran.",
    "how_this_build_will_embody_it": "check.md pastes the full `npm run check` output + EXIT code." }
]
```
