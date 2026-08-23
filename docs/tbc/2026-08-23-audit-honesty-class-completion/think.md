---
started_at: 2026-08-23T11:45:00+08:00
---

# THINK — completing two audit classes to their boundary: desktop error-as-no-data + Door Log back

Two remaining audit items, both COMPLETIONS of already-authorized work swept to their A26 boundary (not new
scope, not gold-plating):

## Desktop home tiles — error-as-no-data (completes the F4b class per the founder's standing directive)

**Root.** F4b fixed the mobile Pitches pill to show "—" on a failed dashboard fetch. The DESKTOP home tiles
(DeckStat: Sessions/week, Growth reviews, Live cues, Growth ops) are the OTHER consumer of the same `stats` state
— on a fetch failure they still render `stats?.X ?? 0` = "0", which reads as "zero activity", not "load failed".
The inline "0 is an honest empty" rationale is exactly the conflation the audit debunked: 0 is honest for a
GENUINE zero, not for a FAILURE. The founder has a standing "sweep + fix error-as-no-data on client sales
surfaces" directive; A26 says complete the class to its boundary — the desktop tiles are the last instance on this
page. **Fix:** each tile (and the Sessions sub) renders `statsError ? "—" : …` — the same flag + marker as the
mobile pill and the macro totals. A genuine 0 still shows 0.

## Door Log in-page back (completes the founder's "systemic back — one fix covers all" picker choice)

**Root.** F1/F2 added a systemic back to `TopBar`, but Door Log renders NO TopBar, so the systemic fix can't reach
it — the one SC mobile surface still without an in-page back. The founder's picker chose "systemic back — one fix
covers all pages"; A26 boundary → Door Log needs its equivalent. **Fix:** an IDLE-ONLY "← Sales Coach" link at the
top of DoorLog (never shown mid-knock/record/name, so it can't intrude on the field flow), to the SC home. Lower
value than the TopBar pages (a macro rep can also return via the Home tab), but it honors "covers all" and is
low-risk.

## Why this is the boundary (§5 honesty about stopping)
After this, the remaining backlog is genuinely gold-plating (D3 coverage-race — latent, can't manifest with
one-cue-at-a-time), founder-scoped-out (D5 — the founder chose "D1 and D2"), or founder-side (device validation).
I will NOT manufacture past this; the honest next state is a hold for the founder's device validation / direction.

## Ripple (holistic)
`statsError` is the existing F4b flag (already set on fetch-failure) — the desktop tiles just newly CONSUME it, so
no new state/fetch. `DeckStat.value` is `ReactNode`, so "—" is type-clean. Door Log's back link is idle-only +
`self-start` (no layout disruption to the field states). No route/schema/data change; a genuine zero still shows 0.

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-23T11:51:10+08:00",
    "why_it_governs": "Understand the root — the desktop tiles conflate 'genuine 0' with '0-on-failure'; verified against the code before fixing.",
    "how_this_build_will_embody_it": "Fixes the traced root (the tiles consuming stats without the statsError branch), not a symptom." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-08-23T11:51:20+08:00",
    "why_it_governs": "Methodology in the tree, read THIS build.",
    "how_this_build_will_embody_it": "Re-opened every cited section fresh (read_at ≥ started_at 11:45)." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-23T11:51:35+08:00",
    "why_it_governs": "Layer-2 effectivity — a tile that says '0 sessions' on a load failure doesn't actually deliver the truth; a page with no in-page back breaks continuity.",
    "how_this_build_will_embody_it": "Desktop tiles show the honest '—'; Door Log gains its in-page back." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-172", "read_at": "2026-08-23T11:51:50+08:00",
    "why_it_governs": "Proactive audit + sweep the class to its boundary, not the one instance.",
    "how_this_build_will_embody_it": "Completes the error-as-no-data class (mobile→desktop) + the systemic-back class (TopBar→Door Log)." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-362", "read_at": "2026-08-23T11:52:00+08:00",
    "why_it_governs": "Guide, don't overtake — Door Log back completes a choice the founder made via picker; I did not invent it.",
    "how_this_build_will_embody_it": "Both fixes execute founder-authorized intent (a standing directive + a picker choice), not a unilateral new decision." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-374", "read_at": "2026-08-23T11:50:40+08:00",
    "why_it_governs": "Honesty is the moat — '0 sessions' on a fetch failure is a lie the rep builds on.",
    "how_this_build_will_embody_it": "The desktop tiles show a failure AS a failure ('—'), never a false empty." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-431", "read_at": "2026-08-23T11:52:05+08:00",
    "why_it_governs": "The biggest risk is the builder under pressure — being honest about the true stopping point (not manufacturing to satisfy a guard, nor stopping while genuine scope remains) is the §5 discipline.",
    "how_this_build_will_embody_it": "Shipped the last authorized class-completions, then named the honest boundary — no gold-plating past it, no premature stop before it." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-455", "read_at": "2026-08-23T11:52:10+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: verified against code, swept the class boundary, traced ripple, added detection tests, and named the true stopping point." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-23T11:52:20+08:00",
    "why_it_governs": "Methodology in the working tree — no cited-from-cache labels.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms via Read this build." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-23T11:52:30+08:00",
    "why_it_governs": "Citations without a session-read are undetected A19 violations.",
    "how_this_build_will_embody_it": "Each cited asset carries a current in-session read_at (≥ started_at 11:45); the Session-Reads trailer lists them." },
  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-720", "read_at": "2026-08-23T11:52:40+08:00",
    "why_it_governs": "The fix is incomplete until the class is swept to its boundary.",
    "how_this_build_will_embody_it": "Completes both classes' last instances (desktop tiles; Door Log) + names the honest stopping point beyond them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-23T11:52:50+08:00",
    "why_it_governs": "Encode the lesson in a gate.",
    "how_this_build_will_embody_it": "+2 detection tests: desktop tiles '—'-on-fail; Door Log idle-only back link present/absent." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-23T11:53:00+08:00",
    "why_it_governs": "'Verified' names the exact command you ran.",
    "how_this_build_will_embody_it": "check.md pastes the full `npm run check` output + EXIT code." }
]
```
