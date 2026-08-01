# Proposal — RCD capture idempotency (re-capturing a thread no longer duplicates it)

> Status: **PROPOSAL — not applied.** Founder trigger: `"dedup RCD captures"`.
> Author: autonomous session 2026-08-02. Touches customer-PII ingestion + storage bytes, so (guide, don't
> overtake) it is a draft for your approval. This is the one product-intent call in it
> (dedup-and-update vs versioned snapshots) — everything else is mechanical.

## 1. The bug (and why it reads as an oversight, not a design)

`POST /api/care/extension/rcd` does a plain `.insert()` into `care_rcd_conversations`. `external_ref` (the
channel-native thread id) is a **nullable `text` with NO unique constraint**, and the route has no dedup. So
re-capturing the same WhatsApp/Gmail thread — a re-open, a double-click, or an extension retry — creates a
SECOND full conversation row (+ duplicated `care_rcd_messages` + `care_rcd_media` rows + a second set of signed
upload URLs). The messages table's `unique(conversation_id, seq)` only dedups *within* one conversation, not
across re-captures. RCD is EXTENSION-triggered, so the client-side re-entrancy latch can't fully close it.

**Two pieces of evidence this is unfinished work, not intent:**
1. `external_ref`'s own column comment in `0194_care_rcd.sql` reads: *"Optional channel-native thread id, if
   the adapter can resolve one **(dedup/link)**."* — the dedup role was DESIGNED; the enforcing constraint was
   never added.
2. Every OTHER external-identifier column in the codebase carries a dedupe UNIQUE and is commented "dedupe key":
   `support_messages.external_message_id`, `fin_bank_txn.external_id`, `fin_card_txn.external_id`,
   `fin_payroll.external_id`. RCD is the sole deviation.

So the intent is clear (dedup). The only genuine product question is what a re-capture MEANS.

## 2. Step 0 — DRY RUN (read-only; how bad is it already?)

RCD holds customer PII; run this yourself (do not export). Counts existing duplicate threads without touching
anything:

```sql
select count(*) as dup_groups, coalesce(sum(cnt - 1), 0) as excess_conversations
from (
  select company_id, external_ref, count(*) as cnt
  from care_rcd_conversations
  where external_ref is not null
  group by company_id, external_ref
  having count(*) > 1
) x;
```

If `excess_conversations = 0`, this is purely preventive (like onboarding). If not, a one-time cleanup is
needed FIRST (section 5) because the unique index can't be created while duplicates exist.

## 3. The product call — what is a re-capture?

- **(a) dedup-and-UPDATE (recommended).** The same thread captured again = the SAME conversation, refreshed to
  the newer snapshot (an RCD thread grows between captures — more messages). This matches the "(dedup/link)"
  intent and the 4× convention. On a repeat `external_ref`, replace the conversation's children with the new
  capture and bump `message_count` / `captured_at`.
- **(b) versioned snapshots.** Keep every capture as a distinct point-in-time row (deliberate history). Then
  the fix is smaller — just guard *accidental* exact double-fires (same `external_ref` + same `message_count`
  within ~N seconds → skip) and surface "captured ×N" in RcdPanel so the agent knows it's a re-capture.

My read: **(a)**, because RCD is used as "the current state of this thread," not a version log, and the column
comment says dedup. But (b) is defensible if you want capture history. The rest of this proposal specs (a);
(b) is a strict subset (the short-window guard only).

## 4. The migration + route change — Option (a)

```sql
-- 02NN_rcd_capture_dedup.sql  (number at apply time; run AFTER any section-5 cleanup)
-- Partial: a capture with no channel-native thread id (external_ref null — e.g. a manual paste) genuinely
-- can't be deduped by ref, so those are exempt from the constraint (they stay insert-only). If you later want
-- to dedup those too, add a content-hash column; out of scope here.
create unique index if not exists care_rcd_conversations_company_extref_uq
  on care_rcd_conversations (company_id, external_ref)
  where external_ref is not null;
```

Route (`care/extension/rcd`): when `externalRef` is present, do a dedup-aware write inside a transaction/RPC:

1. `select id from care_rcd_conversations where company_id = $co and external_ref = $ref` (now unique).
2. **New thread** (no row): insert as today.
3. **Re-capture** (row exists): this is the load-bearing nuance — **the old media BYTES must be removed, not
   just the rows.** `care_rcd_media` rows cascade on the conversation/message FKs, but the STORAGE OBJECTS in
   the `care-rcd-media` bucket do NOT cascade. So the update path must: (i) list the old `storage_path`s,
   (ii) `storage.remove` them, (iii) delete the old `care_rcd_messages` (media rows cascade), (iv) insert the
   new snapshot's messages/media, (v) `update … set message_count, captured_at`. Order (bytes before rows)
   mirrors the retention cron's anti-orphan discipline (`e0d4810f`). If a byte-remove fails, keep the row and
   surface a partial-failure count rather than orphaning bytes — same posture as the RCD retention cron.

Because step 3 races with a concurrent re-capture of the same thread, take `pg_advisory_xact_lock(hashtext(
company_id || ':' || external_ref))` at the top of the transaction (same primitive as the onboarding-lock
proposal — and still the only advisory lock in the tree, so collision-free).

## 5. If the dry run found existing duplicates — one-time cleanup FIRST

For each dup group, keep the MOST RECENT capture (largest `captured_at` — the freshest snapshot) and delete the
older ones (their messages/media cascade). Like the transcript-dedup proposal, this DELETEs customer PII, so it
is a reviewed migration, not auto-applied — and it must also `storage.remove` the losers' media bytes before
deleting their rows (same anti-orphan order). I'll spec the exact cleanup SQL once the dry-run count is known;
if it's 0, skip this section entirely.

## 6. Tests + rollout

1. Unit/integration: a second capture with the same `(company_id, external_ref)` updates the existing
   conversation (message_count reflects the NEW snapshot; old media bytes removed) rather than inserting a
   second row; a capture with `external_ref = null` still inserts (exempt); two DIFFERENT threads don't
   collide; the advisory lock serializes a concurrent double-capture to exactly one row.
2. Rollout: run the dry-run → (cleanup if needed) → apply the index → ship the route change. Low risk for the
   null-external_ref path (unchanged); the dedup path is new behaviour, so verify on staging with a re-capture.

## 7. Blast radius

One partial unique index + a route/RPC change + (only if the dry-run is non-zero) a one-time PII cleanup. The
null-`external_ref` capture path is unchanged. Media-byte handling is the sharp edge — the anti-orphan order
(bytes before rows) is the load-bearing detail, already proven in the retention crons.
