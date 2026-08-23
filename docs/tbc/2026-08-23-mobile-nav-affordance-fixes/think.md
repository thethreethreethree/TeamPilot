---
started_at: 2026-08-23T11:15:00+08:00
---

# THINK — mobile back-nav affordance (F1/F2) + label de-collision (F3), per the founder's picker

The two DESIGN findings from the mobile Sales Coach UX audit that the founder chose via an AskUserQuestion picker
(the clear bugs F4/F4b/F5 shipped separately in `260aa536`/`0affa4c3`). Founder picks: F1/F2 = "Systemic back
button (Rec.)"; F3 = "Rename non-macro card (Rec.)".

## F1/F2 — systemic mobile back affordance (§3.3: founder chose it; §1.5.1 layer-3 continuity)

**Root, from the code.** The SC mobile surface has only the bottom tab bar for chrome; `TopBar` rendered NO back
(only a hamburger, gated `!inSalesCoach`). So a page reached from a home card (Roleplay, One Liners) or any non-tab
route left a rep with no in-page way back and no lit tab — disorientation (not a hard dead-end; the tab bar is
present). Verified roleplay/strategy render `<TopBar>` mobile-visible (not desktop-only), so a TopBar affordance
reaches them; the SC home renders TopBar only in its desktop branch, so the back button never appears on the home.

**Fix (the founder's "systemic" pick over the per-page "targeted" one).** One change in the shared `TopBar`:
`showSalesCoachBack = inSalesCoach && pathname !== "/dashboard/sales-coach"` → a mobile-only "← Back"
(`router.back()`) that covers every current + future SC page that renders TopBar. Non-SC routes keep their
hamburger unchanged (the back + hamburger are mutually exclusive). Door Log (no TopBar) is not covered by this
single fix — but the Home tab already returns a macro rep there, so it is a noted minor follow-up, not a
dead-end (residual).

## F3 — "Pitch Performance" label collision (§1.5.4: the founder specified the resolution)

**Root.** "Pitch Performance" resolved to `/analytics` for a non-macro rep (home card) but to `/doors/report-card`
for a macro rep (the new nav tab) — the same name, two destinations. **Fix:** rename the non-macro card to
"Pitch Analytics" (per the founder's picked recommendation), so "Pitch Performance" now uniquely means the macro
report card, and the card name aligns with the Analytics screen it opens.

## Why these are safe to build now
Both are the founder's explicit picker selections (the designated input channel), both LOW-RISK + reversible: F1
is additive + default-off for non-SC routes (the shared-component blast radius is contained — verified no other
test renders the real TopBar unmocked); F3 is a one-word label change. §1.5.4: the founder named the resolution,
so it is the intended result (layer-2), built + test-locked here — not deferred as polish.

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-23T11:24:10+08:00",
    "why_it_governs": "Understand the surface first — verified how TopBar renders on SC mobile (which pages, home-excluded) before wiring the back button.",
    "how_this_build_will_embody_it": "The fix targets the traced root (TopBar has no back on SC routes), and F3 renames the actual collision, not a symptom." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-08-23T11:24:20+08:00",
    "why_it_governs": "Methodology in the tree, read THIS build.",
    "how_this_build_will_embody_it": "Re-opened every cited section fresh (read_at ≥ started_at 11:15)." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-23T11:24:35+08:00",
    "why_it_governs": "Layer-3 continuity — a page a rep can enter but not leave (except by guessing a tab) breaks the workflow.",
    "how_this_build_will_embody_it": "The systemic back button restores in-page continuity on every SC mobile TopBar page." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-172", "read_at": "2026-08-23T11:24:50+08:00",
    "why_it_governs": "These came from the proactive audit; the fix is the right-altitude systemic one, not per-page band-aids.",
    "how_this_build_will_embody_it": "One TopBar change covers all SC TopBar pages; Door Log's separate case is flagged, not silently skipped." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-231", "read_at": "2026-08-23T11:25:05+08:00",
    "why_it_governs": "The founder specified the resolution (picker) — so it is the intended result (layer-2), not deferrable polish.",
    "how_this_build_will_embody_it": "Built + test-locked both picker selections; not filed as a follow-up." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-362", "read_at": "2026-08-23T11:25:20+08:00",
    "why_it_governs": "Guide, don't overtake — these design decisions went to the founder's picker BEFORE building.",
    "how_this_build_will_embody_it": "Built exactly the two options the founder selected; did not unilaterally pick a resolution." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-455", "read_at": "2026-08-23T11:25:35+08:00",
    "why_it_governs": "The checklist — incl. AMD-013 (the decision WAS a picker) + AMD-012 (specified experience = layer-2).",
    "how_this_build_will_embody_it": "Ran it: picker for the decisions, traced ripple (shared TopBar blast radius), detection tests, explained WHY." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-23T11:25:50+08:00",
    "why_it_governs": "Methodology in the working tree — no cited-from-cache labels.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms via Read this build." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-23T11:26:00+08:00",
    "why_it_governs": "Citations without a session-read are undetected A19 violations.",
    "how_this_build_will_embody_it": "Each cited asset carries a current in-session read_at (≥ started_at 11:15); the Session-Reads trailer lists them." },
  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-720", "read_at": "2026-08-23T11:26:10+08:00",
    "why_it_governs": "Audit findings are SUSPECTS — verified against the code before acting.",
    "how_this_build_will_embody_it": "Confirmed F1's TopBar-mobile-visibility + F3's collision against the code before the fix." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-23T11:26:20+08:00",
    "why_it_governs": "Encode the lesson in a gate.",
    "how_this_build_will_embody_it": "+3 TopBar detection tests (back shows on non-tab SC / hidden on home / hamburger on non-SC) + the F3 rename test." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-23T11:26:30+08:00",
    "why_it_governs": "'Verified' names the exact command you ran.",
    "how_this_build_will_embody_it": "check.md pastes the full `npm run check` output + EXIT code." }
]
```
