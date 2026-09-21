# BUILD — the rep is told, instead of finding out

### A rep as the recipient of a `manager_notifications` row

- write-path: `supabase/migrations/0257_notify_pitch_score_corrected.sql` — the `type` CHECK gains
  `pitch_score_corrected`.
- write-path: no new table and no second bell. 0242's table is structurally generic —
  `company_id`, `recipient_id`, `agent_id`, `type`, `payload`, `read_at`, with RLS granting
  `recipient_id = auth.uid()`. Only its NAME and its CHECK were manager-specific.
- write-path: the migration says plainly that the table's name is now narrower than its contents,
  and that renaming it was considered and **not** done: it has run in production and is read by a
  route, a component and a realtime subscription, which is a large blast radius for making a
  comment accurate.
- read-path: `NotificationBell` already reads whatever the caller is the recipient of, so a rep
  receives this through the bell they could always see and which had never had anything in it.

### The dedupe index means something different for this type

- write-path: `src/lib/coach/pitchScore/notifyCorrection.ts` — upserts on
  `(recipient_id, type, session_id)` with an **UPDATE**, not `ignoreDuplicates`.
- write-path: this is the whole reason the module exists separately from `gamification/notify.ts`.
  That writer resolves the agent's MANAGERS as recipients and ignores duplicates — correct for a
  strong session, which happens once. A manager can correct two items on one pitch minutes apart,
  and under ignore-on-conflict the rep would silently not be told the second time.
- write-path: `created_at` and `read_at` are both set explicitly. `created_at` has a column default
  which only applies on INSERT, so on the conflict path the row would keep the first correction's
  timestamp and the alert would sort as old news; `read_at: null` is what makes a corrected-again
  pitch unread again. The result is one alert per pitch that resurfaces, not a pile.
- read-path: the payload carries `item_label`, `total` and `qualifying`, so the bell renders
  without a join — the same reason 0242 denormalised `agent_name`.

### Never failing a correction that already landed

- write-path: the override route awaits the notifier **in sequence**, not floated. A floating
  promise is dropped when a serverless invocation is frozen on response — silently, and on exactly
  the busy requests where it matters.
- write-path: wrapped in `try/catch` at the route as well as inside the notifier. Not
  belt-and-braces: the notifier's internal catch is a promise the route cannot enforce, and if it
  is ever broken the cost is a correction that **already moved the score** reporting as a 500. The
  manager then applies it again, logging a second override on a score that was already right, in
  an append-only table.
- read-path: a failed notification degrades to the behaviour that existed before this build — the
  rep finds out by opening the pitch. That is a degradation, not a defect in the score.

### The bell says it to the rep, in the second person

- write-path: `src/components/sales-coach/NotificationBell.tsx` — a `pitch_score_corrected` branch
  in `text()`, addressed to *you*. Every other alert in this bell is a manager reading about
  somebody else; this is the recipient reading about themselves.
- write-path: *"A manager made a correction to Options close — your score is now 72.5"*, and when
  an override crosses the 40-base line downward, *"and it no longer counts"*. A rep whose pitch
  stopped counting must not learn it from a leaderboard they have quietly fallen off.
- write-path: **a dot, not a glyph.** Every icon in that file is a graphic asset, and placing a new
  one without having opened and looked at it is what LAW 1 forbids — a mark that renders invisibly
  against its own ground is exactly the failure that rule exists for, and no render of a candidate
  glyph was available. A token-coloured dot is styling, carries the same severity signal, and is
  inspectable in the two theme blocks it uses.
- read-path: the alert links to `/dashboard/sales-coach/[id]` — the session page, where
  `PitchScorePanel` renders the corrections section built earlier today. **Not** `/after-pitch`
  (the debrief) and **not** `doors/report-card/[pitchId]`, which belongs to the Door Log, takes a
  different id, and merely shares the word "pitch". The first draft of this link pointed at the
  door-log route.
- read-path: the component's docblock no longer calls it the manager's bell, because it is not one.
