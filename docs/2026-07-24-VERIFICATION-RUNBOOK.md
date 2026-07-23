# C.A.R.E — 2026-07-24 verification runbook

Every fix from this session is `tsc`-clean, unit-tested, and builds — but end-to-end behaviour is
**untested** (§5: your confirmation is the proof, not mine). This is the ordered checklist to verify
them. Do the **Prerequisites** first (some fixes stay dormant without them), then the checks. Each check
lists the **exact steps**, the **expected result**, and **what a failure means**.

---

## 0. Prerequisites (do these first — several fixes are dormant without them)

| # | Action | Enables | How |
|---|---|---|---|
| P1 | **Apply migrations `0188`–`0192`** | Live Monitor (0192), entitlement col (0189), gate (0190), budget (0191), handover (0188) | `npm run db:apply` — needs the **Session-pooler** connection string in `SUPABASE_DB_URL` (the sandbox can't reach the DB). Verify with `select name from public._agent_migrations where name like '019%';` |
| P2 | **Set Postmark outbound** | Email AI reply *delivery* (checks E1–E3) | `POSTMARK_SERVER_TOKEN` + `CARE_EMAIL_HOST_DOMAIN` in Vercel. Until set, the AI email reply is stored but not sent (logs a reason) — by design. |
| P3 | **Set `NEXT_PUBLIC_CARE_EXTENSION_ID`** | Connect-page token-pin (already built) | Vercel env = your published extension id. |
| P4 | **Reload the extension** | All extension fixes (built from `extension/`, `dist/` regenerates on build) | Rebuild the store package if needed, then reload unpacked from `extension/`. |

---

## 1. Extension (your active surface — where the reported bugs were)

**X1 — Role attribution (Spawn ✅ already confirmed; verify the other 5 to cover the whole class).**
Open a real support thread (Gmail/WhatsApp/etc.) where *you* are the agent. Run **Co-Pilot**, **Coach**,
**Formulate**, **Summarize**, and **Dissect** in turn — all 6 write/read-as-agent tools now carry the same
WHO-IS-WHO anchor, so if the fix holds it holds for every one.
- **Expect:** each treats **you** as the agent and the other party as the customer — no "Hi <your name>",
  no summary that swaps who-said-what, no Dissect that grades *your* line as the customer's. (Spawn you
  already confirmed: "more appropriate".)
- **Fails if:** any tool still calls you the customer → the agent-name lookup (`profiles.full_name`) returned
  empty; confirm your profile has a full name set.

**X2 — Long-thread context (the stale-context fix).**
Open a thread **longer than ~20,000 characters** (a long Zendesk/email ticket). Read it with the extension,
run **Co-Pilot**.
- **Expect:** the draft responds to the **most recent** messages.
- **Fails if:** the draft answers something from early in the thread → the `slice(-20000)` fix didn't load
  (check the extension reloaded, P4).

---

## 2. Email channel (three fixes — needs P1 + P2)

Send a real email **into** your C.A.R.E inbound address, as a customer.

**E1 — Context (multi-email thread).** Reply again on the same thread.
- **Expect:** the AI's second reply references the earlier exchange and does **not** re-introduce itself.
- **Fails if:** it says "Hi, I'm Jeff…" on every email → context (recentTurns) not loading.

**E2 — Delivery (needs P2).**
- **Expect:** the AI reply **arrives in the customer's inbox** (not just visible to agents in the dashboard).
- **Fails if:** no email arrives → check the Vercel logs for `email AI reply outbound dispatch NOT sent …`
  (names the missing config) and confirm P2.

**E3 — Handoff never leaves silence.** Email something that forces a handoff (e.g., a billing/account action).
- **Expect:** the customer receives either the AI's warm hand-off line **or** the "connecting you with a
  member of our support team" notice — **never nothing.**

**E4 — Automated-sender suppression (new; RFC 3834).** Reply to a C.A.R.E email from an address with an
out-of-office auto-responder on, or from a `no-reply@`/`mailer-daemon@` mailbox.
- **Expect:** the AI does **not** auto-reply (no LLM call, no email once Postmark is live); the message still
  lands in the agent inbox, and the thread shows an `ai_suppressed_automated` event with the reason.
- **Why:** an AI reply to an out-of-office responder can ping-pong machine-to-machine. The count-based loop
  breaker already caps that at ~5 hops; this stops it at hop 0. It's **conservative** — only well-established
  automated signals trip it (`Auto-Submitted`, **`X-Auto-Response-Suppress`** + an **"Automatic reply:"
  subject** — the common Outlook/Exchange OOO, which often omits `Auto-Submitted`; `Precedence: bulk/list`,
  `List-Id`/`List-Unsubscribe`, no-reply/daemon senders), so a normal human email is never silenced (the
  subject match is anchored at the start, so "Where is my out-of-office parcel?" is not flagged). **Veto:**
  say the word to disable it and rely on the loop breaker alone.

> ⚠️ **One posture decision (E2):** once Postmark is set, the AI **auto-emails** inbound-email customers.
> That's what an AI first-responder does and matches the widget (the loop breaker confirms it was the
> intended design). If you'd rather email be *draft-for-human-review*, say so and I'll gate it.

---

## 3. Cycle-1 C.A.R.E features (needs P1)

**C1 — Live Monitor (needs 0192).** Open your site (with the widget embedded) in one tab; open
`/dashboard/care/monitor` in another.
- **Expect:** an anonymous visitor row appears with the page you're on, updating every few seconds, showing
  how long they've been present ("on site 4m" — the "stuck on a page" signal); if you start a chat, an
  "Open chat" link appears.
- **Fails if:** always "No active visitors" → confirm 0192 applied and the widget's presence heartbeat isn't
  blocked; host-page label uses `document.referrer` (may show the host root on some sites — known limit).

**C2 — Decision Dialogue.** In a C.A.R.E conversation, click **Open as Decision Dialogue**.
- **Expect:** it lands on `/dashboard/decisions` with the Situation **pre-filled** from the customer's words
  and a "Seeded from a C.A.R.E conversation" banner. (Was a dead link/404.)

**C3 — Read-receipt.** Open the widget as a customer, then **close** it. From the agent side, send a reply.
- **Expect:** the collapsed bubble shows a **red unread dot**; it clears when you reopen.
- **Note:** this adds a gentle 30s background poll for visitors *with an active conversation* — reversible if
  you'd rather not.

**C4 — §A11 aggregator.** Open a customer who has **≥3** conversations.
- **Expect:** "What we've noticed" shows counts (N conversations, M resolved, top concerns). Below 3, the
  honest "need more conversations" message stays.

---

## 4. Build / infra

**B1 — Vercel build timeout.** On the next Production deploy, check the log.
- **Expect:** the `Sentry - Uploading source maps` phase drops from ~40 min to seconds (the
  `widenClientFileUpload:false` fix). If instead the time is in `Installing dependencies`, tell me — that's
  the Node-drift bundle (queue 5a2), a different fix.

---

## 5. Still requires a decision (not a verification)

- **`A1 + B1` — entitlement write-path** (THE launch blocker). A pricing call: which paid CRM tiers unlock the
  extension. Say the word (recommended map in `docs/feature-specs/ENTITLEMENT-WRITE-PATH-PLAN.md`) and I build
  it in a verified pass.
- Per-tenant AI-cost cap (numbers) · AI human/AI disclosure (legal) · `middleware`→`proxy` (queue 8f).

---

*Commits this session are listed in `docs/closures/2026-07-24-care-build-and-role-attribution-session.md`.
The cycle-1 completion status is `docs/CARE-COMPLETION-2026-07-24.pdf`.*
