# CLOSURE — Weekly manager digest

## What shipped
A weekly email digest for managers (founder pick over rep/both): every Monday, each company with points activity in
the last 7 days sends its managers a team rollup — total points, strong sessions, deals, and the top performers —
with a Scoreboard CTA. The companion to the live NotificationBell alerts. Built as a generic Postmark sender
(`sendTransactionalEmail`), a pure summary + pure email template, an orchestrator, and a CRON_SECRET-gated cron
registered in vercel.json.

## Checks (A38 — commands + evidence in check.md)
`npm run typecheck` exit 0; 12-of-12 digest + cron tests; `npm run invariant:audit` 0 violations (cron registered,
no NEXT_PUBLIC_ leak, env documented); the rendered email read by eye. The live Postmark send is confirmed on deploy
(no mail send in the sandbox) — the run fails LOUD (emailConfigured + warn) if Postmark is unconfigured.

## The un-named reliance
- Relies on Postmark being configured (POSTMARK_SERVER_TOKEN + CARE_EMAIL_HOST_DOMAIN + a From domain verified for
  the `notifications@<domain>` sender) and on CRON_SECRET being set (both already used by live crons/email). If
  Postmark is off, the run sends nothing but reports it — no silent failure.
- Relies on manager emails living in auth.users (resolved via getUserById) — profiles has no email column.
- Relies on the digest's numbers coming from the same ledger + sold-sessions the board reads, so they agree; there
  is no second aggregate authority to drift.

## Residual (A36)
```json
[
  {
    "id": "DIGEST-R1",
    "item": "The live email SEND is verified on deploy, not in the sandbox. If Postmark's From domain isn't verified for notifications@<domain>, sends will fail (logged as sendFailures) though the cron reports emailConfigured:true.",
    "why_skipped": "No mail send in the sandbox. Confirm on the first Monday run (or force the cron with the CRON_SECRET Bearer) that managers receive it; check the run's sendFailures count.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-04T04:00:00+08:00",
    "outcome": "OPEN — confirm delivery on prod; verify the From domain in Postmark if sends fail."
  },
  {
    "id": "DIGEST-R2",
    "item": "No opt-out preference — the digest goes to every manager of an active company by default.",
    "why_skipped": "Managers are few and a weekly team summary is inherently wanted; a per-user toggle is additive.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-04T04:00:00+08:00",
    "outcome": "OPEN — add a notification-preference toggle if a manager asks to unsubscribe."
  },
  {
    "id": "DIGEST-R3",
    "item": "Rep progress digest + a 'both' option were not built (the founder picked manager-only).",
    "why_skipped": "Scoped to the founder's choice; the sender + pattern make a rep digest a straightforward follow-up.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-04T04:00:00+08:00",
    "outcome": "OPEN — build the rep progress digest if the founder wants it."
  }
]
```
