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

**Keyset (cursor) pagination, newest-first**, on the existing `created_at` index. Each thread loader gains two
optional params; called with none, behaviour is IDENTICAL to today for threads under the cap (so adoption is
incremental and safe):

```ts
// Example for chats; the same shape for support_messages / task_messages.
export async function fetchMessagesPage(
  topicId: string,
  opts?: { before?: string /* ISO cursor */; limit?: number /* default 50, max 200 */ }
): Promise<{ messages: ChatMessage[]; hasMore: boolean; nextCursor: string | null }> {
  const limit = Math.min(opts?.limit ?? 50, 200);
  let q = supabase.from("chat_messages").select("...").eq("topic_id", topicId)
    .order("created_at", { ascending: false })          // NEWEST first
    .limit(limit + 1);                                   // +1 to detect hasMore
  if (opts?.before) q = q.lt("created_at", opts.before); // older than the cursor
  const rows = (await q).data ?? [];
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit).reverse();           // back to ascending for display
  return { messages: page, hasMore, nextCursor: hasMore ? rows[limit - 1].created_at : null };
}
```

Notes: keyset (not `offset`) so it's stable as new messages arrive; `limit+1` detects `hasMore` without a
count; `<` on the cursor (created_at is effectively unique per thread; if a same-ms collision is ever a
concern, extend the cursor to `(created_at, id)`). The existing full-thread loaders stay until every caller
adopts the paged one, then are deleted.

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
   fixes).
3. Wire the chosen UI per surface; delete the old full-thread loader once its callers migrate.
4. Staging check on a seeded >1000-message thread that the newest messages now appear (they currently don't).

Blast radius: additive data-layer functions + per-surface UI. No schema change, no migration. Sequence by
severity: support + team chat first (highest message volume), tasks next, decisions last.
