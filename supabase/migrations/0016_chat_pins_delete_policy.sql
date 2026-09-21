-- A12 RE-RUNNABILITY GUARDS ADDED 2026-09-21. The statements below this line are the original
-- migration; the only change is that object creations are now guarded (drop-if-exists before
-- create policy/trigger, existence checks around create type, if-not-exists on indexes,
-- drop-before-create on views). NOTHING about the resulting schema changed — verified by
-- applying all 254 migrations twice against Postgres 16: 0 failures on a fresh database.
--
-- WHY AN APPLIED MIGRATION WAS EDITED. A12 (0021 and 0022 both failed live on "already
-- exists") requires migrations to be safe-to-re-run BY CONSTRUCTION. 18 of these were not, and
-- a later migration cannot fix an earlier one — on any replay 0001 still runs first. Tested:
-- a repair migration leaves 0001 failing exactly as before. Editing in place is the only thing
-- that reaches zero. Supabase never re-runs an applied migration, so production is untouched.
-- Founder decision, 2026-09-21. Record: docs/tbc/2026-09-21-migration-idempotency/.

-- 0016 — chat_pins DELETE policy (RLS gap fix)
--
-- Why
-- ───
-- Migration 0010 enabled RLS on chat_pins and added policies for
-- select / insert / update — but NOT delete. Under Postgres RLS, an
-- operation without a policy is denied by default. Crucially, DELETE
-- doesn't raise an error when denied — it returns success with 0
-- affected rows.
--
-- Symptom in the wild
-- ───────────────────
-- 1. User clicks unpin → client DELETE returns "ok" → 0 rows deleted.
-- 2. togglePin reports "we just deleted" → local UI flips to unpinned.
-- 3. User clicks re-pin → probe finds the OLD row still in the table
--    → enters DELETE branch AGAIN → reports another "deletion".
-- 4. Local state reconciles to unpinned. The pin label never appears.
-- 5. Hard refresh → fetchMessages reads the orphan row → message
--    appears pinned again.
--
-- The §1.7 audit's UI verification surfaced this. Caught by the user.
--
-- Policy shape
-- ────────────
-- Same scope as the existing update policy: company member who is a
-- current participant of the topic the pin belongs to. This is more
-- permissive than "only the original pinner can unpin" — the
-- constitution's §3.3 treats pins as organizational assets ("priority
-- data the brain learns from"), so company members own them
-- collectively, not the individual who pinned.

drop policy if exists "chat_pins - delete" on chat_pins;
create policy "chat_pins - delete" on chat_pins
  for delete using (
    company_id = auth_company_id()
    and exists (
      select 1 from chat_participants p
      where p.topic_id = chat_pins.topic_id
        and p.user_id = auth.uid()
        and p.left_at is null
    )
  );

-- Cleanup
-- ───────
-- The ghost rows accumulated during the bug window (rows the UI
-- believed were deleted but RLS kept alive) are NOT cleaned up here.
-- §3.1 says past data is past data. If you want to scrub them, run a
-- separate maintenance query via service-role — not a migration.
