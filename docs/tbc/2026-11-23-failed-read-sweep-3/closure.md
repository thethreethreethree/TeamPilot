# CLOSURE - Third sweep: failed reads shown as "none"

## What is true now

When the team passwords can't be loaded, both dialogs say so instead of "No team password yet — create one". On a
call's page, if its review can't be loaded the paid "Generate growth review" waits for a refresh (with the reason on
screen); if the rep's own read can't be loaded the composer for a new one is hidden; if the summary can't be loaded
the summary card says so. A new guard fails any screen that sets an empty list after a failed `.ok` check.

## Residual

```json
[
  {"id": "R1-catch-null-unguarded", "item": "`fetch(...).catch(() => null)` itself is not guarded (158 uses); a new screen could still mishandle the null without using the else form.", "why_skipped": "The spelling is harmless on its own; only the handling after it matters, and that can't be matched without false alarms. The else form — the shape found — is guarded.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T21:10:00Z", "outcome": "Accepted; recorded here."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
