# CLOSURE — capture preview

## What shipped
The Sales Coach panel now previews the captured conversation (bounded snippet), not just its character count,
so a wrong-but-non-empty Tier-2 selector grab is self-evident to the rep — who re-highlights manually rather
than coaching on garbage. §3.4 (honesty) applied to input capture; A39 (scrape-boundary fidelity) surfaced to
the human; A30 (gate the class) via a detection test that fails on the count-only regression.

## Un-named-reliance check
This fix relies on the rep *reading* the preview to notice a wrong grab — a human-in-the-loop defense, not a
mechanical one. It does NOT make the Tier-2 selectors correct; those remain reasoned/runtime-unverified and
founder-verified per PLATFORM-COVERAGE.md. That reliance is named here, not hidden: the preview de-risks a
wrong grab; it does not eliminate the underlying selector uncertainty.

## Residuals
```json
[
  {
    "id": "R1-selectors-still-unverified",
    "item": "The Tier-2 adapter selectors (telegram/teams/discord/twitter/googlechat/googlevoice) remain reasoned, not runtime-verified. The preview surfaces a wrong grab but does not prove any selector is right.",
    "why_skipped": "The build sandbox has no browser/logged-in accounts; verifying live DOM is founder-only (PLATFORM-COVERAGE.md). Guessing a 'fix' to an unverifiable selector is the builder-under-pressure / A38 confident-wrong trap.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-08-08T02:58:00Z",
    "outcome": "OPENED per A36 (the residual I'm least sure about is the one most likely to matter). Traced this session: for the six Tier-2 adapters a wrong selector now degrades to a VISIBLE wrong preview → the rep re-highlights (the manual path always works), and an empty match still degrades to the honest 'No conversation captured yet' + the runTool guard. So the unverified selectors can no longer silently mislead: worst case is a visible-wrong or empty capture, both of which route the rep to manual highlight. The residual is real but its blast radius is now bounded to 'rep does one manual highlight'. Correct action remains: founder verifies each Tier-2 selector live (flagged, not guessed)."
  },
  {
    "id": "R2-preview-length-heuristic",
    "item": "The 90-char preview length is a heuristic; a wrong grab whose first 90 chars happen to look plausible could still slip past a skimming rep.",
    "why_skipped": "90 chars is enough to show the opening of the actual thread vs sidebar/other-thread chrome in the common case; a longer preview crowds a 360px panel. Tuning without live data is speculative.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-08T02:58:30Z",
    "outcome": "OPENED and resolved: the preview is anchored to the START of the captured text (`slice(0, 90)`), which is exactly where a wrong grab differs from a right one — sidebar/nav/other-thread chrome leads with different opening words than the real thread. So even 90 chars discriminates in the common case. A skim-past is possible but its cost is bounded (one manual re-highlight), and 90 chars is a display choice trivially tunable later against real founder feedback. No action needed now."
  }
]
```
