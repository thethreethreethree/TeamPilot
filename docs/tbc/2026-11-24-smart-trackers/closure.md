# CLOSURE - Smart trackers: the same idea in any words

## What is true now

A manager can add a tracker from example sentences ("Same idea, any words"); each finished sales call is read once by
AI for all of the company's smart trackers (up to 10), and a new one reads the manager's last 10 calls in the
background. Hits show on the call like keyword hits, at the moment said, as "like “example”". No customer words are
stored in a hit.

## Residual

```json
[
  {"id": "R1-precision", "item": "How often the AI's matches are right is unmeasured on real calls.", "why_skipped": "Needs managers' use on production calls; there is no smart tracker yet.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-24T01:20:00Z", "outcome": "Accepted; the founder can try one on known calls (OPEN.md)."},
  {"id": "R2-cap-race", "item": "Two managers adding a smart tracker at the same instant could pass the cap of 10; the scanner then reads the oldest 10.", "why_skipped": "Rare and harmless: nothing is lost, the newest tracker just isn't read until one is switched off.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-24T01:20:00Z", "outcome": "Accepted."},
  {"id": "R3-no-preview", "item": "Smart trackers have no 'preview on recent calls' before saving.", "why_skipped": "A preview would bill AI reads for a tracker that may never be saved; the backfill after saving shows the same thing.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-24T01:20:00Z", "outcome": "Accepted."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
