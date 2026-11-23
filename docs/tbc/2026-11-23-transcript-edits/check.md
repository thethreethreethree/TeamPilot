# CHECK - Editable transcripts

## Commands

```
npx vitest run src/lib/coach/__tests__/transcriptEdits.test.ts "src/app/api/coach/sales-session/[id]/transcript-edit" → 11 passed, exit 0
mutation: tree rule replaced by true in access() → 1 failed | 6 passed; restored
npx tsc --noEmit -p . → exit 0
```

PGlite replay of 0311 (twice, re-runnable) with 0309 on the repo's Supabase shim:

```
edit line 1    -> 2
same words     -> 2                       (no new version)
no such line   -> refused: transcript edit: no such line
empty text     -> refused: transcript edit: the corrected line must have 1-4000 characters
versions: v1 "we can do fifty a month" kept; v2 "we can do fifteen a month"; line 2 copied unchanged
edits: [{"seq":1,"from_version":1,"to_version":2}] · after update seq: 1 (update ignored)
rep reads edits: 1 · authenticated call: refused (permission denied for function edit_tran…)
after session delete, edits: 0
exit 0
```

Production:

```
npm run db:apply → applying 0311_transcript_line_edits.sql … ok · DB now at 0311 · ✅ ALL 32 invariants hold
```

## Findings

### F1 - the AI-written summary and review keep the earlier words
class: derived text computed once per transcript version, refreshed only for free engines.
sweep: `grep -n "generateSessionArtifacts" "src/app/api/coach/sales-session/[id]/transcript-edit/route.ts"` → none
(on purpose: five paid engines per edit); trackers and stats are redone.
severity: low

### F2 - a corrected line is not re-timed
class: the corrected words keep the original line's times, so word-level timing inside the line is approximate.
sweep: `grep -n "spoken_at, ended_at" supabase/migrations/0311_transcript_line_edits.sql` → copied unchanged.
severity: low

### F3 - two gate catches before commit
class: rls-audit (append-only table without per-operation policies or allowlist) and invariant 32 (a read of the
transcript base table).
sweep: `npm run check` → both flagged; the edit log's insert/update/delete are allowlisted with reasons (writes only
inside edit_transcript_line), and the route's one base-table read is excused with why it cannot mix versions. Re-run:
`npm run check` exit 0, 6471 tests.
severity: low
