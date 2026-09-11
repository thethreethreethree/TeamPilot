# BUILD - a session should be dated when the conversation happened

### Decide whether to believe a phone's claim about when it recorded
- write-path: `src/lib/coach/v5/sessionStartedAt.ts` - one pure function. Returns the instant when
  it is inside a believable window, and `null` otherwise. Bounded on BOTH sides and refusing rather
  than clamping, because clamping invents a timestamp and an invented one is indistinguishable from
  a real one the moment it is stored.
- write-path: the backward bound is 90 days, set from measurement - the longest a real recording has
  waited in this product is 47 days (the recovery sweep's record, 2026-09-10). The forward bound is
  5 minutes, deliberately tight: a session dated ahead pins itself to the top of every list ordered
  by time and stays there, which is the more damaging of the two errors.
- read-path: every caller gets one answer to "do we believe this", instead of each deciding for
  itself and drifting.

### Accept it at the route, and let the column default when it is not believed
- write-path: `src/app/api/coach/sales-session/route.ts` - `startedAt` is a new OPTIONAL string on
  the create schema, passed through `sessionStartedAt` before it reaches the data layer. The schema
  accepts the SHAPE and the helper decides the TRUST, so the question of what to believe lives in
  one tested place rather than in a validator.
- write-path: `src/lib/data/salesCoach.ts` - `createSession` takes an optional `startedAt` and
  OMITS the column entirely when it is absent. An explicit null would overwrite the column's own
  `now()` default with nothing; omitting it preserves exactly today's behaviour.
- read-path: a web session is completely unchanged - it sends no `startedAt`, so the insert is
  byte-identical to before and is still dated as the rep starts talking, which is correct there.

### Send the recording's own instant from the phone
- write-path: `Elostate-Sales-coach/src/lib/audio/upload-flow.ts` - the create call now carries
  `startedAt: rec.recordedAt`, the instant stamped when the recorder wrote the file.
- read-path: a call recorded on the 4th and uploaded on the 11th now appears in the rep's history on
  the 4th. The sessions list groups by `started_at`, so it also stops a row filed as "Door, Thu 10
  Sep at 4:53 PM" from sitting under a **Today** heading - a screen disagreeing with itself in one
  line, which is what the automatic title would otherwise have produced.

### The gate (A30)
- write-path: `src/lib/coach/v5/__tests__/sessionStartedAt.test.ts` (9) pins both refusals, the
  skew allowance, the normalisation, and the relationship between the window and the measured
  47-day worst case rather than the bare number.
- read-path: three mutations each fail exactly one named test - trusting a future timestamp,
  trusting any backdate, and shrinking the window below a real 47-day wait. A regression that
  starts believing a broken clock breaks a test rather than filing a rep's conversation in 2019.
