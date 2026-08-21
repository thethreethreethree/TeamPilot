# CLOSURE — Fold balance into the trend

## What shipped
The improvement-trend direction now reads THREE monotonic-good quality ratios (owned-action, focused, balanced)
instead of two — folding the balance signal into the "did our meetings improve?" trend (A20: built the
defensible default rather than deferring it to founder sign-off). Pure aggregate change + 1 test; the trend
route + tile consume it unchanged. Full `npm run check` exit 0 (3607 tests); no sales/server change.

## The un-named reliance
- **The direction heuristic + DOMINANCE_PCT are PROPOSED.** The founder can drop balance from the trend or tune
  the threshold — all isolated in the pure aggregate + speakerBalance util.

## Open
Founder sign-off on the proposed measurement (fields + trend heuristic); nav placement (Team-Sync); the two
remaining monitors need Team-Sync meeting metadata (agenda, roster).

## Residual (A36 — ranked by confidence it doesn't matter; the top is examined)

```json
[
  {
    "id": "equal-weight-ratios",
    "item": "The three trend ratios (owned, focused, balanced) are equal-weighted in the up/down count — no ratio matters more than another.",
    "why_skipped": "Equal weighting is the honest default absent evidence that one meeting-quality axis matters more; weighting would be an unvalidated judgment (a method counts as learned only when measured against the alternative on real data).",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-22T03:12:00+08:00",
    "outcome": "Examined against the measure-before-you-believe discipline: assigning weights (e.g., owned-actions matters 2x balance) would be an invented, unvalidated method — exactly the persuasive-but-unproven trap the constitution rejects until real before/after data confirms it. Equal weighting is the defensible starting point; the founder can reweight once real meeting data exists. Left equal, flagged as tunable."
  }
]
```
