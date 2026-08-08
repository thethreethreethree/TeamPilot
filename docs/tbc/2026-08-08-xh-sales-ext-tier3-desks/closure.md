# CLOSURE — Tier-3 support-desk adapters

## What shipped
Four support-desk auto-read adapters (Zendesk, Intercom, Front, Gorgias — coverage #16-19), reusing the live
C.A.R.E desk selectors (RCD path dropped). Sales extension auto-read coverage: 13 → 17 platforms. Routing is
execution-tested including the `.endsWith()` wildcard predicates. No manifest change (activeTab injection); each
adapter self-gates by hostname, so a rep who doesn't use a desk is unaffected.

## Un-named-reliance check
The desks rely on the same "reasoned selectors, confirm-live-per-platform" posture as every adapter here — they
are NOT independently browser-confirmed in this build (no browser in the sandbox). What makes shipping them
honest rather than a promise: (a) they reuse selectors already running in the live C.A.R.E extension, not fresh
guesses; (b) a wrong grab degrades to a VISIBLE preview → manual highlight (the xg safety net); (c) an empty
grab degrades to the "No conversation captured yet" guard. The reliance on live confirmation is named in
PLATFORM-COVERAGE.md, not hidden.

## Residuals
```json
[
  {
    "id": "R1-desk-selectors-confirm-live",
    "item": "The four desk selectors are reused from C.A.R.E but not browser-confirmed in this build against each desk's current DOM.",
    "why_skipped": "No browser / logged-in desk accounts in the sandbox; per-platform live confirmation is founder-only (PLATFORM-COVERAGE.md). Same posture accepted for all 17 adapters.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-08T03:16:00Z",
    "outcome": "OPENED per A36. Traced this session: worst case for any desk selector is a wrong-non-empty grab (now VISIBLE via the xg capture preview → rep re-highlights) or an empty grab (→ 'No conversation captured yet' guard). Both route to the always-correct manual path; neither silently mis-coaches. The selectors reuse code already exercised in the live C.A.R.E extension, so they start from real-world use, not a blank guess. Blast radius bounded to 'rep does one manual highlight on a desk whose DOM drifted'. Correct next action stays: founder confirms each desk live per the runbook — flagged, not guessed."
  },
  {
    "id": "R2-reddit-zoom-unbuilt",
    "item": "Coverage #14 Reddit and #15 Zoom Team Chat remain unbuilt.",
    "why_skipped": "Reddit needs NEW reasoned selectors (no C.A.R.E reuse) = added speculation; Zoom's web-chat surface reachability is unconfirmed (the doc says 'confirm the web surface exists first'). Building either would cross from reuse into guessing under the build guard.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-08T03:17:00Z",
    "outcome": "OPENED and held as a flag. Both remain usable TODAY via manual highlight (the extension works on any site); only auto-read is absent. They are surfaced in PLATFORM-COVERAGE.md 'still unbuilt' as founder-priority calls, not silently dropped. No action without either a reuse source (Reddit) or confirmed reachability (Zoom)."
  }
]
```
