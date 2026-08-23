# BUILD — Prep-up orphan-draft reuse (audit D5)

### the create route reuses an empty draft (no orphan per visit)
- write-path: new `getOrCreateDraftMeetingPrep({companyId})` in `meetingPrep.ts` — queries the caller's
  most-recent unlinked, goal-null draft (RLS + created_by/company_id scoped), then in code confirms topics-empty +
  status 'draft' + zero documents; reuses it if TRULY empty, else `createMeetingPrep`s fresh. `POST /meeting-prep`
  now calls it instead of always-create.
- read-path: repeated /prep visits reuse the one empty draft (≤1 per user between real preps) instead of orphaning
  a new empty row each time; the client receives an empty prep either way (transparent).

### the conservative "empty" definition can't resurface real work
- write-path: reuse requires goal null AND topics empty AND status 'draft' AND session_id null AND doc count 0;
  ANY content → fresh; a probe error → fresh (never blocks starting).
- read-path: a prep the user actually worked on (goal, topics, or a document) is NEVER reused — worse than an
  orphan row is avoided by construction.

## Files
- `src/lib/data/meetingPrep.ts` — `getOrCreateDraftMeetingPrep` (createMeetingPrep unchanged, used as the fallback).
- `src/app/api/coach/meeting-prep/route.ts` — route calls get-or-create; header updated.
- tests: `meetingPrep.draftReuse.test.ts` (NEW, +5: reuse-when-empty; create-fresh on no-empty / topics / doc /
  probe-error) + `meeting-prep/__tests__/route.test.ts` (mock swapped to getOrCreateDraftMeetingPrep).

## Ripple (holistic)
Client UNCHANGED (MeetingPrepUp still POSTs on mount + receives an empty prep) → the H2 flush-on-Start HIGH-fix +
the render gate are untouched (that's exactly why the server approach was chosen over a client refactor). Owner-
scoped, no cross-user/tenant reach. No schema change. Rare doc-only prep isn't reused (a one-off, not accumulating);
two parallel tabs share one reused draft (minor, rare, lower-impact than the orphan).
