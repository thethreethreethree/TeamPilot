# BUILD — a rep's best pitches had no list

### Serve the highest counted pitches, with what a card needs to link
- write-path: `src/app/api/coach/sales-session/pitch-score/best/route.ts` — one GET returning
  `pitchId`, `sessionId`, `recordedAt`, `total` and `outcome`, ranked by total, qualifying only,
  three by default and ten at most.
- write-path: caller-scoped, so RLS decides; defaults to the caller's own `rep_id`, because a
  manager's request with no `repId` would otherwise rank the whole company and present it as one
  person's best work.
- read-path: the Progress board's three cards get a score, a date and a session to open.

### Let a deleted session keep its score
- write-path: `session_id` is `on delete set null`, so the row is returned with a null link rather
  than filtered out.
- read-path: the card renders without a tap instead of offering one that goes nowhere. A rep's best
  pitch does not stop existing when its recording is purged.
