# Founder action items — 2026-07-06 session

> One place for everything this session needs from you. Nothing here is blocking a
> green build — `npm run check` passes and every commit is shipped to `main`.
> These are the things only you can do (apply migrations, test live, decide).

## ⭐ Start here (triage — everything else is detail below)

If you only do a few things, do these, in order:

1. **Run one live Sales Coach call and send me the Stop readout line.** It now
   reads `… median … · where: settle X · llm Y · tts Z` — the `where:` names which
   stage to attack, so your one call unblocks the whole deferred timing build.
   (see "Live tests" below)
2. **Decide: enable the email AI to actually email customers?** 🔴 Right now the
   AI writes replies that are never sent (they sit in the inbox). Wiring it is
   ready but makes the AI autonomously email real customers — your call, not mine
   to flip. (see "Decisions" below → "Email AI first-responder never sends")
3. **Apply migrations `0085` / `0086` / `0087`** — additive, idempotent, safe.
   (see "Apply three migrations" below)
4. **Push delivery:** set the VAPID vars on Vercel, trigger a push to an
   *already-assigned* conversation, paste the `[push-sender]` log line. The code
   path is now verified sound end-to-end, so the log will name the config cause.
   (see "Decisions" below → "Push delivery")

Everything below is the full detail + the smaller flags.

## 1. Apply three migrations (all additive, idempotent, safe)

| Migration | What it does | Risk |
|---|---|---|
| `0085` | `care_widget_load_events` append-only at the DB level (§3.1) | none — adds `do instead nothing` rules to an insert-only table |
| `0086` | `crm_activity_events` append-only at the DB level (§3.1) | none — same, write path verified insert-only |
| `0087` | `last_message_author_type` on `support_conversations` (powers the inbox-wide chime) | none — nullable column + one-line trigger add + one-time backfill |

The inbox-wide sound chime only becomes active after `0087`; before it, the
open-conversation chime still works (no regression).

## 2. Live tests (the one thing code can't verify)

- **⭐ Sales Coach FLUIDITY readout (top priority — unblocks the deferred timing work).**
  The fluidity build (timing + delivery) is shipped but the *timing* half is
  intentionally readout-first: run one real call, then read the **"Last call: …
  median Xms, p90 Yms end-to-end · where: settle Xms · llm Yms · tts Zms"** line the
  panel shows on Stop (also `[cue-summary]` in the console). **The `where:` breakdown
  is the actionable part** — it now aggregates the per-stage medians so the readout
  DIRECTLY names the dominant cost (settle/queue vs the LLM round-trip vs TTS)
  instead of making you eyeball individual `[cue-metric]` lines. Send me that line +
  a few `[cue-metric]` lines. Whichever stage dominates is the biggest win, and I
  build it. Also: you should notice **fewer, sharper
  cues** (low-value ones are now suppressed). See §5 of
  [the checklist](sales-coach-live-test-checklist.md).
- **Sales Coach (rest)** — same call: in-person Agent/Prospect labels, pitch-anchor
  nudge, video mic-only behavior, `filler_spike` (does Scribe keep the "um"s?).
- **C.A.R.E sound chime** — in an agent session, enable the sound toggle (the
  Volume icon in the Conversations header); confirm you hear the two-note chime
  when a customer message arrives (test in Chrome AND Safari — the audio unlock
  differs). It should NOT chime on your own sends or the AI's replies.
- **(Optional) §3.1 chain + §3.2 gate integration test** — the hermetic
  `npm run check` suite can't touch a real DB, so the events→signals chain
  (triggers + `derive_signals_for_event`) AND the §3.2 understanding gate (the
  `check_understanding_gate` trigger that blocks surfacing a problem without
  enough signals) are proven end-to-end only by an opt-in test that needs *your*
  live-DB env. The §3.2 gate coverage is NEW this session (it previously had zero
  reproducible test — a migration could have silently opened the core guarantee). To run it against a project you don't mind writing a
  throwaway company into: `EXECOS_INTEGRATION_TEST=1 SUPABASE_URL=… SERVICE_KEY=…
  npm run check`. It's a 🔴 alarm if it ever fails (the §3.1 chain is broken in
  prod). Purely optional — the trigger logic is stable and unit-covered; this is
  the belt-and-suspenders check only you can run.

## 3. Decisions that unblock gated backlog (only if you want them built)

- **Push delivery** — set the server VAPID env vars (not just `.env.local` —
  Vercel env), trigger a push, and paste the `sender.ts` log line so I can finish
  the diagnosis. *Code path now VERIFIED SOUND end-to-end this session (§A15 — a
  flag honestly diagnosed can close without a code fix):* I read all three legs —
  `sender.ts` (fans out to every enabled sub, handles 403/410, logs statusCode on
  every failure), the root `public/sw.js` (has the push handler + `showNotification`,
  controls the whole app), and `useNotificationSubscription.ts` (subscribes via the
  ROOT sw.js — NOT the narrow `/dashboard/chats/` SW — and migrates any stale
  narrow-scope subscription, the 2026-06-27 F1 consolidation). I also removed a
  confound: the fresh-email notify race (fixed this session — see the Care section)
  meant a fresh-email test would show no push AND no log. **So the remaining cause
  is almost certainly VAPID config, and the `[push-sender]` log line names which:**
  `SKIPPED … VAPID not configured` = env vars missing on Vercel; `send FAILED …
  statusCode=403` = key MISMATCH (the `NEXT_PUBLIC_VAPID_PUBLIC_KEY` used to
  subscribe isn't the pair of the `VAPID_PRIVATE_KEY` used to send — re-generate as
  a matched pair and re-subscribe); `statusCode=401` = bad `VAPID_SUBJECT`;
  `sent=N failed=0` = the push WAS delivered, so check the OS/browser notification
  permission + Focus/Do-Not-Disturb. Test via a message to an ALREADY-ASSIGNED
  conversation (not a fresh email) to keep the variable clean.
- **🟡 Team-chat push skips explicit-but-silent participants (your call).** Found
  by a read-audit: `notify-message/route.ts` derives push recipients ONLY from the
  recent message *authors* of a topic (last 50 messages), but its own comment says
  the intent is "sent a message OR **joined explicitly**." The `chat_participants`
  table + `addParticipantsToTopic` exist, but the notify path never reads them. So
  **a teammate you ADD to a topic gets no push for new messages until they first
  post** — they have to open the topic to discover activity. Not data loss (🟡),
  but a real "I added them and they heard nothing" gap. *Also a 3rd push-diagnosis
  confound:* if you tested push as an added-but-silent participant, no push is even
  attempted — looks like non-delivery. **Recommend:** union the recent-authors set
  with `chat_participants` for the topic (still excluding the sender), which
  implements the "joined explicitly" half the comment already promises. It changes
  who gets notified (a volume/behavior change for real users), so it's your call,
  not mine to flip. ~5-line fix + I'd add a test. Say the word.
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
- **Transcript unique constraint** (🟡 §3.1-sensitive — your call) — a read-audit
  found `coaching_transcript_segments` has no `UNIQUE(session_id, seq)`, so a
  double-finalize would duplicate the transcript. I shipped a client guard
  (finalize fires once/session, `7ad1a37`) which covers the realistic case. The
  robust fix is a `UNIQUE(session_id, seq)` migration + upsert — but it needs
  de-duping any existing dupes first, and DELETING from the append-only transcript
  is §3.1-sensitive, so I won't do it without your OK. Say the word and I'll write
  the migration (with a careful keep-earliest dedup step). *Related:* the S1a
  `label-transcript` route (upload→diarize→label) also appends transcript with no
  guard, so a session that's BOTH live-finalized AND has a recording uploaded gets
  the live + diarized transcripts MIXED (interleaved by seq). Uncommon combined
  flow, not a live-test blocker — but it needs a design call: should the diarized
  upload REPLACE the live transcript, or be blocked when one exists? Your decision
  (it touches the append-only transcript). I'll implement whichever you choose.
- **⚙️ UPDATE (sequencing fix SHIPPED):** the three coupled races below (AI
  overtake, widget first-turn, and the agent-notify miss) shared one root cause —
  the inbound route fired `routeNewConversation` fire-and-forget, so the notify +
  AI responder read pre-routing state. Fixed by awaiting routing before both
  (non-outward-facing: it only makes the agent push + AI-silence honest; it sends
  NO customer email). So NOW: a fresh inbound email correctly pushes its assigned
  agent, and the AI correctly stays silent when an agent was assigned. **Still
  gated (your call):** enabling the AI to actually EMAIL the customer (the outbound
  dispatch) — that's the outward-facing part, untouched. Details below.
- **Email AI first-responder never sends (🔴 layer-2 gap — your call to enable).**
  A read-audit through the AMD-006 layer-2 lens found the inbound-email AI
  responder (`runAiFirstResponder` in `api/care/inbound/email/route.ts`) *generates*
  a reply and *inserts* it as an `ai` message (line 548) but **never dispatches it
  as outbound email** — it doesn't call `dispatchOutboundEmailReply`. That function
  exists and works, but its ONLY caller is the human-agent reply route
  (`agent/conversations/[id]/messages/route.ts:144`). So today: a customer emails
  in, the AI writes a reply, it lands in your agent inbox — **but the customer
  never receives it** until a human agent replies. The feature returns 200 and
  writes the row (looks complete) yet fails end-to-end (§1.5.1 — technically
  complete but incomplete). Evidence it's a *missing wire*, not a deferral: the
  route builds an elaborate loop-breaker against email ping-pong with "the
  sender's own auto-responder" (lines 428–436) — a loop that can't happen unless
  the AI reply is actually emailed out — and creates threads with
  `ai_responding:true`. The outbound leg was intended for the AI path.
  **Why I flagged instead of fixed:** wiring it makes the AI **autonomously email
  real customers** (outward-facing, unrecallable) the moment `POSTMARK_SERVER_TOKEN`
  + `CARE_EMAIL_HOST_DOMAIN` are set — I won't turn that on without your explicit
  yes. **Recommendation:** enable it (it's the designed "AI first responder"
  behavior, parity with the widget per §A16), but review the AI reply quality on a
  test tenant first.
  **Fix is NOT ~3 lines (corrected after tracing the ripple — §1.5/§A21).** Two
  coupled facts I found on the second pass:
  (a) *The gap bites in the worst case.* `routeNewConversation` sets
  `ai_responding:false` when it auto-assigns an agent (`care.ts:2420`), and
  `runAiFirstResponder` only replies while `ai_responding` is true — so the AI
  responds ONLY when no agent was assigned. Meaning the never-sent reply fails
  exactly when no human is available to cover for it. Worse, not milder.
  (b) *Naive wiring introduces a §3.3 overtake.* The route fires BOTH
  `void routeNewConversation` (line 266) and `void runAiFirstResponder` (line 350)
  concurrently, neither awaited. The AI responder reads `ai_responding` after ~1
  round-trip; routing flips it false after ~3 — so the AI read wins the race and
  proceeds even when an agent is being assigned. Today that's harmless (the reply
  isn't sent). The moment we wire the dispatch, a fresh email during business hours
  = the AI emails the customer OVER the just-assigned human. So the real fix =
  `await routeNewConversation` BEFORE the AI responder (or re-read `ai_responding`
  immediately before dispatch) + dispatch the AI message + a test asserting (1) AI
  dispatches when unrouted, (2) AI stays silent + does NOT dispatch when an agent
  was assigned. Say the word and I'll build that (the correct version, not the
  overtake-introducing shortcut).
  *Same-class check (done, not assumed):* the widget customer-messages route
  (`conversations/[id]/messages/route.ts:192`) has the same check-then-act on
  `ai_responding`, loaded at handler-start. On a NEW widget conversation the
  create route fires `void routeNewConversation` and returns the id before routing
  finishes; the client's first-message POST can then read `ai_responding=true`
  (pre-flip) and the AI first-responds even though an agent was auto-assigned. But
  it's **milder and possibly acceptable-by-design**: first-turn-only (the
  assignment persists, so turn 2+ stays silent — self-correcting), the reply IS
  delivered, and an AI first-touch while a human picks up may be the behavior you
  want. Logged for completeness at 🟡 — tell me if you want the widget create→first
  -message flow to await routing before the AI first-responds, or to leave the AI
  first-touch as-is. No action taken; your call on whether it's a defect or a feature.
  *Third coupled race (same root cause, same fix — found while checking the class):*
  the inbound route also fires `void notifyAssignedAgentOfCustomerMessage` (line 331),
  which reads `assigned_agent_id` — racing the same in-flight `routeNewConversation`.
  On a FRESH email thread the notify reads null (routing hasn't assigned yet) and
  early-returns WITHOUT sending a push AND without an error log (a null agent is a
  clean return, not a failure). `routeNewConversation` doesn't notify on assignment
  itself, so this is the only push — meaning **the agent auto-assigned to a brand-new
  customer email gets no push about it** (they still see it in the inbox poll, so 🟡
  degraded-notification, not lost message). **This bears on the OPEN push-delivery
  diagnosis (§3 above / queue #2):** if you ever tested push via a fresh inbound
  email, this race = no push attempted = no delivery AND no error log, which mimics
  "subscribes but doesn't deliver." To isolate the real sender/VAPID issue from this
  race, test push via a NEW message to an ALREADY-ASSIGNED conversation (existing
  thread), where `assigned_agent_id` is stable and the notify fires correctly
  (§3.5 single-variable). **All three races share ONE fix:** `await
  routeNewConversation` before firing the notify AND the AI responder. I can ship
  that sequencing fix on its own (it's not outward-facing — it only makes the agent
  notification + AI-silence honest) even before you decide on enabling AI email send.
  Say the word and I'll do the sequencing fix + a test.
- **HSTS header** (🟡 minor hardening) — the one absent security header. Confirm
  your domain + all subdomains are HTTPS-only, then add to `SECURITY_HEADERS` in
  `next.config.ts`: `{ key: "Strict-Transport-Security", value: "max-age=63072000;
  includeSubDomains" }` (skip `preload` — hard to reverse). Say the word and I'll
  add it. (CSP is already deferred-in-code with a documented reason.)

## What shipped (for context)

Video A/B (mic-only v1) · manager coaching access (`0084`, applied) · pitch-anchor
nudge · confidence-ripple fix · full theme sweep · sound chime (open + inbox-wide)
· RLS audit (parser-bug fixed) · §3.1-enforcement hardening · a full security +
performance + a11y + resilience audit ([record](AUDIT-2026-07-06-session-verification.md))
with one real fix (a fail-open company check → fail-closed) · +123 tests. 47
commits, gate green throughout.
