# BUILD - RSS Phase 5

## Migration
- 0280_rss_p5_library.sql — GIN index to_tsvector('simple', text) on coaching_transcript_segments; snippets;
  library_folders; library_items; library_item_removals; saved_searches (removed_at once, trigger-guarded).
  Select-only RLS; append-only rules; no client writes.

## Library code
- src/lib/coach/remote/search.ts — parseCallSearch, runCallSearch (caller's client), callSearchCsv (formula-safe).
- src/lib/coach/remote/library.ts — validateSnippet, canPlay, shareBySession (shareState verdict per call).

## Routes
- GET /api/coach/remote/search; GET /api/coach/remote/search/export (managers, CSV).
- GET/POST/PATCH /api/coach/remote/saved-searches.
- GET/POST /api/coach/remote/library (Mine/Company; add call or clip; remove).

## Screens
- /dashboard/sales-coach/search — filter rail, hits that open the call at the moment, save search, export CSV.
- /dashboard/sales-coach/library — Mine / Company, clip playback, "Approved by {rep}" / "Waiting on … approval",
  ask again, take out.
- RemoteCallPanel — clip start/end + title, Save to Mine / Company, consent request filed through the existing
  share route, `?t=` deep link.
- Links: Coach Assessment, Sessions page, save confirmation.

## Gates written to
- rls-audit allowlist for every write op on the five tables; INV29 company_id on every service-role statement;
  INV36 library route calls treeFilterReps; INV26 callerScopedDb(req) ?? createClient(); INV14.

## Tests
- search.test.ts, library.test.ts, library route test.
