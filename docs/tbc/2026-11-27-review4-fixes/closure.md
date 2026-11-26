# CLOSURE - Review 4 fixes

## What is true now

Erasure blanks a topic member in every stored group version, retired ones included, and reads the company's other calls
only when an erased call mentions a group member, stopping as soon as each candidate is found on a kept call. A webhook
claim that can't be written fails the send run with a 500. Only the extension's connect page waits for the sign-in code.

## Residual

```json
[
  {"id": "R1-earlier-erasures", "item": "Groups whose member came only from calls erased before 0385 keep that member (no intel is left to match).", "why_skipped": "Nothing left to decide it from.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T23:53:00Z", "outcome": "Measured after commit (production, counts only): 0 erasure completions and 0 topic groups, so no earlier erasure can have missed one."},
  {"id": "R2-at-least-once", "item": "A webhook sent and then not recorded (run killed) is sent again after 10 minutes.", "why_skipped": "At-least-once; receivers de-duplicate on the delivery id (documented).", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-26T23:53:00Z", "outcome": "Recorded."}
]
```

## Un-named reliance

Intel topics stay at payload.intel.topics.

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
