# CLOSURE — Coach Assessment stale → door pitches feed the coaching content

## What shipped
The founder-directed fix for the stale Coach Assessment. Diagnosis (from live data) refuted the assumed capture/backoff
bugs — the pipeline works; the assessment was fed ONLY by coaching-session dissects while the reps' main work is door
pitches, which never fed it. The founder chose to feed door pitches in and merge the text. Now each rep's
`pitch_analyses` strengths/improvements merge into the SAME Doing Well / Coaching Focus columns (newest-first,
alongside coaching-session dissects), a rep is counted as having content on sessions OR pitches, and the badge shows
"N sessions dissected · M pitches analyzed". Verified live: Moses's 36 pitches surface; a pure-pitcher is no longer
blank.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). The merge aggregator has 4 tests (both shapes, interleave, pure-pitcher,
malformed-degrade); typecheck + lint clean; 591 files / 3869 tests. Live population confirmed by direct query.

## The un-named reliance
- **The route's per-rep merge isn't unit-tested against a live roster** (the route test uses an empty roster to check
  the gate). The MERGE is unit-gated and the population was live-verified; that the manager UI renders the merged card
  correctly is founder visual-verify.
- **`pitch_analyses` RLS** restricts a rep to their own rows; the manager read uses the ADMIN (service-role) client
  which bypasses RLS — the same trust model the existing company-agents + dissect-event reads already use. This makes
  door-pitch COACHING TEXT (strengths/improvements) manager-visible; the private numeric SCORES are NOT read here.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "The rep's OWN view (/my-training) still uses dissect-only content — it does NOT yet merge door pitches. A rep looking at their own coaching signal there won't see their pitch content.",
    "why_skipped": "The founder's task was the MANAGER Coach Assessment (the screenshots). Giving my-training the same aggregateCoachingContent merge is a small, symmetric follow-up.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-28T04:25:00+08:00",
    "outcome": "OPENED — bounded follow-up; apply the same merge to my-training if the rep self-view should match."
  },
  {
    "id": "R2",
    "item": "The combined 'signal' count is dissectCount + pitchCount shown as two labeled numbers; a session that is BOTH dissected and (rarely) after-pitch'd is not deduped in the COUNT (content is deduped by recency). Door-pitch subjects and coaching-session subjects are different session ids, so overlap is negligible.",
    "why_skipped": "Counts are shown as distinct labeled figures (sessions vs pitches), so there is no single inflated number; Task 3 (KPI accuracy) will revisit counts holistically.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-28T04:25:00+08:00",
    "outcome": "OPENED — revisit under Task 3."
  }
]
```
