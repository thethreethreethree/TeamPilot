# CLOSURE - give the KPI routes the caller's own client

The founder asked for a sweep of the whole system. Enumerating the 23 endpoints the native app calls, rather
than reasoning about likely suspects, found four routes still shipping the class this codebase has already
paid for four times: authenticate the caller by Bearer token, then read every row through a cookie client
that has no session. The app's KPI, Trend and Team screens have been showing every rep a confident nothing,
and a company admin has been told they are not a manager.

The more useful finding is the second one. INVARIANT 26 was written on 5 September specifically to stop this
class, and it could not see these four - because it looks for cookie clients in LIBRARIES reached from a
route, and these live in the routes themselves. The four bugs it was built from happened to be in libraries,
and that accident became the rule's boundary. The audit reported 0 violations for five days while three
screens were dead.

## What this does NOT do (un-named-reliance half)
- Not observed on production AFTER the fix. The before-state was measured with a real token; the after-state
  cannot be until this deploys.
- The KPI numbers themselves are not verified. This restores the READ; whether the metrics compute correctly
  over 73 sessions is a separate question nobody has asked yet.
- F3 (the app's launch recovery treating an unreadable file size as an empty recording) is recorded, not
  fixed - it lives in the other repository and its repair is a founder decision.
- No schema change, no policy change. RLS is unchanged; the caller simply reaches it as themselves.

## Residual (A36 - read from the TOP of the confidence ranking)
```json
[
  { "id": "R1-guard-boundary-still-narrow",
    "item": "Whether INVARIANT 26's boundary is NOW right, or whether it still encodes another property of its sample - it was confidently correct for five days while missing four routes, and I am the same author who drew the first boundary.",
    "why_skipped": "The rule now covers library modules and route bodies. What it still does not cover is a cookie client resolved in a route's own helper function defined in the same file but reached only on a web branch, and any Bearer mechanism not in BEARER_ROUTE_RE.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-10T13:20:00+08:00",
    "outcome": "OPENED. The honest position is that a boundary drawn by the author who missed the last one deserves suspicion. The next sweep should enumerate Bearer mechanisms from the code rather than from BEARER_ROUTE_RE, and check that list against the constant." },
  { "id": "R2-kpi-numbers-unproven",
    "item": "Whether the KPI compute produces sensible numbers now that it can see 73 sessions.",
    "why_skipped": "The bug was the read, not the arithmetic; nobody has looked at the arithmetic against real volume.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-10T13:35:00+08:00",
    "outcome": "OPENED, and it mattered. Read with the service role: the account has 73 coaching_sessions and ZERO with an outcome recorded (0 sold, 0 of any outcome), against 290 after_pitch_summaries. The Layer-1 money metrics - conversionRate, closeRate, winLossRatio - are computed FROM outcomes, so they will still read 'building' after this deploys. What will change is sessionCount (0 -> 73) and the six Layer-3 quality scores, which come from the summaries. Without opening this, the founder would have looked at the screen post-deploy, seen 'building' still there, and reasonably concluded the fix failed. Whether zero outcomes across 73 sessions is itself a defect - a silently failing write - or simply a feature nobody uses is a SEPARATE question, surfaced to the founder rather than answered here." },
  { "id": "R3-other-clients",
    "item": "The browser extensions authenticate by Bearer too. This sweep enumerated the endpoints the NATIVE APP calls; extension-only endpoints were not enumerated.",
    "why_skipped": "The founder's question came from the app, and the app's list is finite and known.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null }
]
```

## Verification
See check.md - the production probe with a real token, the mutation proof that the widened gate bites, and
the whole `npm run check` output with its exit code.
