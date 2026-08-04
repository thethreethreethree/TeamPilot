# Proposal — Paginate the unbounded message-thread loaders

> Status: **PROPOSAL — not applied.** Founder trigger: `"paginate the message threads"`.
> Author: autonomous session 2026-08-02. The DATA layer is designed here (UX-independent); the UI is
> presented as OPTIONS for you to choose, not decided (guide, don't overtake).

## 1. The problem (verified)

`supabase/config.toml max_rows = 1000`. Four loaders read an ENTIRE thread with no `.limit()`/`.range()`,
ordered ascending, so past 1000 rows PostgREST silently truncates and the NEWEST messages **vanish from the
thread** (plus a full-thread payload/memory cost on every open):

| Surface | Loader | Table |
|---|---|---|
| Team chat | `fetchMessages` (`lib/data/chats.ts:702`) | `chat_messages` |
| C.A.R.E support | `getConversationMessages` / `getConversationWithMessages` (`lib/data/care.ts:287,706`) | `support_messages` |
| Task discussion | `fetchTaskMessages` (`lib/data/tasks.ts:269`) | `task_messages` |
| Decision history | `fetchDecisions` (`lib/data/decisions.ts:30`, moderate-growth) | `decisions` |

Bites once a single thread crosses ~1000 messages (a long-running support email or a busy team channel). The
`INV21` guard (2026-08-02) now blocks *new* `.limit(N>1000)` false bounds; this is the real fix for the
already-unbounded reads.

## 2. Data-layer design (UX-independent — this part is not a UX call)

**Keyset (cursor) pagination, newest-first**, on `(created_at, id)`. Each thread loader gains two optional
params; called with none, behaviour is IDENTICAL to today for threads under the cap (so adoption is incremental
and safe):

```ts
// Example for chats; the same shape for support_messages / task_messages.
export async function fetchMessagesPage(
  topicId: string,
  opts?: { before?: { createdAt: string; id: string } /* compound cursor */; limit?: number /* default 50, max 200 */ }
): Promise<{ messages: ChatMessage[]; hasMore: boolean; nextCursor: { createdAt: string; id: string } | null }> {
  const limit = Math.min(opts?.limit ?? 50, 200);
  let q = supabase.from("chat_messages").select("...").eq("topic_id", topicId)
    // Tie-break on id so rows that share a created_at have a total order — see the CRITICAL note below.
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);                                   // +1 to detect hasMore
  if (opts?.before) {
    // "strictly older than the cursor" under (created_at DESC, id DESC):
    //   created_at < C  OR  (created_at = C AND id < cursorId)
    q = q.or(
      `created_at.lt.${opts.before.createdAt},and(created_at.eq.${opts.before.createdAt},id.lt.${opts.before.id})`
    );
  }
  const rows = (await q).data ?? [];
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);                     // the `limit` newest, still DESC
  const oldest = page[page.length - 1];                  // page's oldest row = the cursor for the next page
  return {
    messages: page.reverse(),                            // back to ascending for display
    hasMore,
    nextCursor: hasMore && oldest ? { createdAt: oldest.created_at, id: oldest.id } : null,
  };
}
```

**CRITICAL — why the compound `(created_at, id)` cursor is the DEFAULT, not an option (adversarial review
2026-08-02):** a bare `.lt("created_at", oldestOfPage)` cursor SILENTLY DROPS a message at the page boundary
whenever the discarded sentinel row (`rows[limit]`) shares a `created_at` with the page's oldest row
(`rows[limit-1]`) — the sentinel is dropped from this page AND excluded from the next by the strict `<`. Ties
happen in real threads (rapid messages, batch/import inserts), and a message thread that silently loses a
message is exactly the corruption this proposal exists to prevent. The compound cursor gives every row a total
order so no row can hide in a timestamp tie. A `(topic_id, created_at, id)` composite index per thread table
would keep the keyset fully index-only.

> **VERIFIED 2026-08-04 — NO MIGRATION IS ACTUALLY REQUIRED (the DB-migration gate is lifted).** The
> `(parent, created_at)` indexes the keyset needs ALREADY EXIST: `chat_messages_topic_created_idx`
> `(topic_id, created_at)` (0010), `support_messages_conversation_idx` `(conversation_id, created_at)` (0034),
> `task_messages_task_created_idx` `(task_id, created_at DESC)` (0021). Postgres scans an index backward for
> the newest-first (`created_at DESC`) order, so direction is not a blocker. The only thing the existing
> indexes lack is the trailing `id` — and that column only matters for rows sharing an EXACT `created_at`,
> where the `id` tie-break becomes a residual filter over that tiny same-timestamp cluster (typically 1–2
> rows), not a scan. So the existing indexes already support a correct AND performant keyset; adding `id` to
> the composite is an optional micro-optimization, NOT a prerequisite. Net: this becomes a **code-only,
> additive, no-migration** change — the remaining gate is purely the UI-option pick in section 3 below.

Other notes: keyset (not `offset`) so it's stable as new messages arrive; `limit+1` detects `hasMore` without a
count. The existing full-thread loaders stay until every caller adopts the paged one, then are deleted.

## 3. UI — three options (YOUR call)

The data layer serves any of these; pick per surface (chat and support may differ from tasks/decisions):

- **(A) "Load older" button** — initial newest-50, a button at the top fetches the next older page. Simplest,
  explicit, no scroll magic. Recommended default for support + tasks (agents scan recent, occasionally dig back).
- **(B) Infinite scroll upward** — auto-fetch the next older page when the user scrolls near the top. Smoothest
  for chat; needs scroll-anchoring so the viewport doesn't jump when older messages prepend.
- **(C) Windowed/virtualized** — only for a surface that must render thousands at once (none does today);
  more complex, defer unless a thread genuinely needs it.

Decisions (`fetchDecisions`) is a LIST, not a thread — there (A) "load more" or simple page-size + "view all"
fits; it's lower-growth so lowest priority.

## 4. Rollout + tests

1. Add the paged loader alongside each existing one (additive, no behaviour change).
2. Unit-test each: newest-first ordering, `hasMore`/`nextCursor` correctness, the `before` cursor filters
   older-only, and a >`limit` fixture returns exactly `limit` + `hasMore:true` (the regression the whole thing
   fixes). **Must-have tie case:** seed two messages with the SAME `created_at` straddling the page boundary
   (one as the page's last row, one as the sentinel) and assert BOTH appear across the two pages — this is the
   message-drop the compound `(created_at, id)` cursor prevents, and a bare created_at cursor fails it.
3. Wire the chosen UI per surface; delete the old full-thread loader once its callers migrate.
4. Staging check on a seeded >1000-message thread that the newest messages now appear (they currently don't).

Blast radius: additive data-layer functions + per-surface UI. No schema change, no migration. Sequence by
severity: support + team chat first (highest message volume), tasks next, decisions last.
