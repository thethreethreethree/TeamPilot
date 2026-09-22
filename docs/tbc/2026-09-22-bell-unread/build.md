# BUILD — read means shown

## What was built

No migration. No schema change. No new endpoint — the mark-read route has accepted
`{ ids: [...] }` since it was written; nothing had ever sent one.

### Read means shown

- **write-path:** `src/components/sales-coach/NotificationBell.tsx` — `markShownRead()`, which
  posts `{ ids }` naming the rows the panel displayed, and `post()`, the one place either answer
  reaches the network. `markAllRead()` keeps `{ all: true }` for the button that says so. The
  server side is unchanged: `POST /api/coach/gamification/notifications` has accepted `{ ids }`
  since it was written.
- **read-path:** the bell's own `onClick` is the only caller of `markShownRead`, and
  `NotificationBell.render.test.tsx` asserts the POST body it produces — the ids it showed, never
  `{ all: true }`. Reverting the call site fails two tests by name.

Two lines, in two files, that disagreed about what "all" meant:

```ts
// route: the read is bounded
.order("created_at", { ascending: false }).limit(50)

// bell: the write is not
if (!open && unread > 0) void markAllRead();   // → POST { all: true }
```

`{ all: true }` is a service-role update with no limit: `read_at = now()` for every unread row
belonging to the caller. The panel shows fifty. **Opening the bell therefore marked read an
unbounded number of notifications it had never displayed**, and there is no pagination, so those
rows had no second chance to be seen.

The automatic path now names the rows it showed:

```ts
const ids = items.filter((n) => n.read_at === null).map((n) => n.id);
if (ids.length === 0) return;          // `{ ids: [] }` is a 400 and says nothing anyway
setUnread((u) => Math.max(0, u - ids.length));
await post({ ids });
```

**The unbounded write stays.** Deleting it would have been the easy call and the wrong one. A
recipient with 137 unread rows needs a way to say *I am done with these* without opening a panel
43 times, and the button in the panel header already says **Mark all read** — a person pressing it
has said what they mean. The defect was never that an unbounded write exists; it was that a
gesture meaning **let me look** performed one.

### An unread count over the whole table

- **write-path:** `src/app/api/coach/gamification/notifications/route.ts` — a second, `head: true`
  count request over `manager_notifications` filtered to `read_at is null`, replacing
  `rows.filter(...).length` over the fetched page.
- **read-path:** the bell's `load()` consumes it as `d.unread ?? 0` and the badge renders from it;
  the `unread: null` case is asserted (no badge rather than a number nothing stands behind).

```ts
const { count: unreadCount } = await supabase
  .from("manager_notifications")
  .select("id", { count: "exact", head: true })
  .is("read_at", null);
```

It used to be `rows.filter(r => r.read_at === null).length` — unread *within the newest fifty*.
Its own request rather than riding on the list's `count`, because the list is not filtered to
unread and its count is a different number. `head: true` means no rows come back.

**Best-effort, and honest when it fails.** A failed count returns `unread: null` and the bell shows
no badge — rather than falling back to the page's own tally, which is the undercount with a
confident face on it. The client reads `d.unread ?? 0`, so `null`, `undefined` and a genuine zero
all produce no badge, which is correct: all three mean *I have no number to show you*.

### The panel says when it is showing a page

- **write-path:** the same route returns `total` from `count: "exact"` on the list request.
- **read-path:** `NotificationBell.tsx` renders the header line only when `total > items.length`;
  three tests cover the page-is-the-set case, the absent-count case (an older bundle) and the
  bounded case.

`Showing the 50 most recent of 137.` — a header line rather than a footer, because the panel
scrolls and a footer would sit below fifty rows nobody scrolls past.

`total` is a **new field**; `notifications` and `unread` keep their names and their shapes. A
bundle from before this change ignores `total`, renders the list exactly as it did, and — because
`unread` can now be `null` — simply shows no badge in the one case where the count failed. The
fourth new wire field today, and the first written with the previous-shape harness already in
place.

## Ripple

- **The realtime subscription** re-fetches rather than prepending, so the new count arrives
  through the same path as the poll. Untouched.
- **The optimistic update** now subtracts what was marked instead of zeroing. With 137 unread and
  3 shown the badge reads 134 immediately, and the next poll agrees with it.
- **`markAllRead`** still zeroes locally, which remains correct for what it does.
- **Two round trips per poll** instead of one. A `head: true` count on
  `manager_notifications_unread btree (recipient_id, read_at)` — the index already exists; the
  list query was the expensive one.
