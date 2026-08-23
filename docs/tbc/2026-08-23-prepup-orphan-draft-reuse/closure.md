# CLOSURE — Prep-up orphan-draft reuse (audit D5)

## What shipped
The one D5 audit item with a clean, low-risk fix: `POST /api/coach/meeting-prep` now REUSES the caller's
most-recent truly-empty draft (via `getOrCreateDraftMeetingPrep`) instead of orphaning a new empty `meeting_preps`
row on every /prep visit-and-leave. Chosen (of three approaches) because it is server-only + client-transparent —
the H2 flush-on-Start HIGH-fix and the render gate are untouched — with the resurface-real-work risk contained by
a conservative "empty" definition (goal null + topics empty + draft + no session + no docs) and 5 detection tests.
`npm run check` EXIT 0; owner-scoped; no schema change.

## The un-named reliance
- Reuse relies on the conservative emptiness check being COMPLETE — any missed content dimension would risk
  resurfacing a worked-on prep. The five dimensions (goal / topics / status / session / documents) are each pinned
  by a test; ANY content → fresh; a probe error → fresh (fail-open to create, never blocking the flow).
- Client-transparency relies on the reused draft being genuinely empty (so the client renders empty fields, same
  as a new draft) — guaranteed by the emptiness check.

## Residual (A36)

```json
[
  {
    "id": "prepup-empty-prep-start-hint-and-pending-audio",
    "item": "Two remaining D5 UI items NOT built (deliberately): a hint when Start is tapped with an empty prep (start-a-prep-less-meeting confirmation), and the pending-audio review's 'try again' lacking a terminal 'may not have been recorded' state.",
    "why_skipped": "Both are UX-design calls (empty-start confirmation copy/behaviour; pending-audio retry cadence + terminal threshold), not clear bugs with one right fix — the founder's decision. The empty-start case is also entangled with the client create/render flow this fix deliberately did NOT touch.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-23T12:20:00+08:00",
    "outcome": "Flagged for a founder UX decision; the backend orphan-hygiene half is done."
  },
  {
    "id": "two-tab-shared-draft",
    "item": "Two parallel /prep tabs now share one reused empty draft (last-write-wins on PATCH) instead of creating two separate preps.",
    "why_skipped": "A rare edge (two simultaneous prep tabs) with lower impact than the orphan it replaces; the single-conversation editing model already assumes one active draft.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-23T12:20:00+08:00",
    "outcome": "Flagged; add optimistic concurrency only if multi-tab prep editing becomes real."
  }
]
```
