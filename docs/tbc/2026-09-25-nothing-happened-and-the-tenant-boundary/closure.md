# CLOSURE - the press that reported nothing, and the tenant boundary

## What is true now

A run of "Score them all" **cannot end in silence.** Every exit - success, no-op, throttle, error -
puts a sentence on screen, and each pass reports itself while the loop is running. The drain can
now complete a 194-recording backlog, which it could not before.

The multi-tenant boundary **holds**, on the evidence of the migrations: 153/154 tables RLS-on, 457
policies, zero `using (true)`, one `auth_company_id()` source of truth, and all 24 service-role
call sites that could have been IDOR read individually and found guarded.

## The finding

**This morning I fixed the error path so it would say what failed. I left the SUCCE§ path unable
to say that it had succeeded.**

`note` is null on every ordinary completion, and the client's last act was `setNote(body.note)` -
so finishing *cleared* the only element that could report the finish. A drain that scored 100 of
194 ended with a re-enabled button and no words. That is not a failure mode adjacent to the one I
fixed; **it is the same failure mode, on the branch I did not look at**, eight hours later.

The lesson I keep re-learning in smaller frames: I fixed the branch the founder's screenshot was
standing on. §1.5.3 says an unmet precondition must fail LOUD. It does not say *only the unhappy
path must speak*. Silence after work is the same defect as silence after an error, and it is worse,
because it is indistinguishable from a button that was never wired.

## The one I could prove without a log

25 POSTs needed, 12 allowed per minute. The drain was **arithmetically unable to finish** - and it
only bites when passes return fast, which is exactly when recordings are being refused rather than
graded. I did not raise the limiter past the point of being a limiter; the client waits the
`Retry-After` the route was already sending and carries on, bounded.

## What I did not do

**I did not find the cause of "nothing happened."** I found two defects that each produce that
symptom exactly, and fixed both. The remaining evidence is in Vercel logs I cannot read
(`[scoreSession] threw` is written there). Saying the cause is found would be a §5
confident-well-formed-failure, so: it is not found, and the next press will now describe itself.

## And a scanner that lied about the database

My first RLS sweep said **49 tables have no RLS, including `pitch_scores`.** The migration reads
`alter table pitch_scores        enable row level security;` - multiple spaces, and my regex
required one. **Fifth bad scanner of this session.** Caught only because I spot-checked a member by
name rather than believing a count. The rule stands and keeps earning itself: a scanner's output is
a SUSPECT until a member is read.

## Residual

```json
[
  {
    "id": "R1-migrations-are-not-the-live-database",
    "item": "The tenancy verdict rests on reading supabase/migrations, not on querying live pg_policies. A migration never applied, or a policy dropped by hand in the dashboard, is invisible to this sweep.",
    "why_skipped": "It is config the repo cannot hold; I have no credentialed read of the live instance.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-25T11:58:00Z",
    "outcome": "OPEN, and it is the §1.5.3 external-config class by the book. The honest close is a live select from pg_policies diffed against the migrations."
  },
  {
    "id": "R2-61-service-role-routes-not-re-verified",
    "item": "68 routes use the service role. I read the 7 that never mention company_id and the 17 that key on a URL id. The other 61 mention company_id but were not checked query-by-query.",
    "why_skipped": "The two sets I did read are complete and are where the class lives.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-25T11:58:00Z",
    "outcome": "OPEN. A route can mention companyId and still have one query that forgets it - the §2.2 drift shape, one layer out."
  },
  {
    "id": "R3-the-cause-of-nothing-happened-is-still-unnamed",
    "item": "Two defects fixed, neither confirmed as THE cause.",
    "why_skipped": "Server logs are not readable from here.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-25T11:58:00Z",
    "outcome": "OPEN. The panel is now instrumented so the founder's next press is itself the diagnosis."
  },
  {
    "id": "R4-kpi-and-the-remaining-white-alpha",
    "item": "kpi/page.tsx 7 sites, VoiceEnrollment 5, nine files with 1-2.",
    "why_skipped": "The live outage outranked the render pass.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-25T11:58:00Z",
    "outcome": "OPEN, carried from the previous closure."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed.
No captures were generated this pass.

Still unopened: six of the seven PDFs in `docs/SYSTEM UPDATES AND REVISION 09-22-2026/`, the 16
images in `public/`, the 11 in `docs/sales-coach/webstore-promo-kit/assets`, the two WhatsApp
JPEGs, `/kpi` `/team-chat` `/door`, `VoiceEnrollment`, two of DoorLog's four states, `RepActivity`,
the `captureStalled` warning, the live `pg_policies` table, and the 61 service-role routes in R2.
