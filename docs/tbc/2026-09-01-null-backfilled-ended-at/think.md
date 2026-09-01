---
started_at: 2026-09-01T09:00:00+08:00
---

# THINK — null the misleading backfilled `ended_at` (raw session rows made honest)

## Why (founder directive + the record)
The founder saw "32051.9 min" as an average session duration and demanded the KPIs be honest. The code fix
(`MAX_WALLCLOCK_SECONDS = 4h` in conversationDuration.ts) already neutralizes the poison on every READ surface. The
founder then chose, from a picker, to also **clean up the raw data** so the stored rows themselves are honest —
not merely corrected at read time. This is that cleanup.

## Understanding (§0, §1.2 — diagnosed from the live record, not theorized)
Root cause established against the live DB, not guessed: the 0070 `active→ended` trigger stamps `ended_at = now()`
whenever a session's status flips to `ended`. When auto-close-stale-cron closed a batch of long-open sessions at
once on 2026-08-21, **207** of them received the identical `ended_at = 2026-08-21T00:28:33.175267+00:00`
regardless of when the call truly ended (many started in June) → wall-clock spans up to **54.7 days**. A read-only
preview (`scripts/diag-backfilled-ended-at.mjs`) classified the whole `ended`-set exactly as the migration's WHERE
does: **218** rows match "no audio AND span > 4h" (the 207 cluster + 11 later stale-close artifacts of the same
class). Every one is an implausible LIVE call (min span 4.8h) with no real audio length — i.e. a fabricated end
time, never a real one.

## Honesty (§3.4 — clear the wrong number, don't invent a right one)
A session whose only "end time" was stamped by the stale-close cron never had a *knowable* end. The honest raw
value is therefore **NULL** ("ended, end-time unknown"), NOT a guessed real close-time. The migration sets
`ended_at = NULL` and leaves `status = 'ended'` untouched. It does **not** fabricate a plausible duration. Uploads
(`audio_duration_seconds` present) are never touched — their true audio length is the trusted duration, so their
`ended_at` is irrelevant to any metric; **13** audio-backed >4h rows are deliberately left alone.

## The build (one condition-based, idempotent UPDATE)
`supabase/migrations/0240_null_backfilled_session_ended_at.sql`:
`update coaching_sessions set ended_at = null where audio_duration_seconds is null and ended_at is not null and
extract(epoch from (ended_at - started_at)) > 4*3600;` — condition-based (not the exact literal timestamp, which a
tz/precision mismatch made unreliable), and idempotent (a second run matches 0 rows because they are already null).

## Ripple — what else reads ended_at (holistic trace)
`conversationDurationSeconds` returns `null` for a missing `ended_at` → these sessions show "duration unknown"
everywhere (After-Pitch header, Sessions list, KPI averager already excludes null-duration sessions). No consumer
keys "ended" off `ended_at` (status is the flag; auto-close-stale filters `status='active'`), so clearing the
timestamp changes no control flow. The 0070 trigger fires on status *transitions*, not on a direct `ended_at`
update, so nulling does not re-trip it. Recurrence for future stale-closes is covered by the code cap (out of
scope here, flagged as a residual).

## Verification (A38 — the command + evidence, not the word)
`npm run db:apply` → all 30 live invariants PASS (pasted in check.md). Before/after run of the read-only preview:
target **218 → 0**; 13 audio-backed rows untouched both times (pasted in check.md). No unit test — this is a
one-shot data migration, verified by the live before/after count, not by an assertion.

## Session-read manifest (A22 — read_at ≥ started_at 09:00; each re-read THIS session)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-01T09:00:30+08:00",
    "why_it_governs": "Understanding precedes solving — the target set was diagnosed from the live DB before writing the UPDATE.",
    "how_this_build_will_embody_it": "Ran the read-only preview and confirmed 218 rows + the 2026-08-21 cluster BEFORE applying." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-09-01T09:01:00+08:00",
    "why_it_governs": "Methodology in the working tree, consulted this session.",
    "how_this_build_will_embody_it": "CLAUDE.md is in context; the cited ThinkerThinker axioms were re-opened this session (below)." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-68", "read_at": "2026-09-01T09:01:30+08:00",
    "why_it_governs": "Retrospective identification — identify the problem from the actual record.",
    "how_this_build_will_embody_it": "Root cause traced to the 0070 trigger + the dated backfill cluster in the live rows, not theorized." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-09-01T09:02:00+08:00",
    "why_it_governs": "Layer-2 effectivity — the cleanup must actually make the raw rows honest end-to-end.",
    "how_this_build_will_embody_it": "Verified target 218→0 against the live DB after apply; not 'the SQL looks right'." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-160", "read_at": "2026-09-01T09:02:30+08:00",
    "why_it_governs": "THINK-first — a preview script classifying the exact WHERE before mutating.",
    "how_this_build_will_embody_it": "Wrote diag-backfilled-ended-at.mjs to preview the target set + the audio-backed rows it must NOT touch." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-372", "read_at": "2026-09-01T09:03:00+08:00",
    "why_it_governs": "Honesty — never fabricate a number the data cannot support.",
    "how_this_build_will_embody_it": "Sets ended_at NULL (unknown), never a guessed real close-time; status untouched." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-470", "read_at": "2026-09-01T09:03:30+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: diagnosed from the record, looked at the target before overwriting, traced ripple, kept honesty." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-466", "read_at": "2026-09-01T09:04:00+08:00",
    "why_it_governs": "Methodology in the working tree, not cited from cache.",
    "how_this_build_will_embody_it": "Re-opened A19 this session before citing it." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-601", "read_at": "2026-09-01T09:04:30+08:00",
    "why_it_governs": "Citations require session-reading.",
    "how_this_build_will_embody_it": "This manifest pairs each cited § with a fresh read_at; the commit carries a Session-Reads trailer." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-773", "read_at": "2026-09-01T09:05:00+08:00",
    "why_it_governs": "Gate the lesson — a fix in prose alone recurs.",
    "how_this_build_will_embody_it": "The DURABLE guard is the code cap (already shipped + tested); this migration is the one-time raw cleanup, and the residual names the un-gated recurrence at the trigger." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1004", "read_at": "2026-09-01T09:05:30+08:00",
    "why_it_governs": "'Verified' names the command + evidence.",
    "how_this_build_will_embody_it": "check.md pastes db:apply's 30-invariant PASS and the live before/after 218→0 count." }
]
```
