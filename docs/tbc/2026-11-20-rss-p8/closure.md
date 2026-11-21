# CLOSURE - RSS Phase 8

## What is true now

A company admin sets how many recordings each rep keeps, on Settings → Protection, and the nightly clean-up uses it
(no setting keeps today's 20; if the setting can't be read, nothing is removed). A manager can trim a section out of
a rep's call: it is skipped in playback, gone from the transcript for everyone, and the AI's reads are redone; a
restore brings it back. A company admin can erase a customer's data on request: find their calls by phone, email
or name, check each one, and erase — their words, recordings and the AI's reads go; the call, its rep and its score
stay; the request keeps only a hash. Every re-score, correction, deletion, trim, restore, export, retention change and erasure is written
to an audit log that cannot be edited, and company admins read it on the same tab. A new route that does one of
those things without recording it fails the invariant audit.

## Residual

```json
[
  {"id": "R1-erasure-job", "item": "The erasure job and request form (first written as not built, pending a decision).", "why_skipped": "Real erasure deletes; §3.1 forbade it without an amendment.", "confidence_it_does_not_matter": "low", "opened_at": "2026-11-20T21:00:00Z", "outcome": "RESOLVED same build: founder picker chose 'Amend §3.1, build it'; AMD-014 ratified, 0285 + /api/coach/remote/erasure + Settings → Protection; executed end to end on PG 16.4 (check.md addendum)."},
  {"id": "R2-db-not-applied", "item": "0284 is not applied to production.", "why_skipped": "Supabase suspended.", "confidence_it_does_not_matter": "low", "opened_at": "2026-11-20T21:00:00Z", "outcome": "Opened: OPEN.md (with 0271-0283)."},
  {"id": "R3-rls-as-authenticated", "item": "0284's read rules not executed as signed-in users (admin allowed, manager refused, other company refused).", "why_skipped": "The replay runs as superuser.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-20T21:00:00Z", "outcome": "Opened: OPEN.md sql-harness item."},
  {"id": "R4-looked-at", "item": "Phase 8 'Looked at' (an erasure request for a phone number removes that customer's sessions; the audit log shows who asked) not done on a real device.", "why_skipped": "Needs a live database (Supabase suspended); the same flow ran on PG 16.4 in the replay.", "confidence_it_does_not_matter": "low", "opened_at": "2026-11-20T21:00:00Z", "outcome": "Opened: OPEN.md, after 0284/0285 are applied."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
