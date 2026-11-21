# CHECK - RSS Phase 8

## Commands

```
npm run check exit 0
  typecheck, lint, theme, rls, invariant (0 violations), reachability, writer, enum audits: exit 0
  migration:audit SKIPPED — no reachable Postgres (NOT a pass; PGlite replay below)
  sql:harness     SKIPPED — no reachable Postgres (NOT a pass)
  Test Files 781 passed | 1 skipped (782); Tests 5999 passed | 15 skipped (6014)
```

PGlite 16.4 replay of all 282 migrations (0271-0284 applied twice), then executed:

```
applied 282/282
re-applied 14/14
before trim: 1@v1:video-mic 2@v1:video-mic 3@v1:video-mic 4@v1:manual
OK   trim 55s-70s
after trim:  1@v1:video-mic 3@v1:video-mic 4@v1:manual        (line 2 at 1:00 gone; untimed line 4 kept)
copy -> 2
after copy:  1@v2:video-mic 3@v2:video-mic 4@v2:manual        (provenance kept)
OK   re-transcribe (replace) writes a full new version
after re-transcribe: 1@v3:null                                (the cut line stays cut in a new version)
OK   restore
after restore: 1@v3:null 2@v3:null
ERR  second restore of same trim → 23505 recording_trim_restores_once
ERR  audit update refused → P0001 RSS: audit_log is append-only
ERR  audit delete refused → P0001 RSS: audit_log is append-only
audit rows still: 1
exit 0
```

INVARIANT 37 detection test: replacing the export route's recordAudit call made the audit report it (Violations 2,
"Route does something the audit log exists for, and does not record it"); restoring it returned Violations 0.

Not run: the Phase 8 "Looked at" (needs erasure, which is not built, and a live database); RLS allowed/refused tests
executed as authenticated users for the 0284 read rules.

## Findings

### F1 - the scaffold's policies call functions the signed-in role cannot execute
class: an RLS policy calling a function revoked from `authenticated` errors for every signed-in reader.
sweep: `grep -n "rss_is_company_admin\|rss_is_manager" supabase/migrations/*.sql` → defined and revoked in 0272,
used in no live policy; the scaffold's 0278 used them in five. 0284 uses auth_company_id() + admin_roles().
severity: high

### F2 - a trim done as a transcript version is undone by the next re-transcribe
class: a privacy cut stored in one version, while four writers (replace, relabel, assign voices, hourly recovery)
each insert a full new version.
sweep: `grep -n "insert into coaching_transcript_segments" supabase/migrations/*.sql` → 0269/0270/0277/0284 writers;
the filter lives in coaching_transcript_segments_current, which INVARIANT "transcripts are read from
coaching_transcript_segments_current" already makes the only read path.
severity: high

### F3 - a retention window guessed on a failed read deletes audio
class: a destructive job falling back to a default when its settings read fails.
sweep: `grep -n "loadRetention\|KEEP_PER_REP" src -r` → the cron is the only reader; it now fails closed (tested).
severity: high

## Addendum 2026-11-20 — erasure

```
npm run check exit 0
  invariant:audit Violations: 0 (INVARIANT 38 added)
  Test Files 783 passed | 1 skipped (784); Tests 6011 passed | 15 skipped (6026)
  migration:audit, sql:harness SKIPPED — no reachable Postgres (NOT a pass)
```

PGlite 16.4: 283 migrations applied, 0271-0285 re-applied (15/15), then one call seeded with the customer's number in
two transcript versions, a cue, an AI summary event, follow-through + callback task, tracker hit, snippet, library
item, Ask Coach chat and a scored pitch with an evidence quote; a second call untouched:

```
matches: e9 «reach me at (555) 010-0123 after five»
other company sees nothing: 0
plain delete before erasure does nothing — lines still there: 2
ERR refuse a session from another company list → P0001 RSS erasure: request not found for this company
erased: {"ai_reads":1,"sessions":1,"tasks_blanked":1,"ask_coach_chats":1,"transcript_lines":2}
AFTER — transcript: 0 cues: 0 ai events: 0 follow-through: 0 tracker: 0 snippets: 0 library: 0 chats: 0
KEPT — session row: {"client_label":null,"territory":null,"context":"phone","rep":true}
       score: {"total":"72.0","transcript":null,"audio_url":null} element: {"grade":"hit","points":"8.0","evidence":null}
       task: {"title":"Call back (details erased on request)","description":null} task events titles: ["[erased]"]
UNTOUCHED — other call's lines: 1 other call's summary: 1
completion: [{"sessions_erased":1}]
ERR second run refused → P0001 RSS erasure: this request has already been carried out
after erasure, plain deletes are no-ops again — other call still has lines: 1
exit 0
```

INVARIANT 38 detection test: a probe file calling rss_erase_sessions → Violations 1 ("A second path into erasure");
removed → Violations 0.

### F4 - a phone number typed with its country code found nothing
class: an identifier matched by exact digit substring when the stored and typed forms differ by a prefix.
sweep: the first executed find, "+1 (555) 010-0123" against a line "(555) 010-0123" → "matches:" empty; every phone
search path runs through rss_erasure_matches and normaliseIdentifier (`grep -rn "rss_erasure_matches\|normaliseIdentifier" src supabase`).
severity: high
