# Founder action items — 2026-07-06 session

> One place for everything this session needs from you. Nothing here is blocking a
> green build — `npm run check` passes and every commit is shipped to `main`.
> These are the things only you can do (apply migrations, test live, decide).

## 1. Apply three migrations (all additive, idempotent, safe)

| Migration | What it does | Risk |
|---|---|---|
| `0085` | `care_widget_load_events` append-only at the DB level (§3.1) | none — adds `do instead nothing` rules to an insert-only table |
| `0086` | `crm_activity_events` append-only at the DB level (§3.1) | none — same, write path verified insert-only |
| `0087` | `last_message_author_type` on `support_conversations` (powers the inbox-wide chime) | none — nullable column + one-line trigger add + one-time backfill |

The inbox-wide sound chime only becomes active after `0087`; before it, the
open-conversation chime still works (no regression).

## 2. Live tests (the one thing code can't verify)

- **Sales Coach** — run [the checklist](sales-coach-live-test-checklist.md) on a
  real call: in-person Agent/Prospect labels, pitch-anchor nudge, video mic-only
  behavior, `filler_spike` (does Scribe keep the "um"s?). Grab the
  `[live-coaching]` console log for anything off.
- **C.A.R.E sound chime** — in an agent session, enable the sound toggle (the
  Volume icon in the Conversations header); confirm you hear the two-note chime
  when a customer message arrives (test in Chrome AND Safari — the audio unlock
  differs). It should NOT chime on your own sends or the AI's replies.

## 3. Decisions that unblock gated backlog (only if you want them built)

- **Push delivery** — set the server VAPID env vars (not just `.env.local` —
  Vercel env), trigger a push, and paste the `sender.ts` log line so I can finish
  the diagnosis.
- **Durability cron** — set `CRON_SECRET` in Vercel (needs Pro) to activate the
  §3.5 durability sweep + dissect-backfill crons.
- **Email digest** — decide what/when to digest (frequency, recipients, content)
  and I'll build it.
- **Live billing** — a business decision; the CRM schema is ready when you are.
- **SSE real-time** — replaces the 5s poll; big + low-urgency. Say the word.
- **Inbound-email AI-reply rate limit** (🟡 cost/DoS flag from the audit) — the
  one unrate-limited LLM endpoint. Mitigated (webhook-secret auth + retry dedup),
  so not urgent, but a spam flood to a tenant's inbound address = unbounded LLM
  cost. Decide a per-tenant auto-reply cap (e.g., N/hour) and I'll build it:
  ingest+store every email, skip only the AI auto-reply past the cap (agent
  handles it). Needs a tenant-keyed limiter (the current one is IP-keyed, wrong
  for a webhook).

## What shipped (for context)

Video A/B (mic-only v1) · manager coaching access (`0084`, applied) · pitch-anchor
nudge · confidence-ripple fix · full theme sweep · sound chime (open + inbox-wide)
· RLS audit (parser-bug fixed) · §3.1-enforcement hardening · a full security +
performance + a11y + resilience audit ([record](AUDIT-2026-07-06-session-verification.md))
with one real fix (a fail-open company check → fail-closed) · +123 tests. 47
commits, gate green throughout.
