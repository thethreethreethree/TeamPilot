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
