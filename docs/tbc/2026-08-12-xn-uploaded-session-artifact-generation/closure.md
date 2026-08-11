# CLOSURE — uploaded-recording sessions generate the summary

## What shipped
Uploaded-recording Sales Coach sessions now generate the post-call summary/dissect/pivot/moments/intel after
the transcript is labeled — the same artifact set live sessions get on Stop. Root cause: the new
mobile-recording/voice-memo upload feature (0a873a3c) added a transcript source (`/label-transcript`) that was
never wired to the generation `/finalize` runs, so uploaded calls had a transcript but no summary — the
founder's "old sessions show the summary page, new ones don't" (old = live, new = uploaded). Fixed by
extracting finalize's generation into a shared `generateSessionArtifacts` (A16) and calling it from
`/label-transcript` via `after()`, so the label response stays instant while the engines finish server-side.

## Un-named reliances (A35)
- **The `runAndStore*` engines use the admin (service-role) client + explicit companyId/actorId.** This is
  what makes it safe to run them in `after()` (post-response, no request cookies). Verified in salesSummary.ts
  (`createAdminClient()`); the other four follow the same pattern.
- **`/label-transcript`'s 409 already-has-transcript guard is the once-guard for generation.** Generation
  fires only on the first successful label, so it can't double-generate; a re-label 409s before the append.
- **Runtime verification defers to the founder's deployed test.** No live ElevenLabs/LLM keys or DB in this
  sandbox, so the end-to-end (upload → transcribe → label → summary appears) is verified structurally (the
  trigger + args are unit-tested; the engines are the proven finalize ones) but not executed live. The founder
  is actively testing uploads and will see the result on deploy.

## Residual (A36 — ranked by confidence-it-does-not-matter; top OPENED)
```json
[
  { "id": "R1", "item": "EXISTING uploaded sessions created BEFORE this fix (transcript, no summary) do not self-heal fully — the dissect-backfill cron regenerates only the DISSECT (runDissectBackfill), not the summary/pivot/moments/intel.", "why_skipped": "The fix is forward-looking (all NEW uploads generate correctly, which is the founder's stated complaint). Backfilling old ones is a separate, cost-bearing sweep (5 engines × N old sessions) that is a founder cost decision (§5), and the handful of test sessions the founder made can be regenerated on demand via the SessionCoachTools summarize button.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-12T02:20:00Z", "outcome": "Opened + assessed: confirmed runDissectBackfill covers dissect only. Surfaced to the founder as an option — extend the cron (or a one-time script) to run the full generateSessionArtifacts for sessions that have a transcript but no summary event. NOT bundled here to avoid a large unrequested LLM-cost sweep; forward-fix ships now." },
  { "id": "R2", "item": "Brief window after labeling where the Expert Conversation-summary section is still empty (generation runs ~10-40s in after()).", "why_skipped": "Matches the live flow (finalize also generates around session-end, not instantly). The After-Pitch 'Your read' — the Standard summary page — auto-generates on view, so the primary post-call surface is immediate; the Expert dense summary fills in within a minute on next view.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-12T02:22:00Z", "outcome": "Opened + assessed: confirmed the Expert [id] Conversation-summary section is HIDDEN (not error-labelled) while empty, and its load is a plain GET /summarize that re-reads on next mount — so once the after() generation lands (~10-40s), the next view shows it. The Standard After-Pitch page (the primary post-call 'summary page') auto-generates its own narrative on view, so it is never blank for an uploaded session. No stranding: the user is not shown a broken/empty state that persists. Acceptable — matches live-session timing. If instant Expert display is later wanted, auto-generate-on-view (like After-Pitch) is the follow-up, but it adds LLM cost per view and is not needed for the founder's complaint." }
]
```

## Gate result (`npm run check`)
```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ · rls:audit ✓
invariant:audit ✓ — Violations 0
tbc ✓ — docs · manifest (16) · artifacts · residual (2) · freshness all ✓
test ✓ — Test Files 394 passed | 1 skipped (395); Tests 2723 passed | 15 skipped (2738)
CHECK_EXIT=0
```
