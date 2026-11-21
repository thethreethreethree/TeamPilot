# CLOSURE - RSS Phase 5

## What is true now (as written, not as run)

Anyone can search the calls they are allowed to open by the words said (exact words, phrases, OR, -exclude) and by
channel, rep, outcome, dates, score range and keyword tracker; each matching line opens the call at that moment.
Searches can be saved and removed. Managers export the results as CSV. On a phone/video call, anyone can save the
call or cut a clip into their own library; managers save to the company library, which files the rep's
team-example consent request; peers hear a company item only while the rep's consent stands.

## Residual

```json
[
  {"id": "R1-gate-not-run", "item": "npm run check not run; 0280 not applied.", "why_skipped": "No Node; Supabase suspended.", "confidence_it_does_not_matter": "low", "opened_at": null, "outcome": "OPEN."},
  {"id": "R2-filters", "item": "Spec filters not built: talk ratio, rubric element, disputed. Global search box (across the app) and recording downloads not built.", "why_skipped": "Scope of this pass.", "confidence_it_does_not_matter": "medium", "opened_at": null, "outcome": "OPEN."},
  {"id": "R3-whole-recording", "item": "A peer allowed to play a clip receives a signed URL to the whole recording.", "why_skipped": "Consent (0260) is per recording, so whole-recording access is within what the rep approved; clip-only audio would need cutting files.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-20T01:00:00Z", "outcome": "Opened: within consent."},
  {"id": "R4-unscored-calls", "item": "A call with no pitch score has no consent record, so it cannot reach peers.", "why_skipped": "Consent keys on pitch_scores (0260).", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-20T01:00:00Z", "outcome": "Opened: fails closed; the save message says so."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
