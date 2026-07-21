# C.A.R.E AI→agent handover capture — build closure + verification runbook

**Date:** 2026-07-21
**Branch:** `feat/care-handover-capture` (commit `b8791b0c`)
**Status:** BUILT + statically verified (tsc / eslint / next build / 866 vitest green). **Runtime-untested
end-to-end.** Migration `0188` UNAPPLIED. Invisible until deployed (the standing deploy bottleneck).

---

## What the founder asked for

> "When our AI customer assistance system <Jeff> hands over the conversation to the agent, two things need to
> happen. #1 the customer needs to be aware that the conversation will be handed over to a Customer Support Agent.
> #2 the system needs to ask the customer for their email … visible in our system." — then expanded: "along with
> the email, also the customer's full name, and the specific concern they have … a simple dropdown list of possible
> topics … and prepare the system for E-Commerce based companies (order number, return order, cancel order, order
> tracking …)." Plus, mid-build: **"add <Other> as an option … will allow the customer to input their specific
> concern."**

## Locked design decisions (founder, via AskUserQuestion)

| Decision | Choice |
|---|---|
| Capture UX | Compact handoff **card** (not Jeff asking in chat) |
| Notice scope | Fires on **AI escalation AND agent claim** |
| Sentinel token | **Yes** — build the coupled detector |
| Email required | **Optional** (never block the customer) |
| E-commerce config | A per-company **"business type"** setting |
| "Other" topic | Free-text box for the customer's own words |

## Files

**New**
- `src/lib/care/handoverTopics.ts` — topic sets (general vs e-commerce) + "Other" + validators (shared by widget
  render AND server validation, one source).
- `src/lib/care/handoverNotice.ts` — the single customer-facing notice string.
- `src/components/care/HandoffCard.tsx` — the card, shared by both widgets.
- `src/app/api/care/conversations/[id]/handoff/route.ts` — capture endpoint (session-token authed).
- `supabase/migrations/0188_care_handover_capture.sql` — additive columns.
- Tests: `src/lib/care/__tests__/handoverTopics.test.ts`, sentinel cases added to `prompt.test.ts`.

**Changed**
- `src/lib/care/prompt.ts` — `HANDOFF_SENTINEL` + `stripHandoffSentinel` + sentinel-first `detectHandoffSignal`;
  the escalation instruction now tells Jeff to append the sentinel.
- `src/lib/care/config.ts` — `businessType` on `CareTenantConfig` (+ graceful default).
- `src/lib/data/care.ts` — `postSystemMessage`, `captureHandoffDetails`; `claimConversation` posts the notice on
  a real AI→human handoff; 3 handoff fields on `SupportConversation` + mapper.
- `src/app/api/care/conversations/[id]/messages/route.ts` — strip sentinel, post notice on handoff, return
  `handoff` / `handoffCaptureNeeded` / `businessType`.
- `src/app/api/care/widget/bootstrap/route.ts` — returns `businessType` to the embedded widget.
- `src/components/care/CareChatWidget.tsx` + `CareEmbeddedWidget.tsx` — card wiring.
- `src/components/care/ConversationsApp.tsx` — `HandoffCaptureLine` in the agent `DetailHeader`.
- `src/app/api/care/agent/tenant/route.ts` + `src/app/dashboard/care/settings/widget/page.tsx` — business-type
  setting (save route + UI toggle).

## Adjacent-surface checks (§1.5.1 / §1.5.2)

- **Email channel:** outbound email dispatch is called *explicitly* by the agent-message POST route only — it is
  NOT a DB trigger on message inserts. `postSystemMessage` inserts `author_type='system'` directly, so the notice
  is **never emailed** to email-channel customers. Email conversations have no widget, so the card never shows.
  No breakage; correctly no spam.
- **Voice mode:** the card renders above the voice surface if a handoff happens mid-call — usable, not broken.
- **Migration coupling:** every read is `select("*")`; the one write of the new columns guards with
  `isMissingColumnError` and falls back to still-link the customer. Code and schema can land in either order.

---

## FOUNDER VERIFICATION RUNBOOK (do after applying 0188 + deploying)

**Prereq A — apply the migration:** `npm run db:apply` (dry-runs then applies 0188). Confirm with `npm run db:check`.
**Prereq B — deploy** the branch (or merge to main and deploy). Nothing below is visible on the stale build.

### 1. Set a company to e-commerce (optional, to see the order field)
- Dashboard → C.A.R.E → Settings → Widget → **Business type** → "E-commerce" → Save.

### 2. Trigger a handoff on the widget
- Open the customer widget (bottom-right bubble) on any page.
- Ask Jeff something he must escalate — e.g. *"I need a refund on my account, can a human help?"* or just
  *"can I talk to a person?"*.
- **Expect:** Jeff's reply ends with a warm "bringing in a teammate" line (NOT the raw `[[HANDOFF]]` token — if you
  ever see that token, the strip failed), immediately followed by a centered system line: *"You're being connected
  with a member of our support team…"*, and **the capture card appears** above the composer.

### 3. Fill (or skip) the card
- Card shows: **Name · Email · "What's this about?" dropdown · (order # if e-commerce order topic) · Connect me / Skip.**
- Pick **"Other"** → a free-text box appears.
- Pick an order topic (e-commerce) → the **Order number** field appears.
- Submit → card disappears. (Skip → card hides; every field is optional.)

### 4. See it as the agent
- Dashboard → C.A.R.E inbox → open that conversation.
- **Expect** in the header (under the status/priority row): a **Concern** chip (with the "Other" text if used), an
  **Order #** chip, the customer **name**, and the **email** as a clickable mailto.

### 5. Agent-claim notice path
- Start a fresh widget conversation, DON'T let Jeff escalate.
- As an agent, **Claim** it from the inbox.
- **Expect:** the customer's widget shows the same "connecting you with a member of our support team" system line
  (the notice fires on claim too), and the card appears next time they load/message.

### If something's off
- Token `[[HANDOFF]]` visible to the customer → `stripHandoffSentinel` not running on that path.
- Card never appears → check the `/messages` response has `handoff:true` (DevTools Network) and `businessType`.
- Card appears but submit 400s → topic value not in the tenant's business-type set (drift); check the dropdown.
- Nothing at all → confirm 0188 applied (`db:check`) and the deploy actually shipped this branch.

## Bonus fixes found during the audit (separate from the feature)

Two pre-existing bugs surfaced by proactive audit (§1.5.2 / §1.5.1) while building on these
surfaces:

**1. Priority-change false-positive (`c1e782b3`).** The PATCH `/api/care/agent/conversations/[id]`
read-back returned the BASE conversation shape (no `priority`), but the client's §1.6
divergence check reads `fresh.priority`. So every **priority change** false-positived —
`undefined !== "high"` → toast *"Priority change didn't stick — DB still reads 'undefined'"*
+ a forced reload — even though the change landed. Fixed by returning the enriched shape.
**Verify:** change a conversation's priority from the header dropdown → updates quietly, NO
"didn't stick" toast.

**2. Direct widget went silent post-handoff (`e044bf4e`).** The embedded widget polls
`/messages` every 4s so an agent's reply appears in the customer's open chat without a
refresh; the DIRECT widget (ELOSTATE marketing + dashboard) had no poll. After a handoff a
prospect could send messages and never see the agent's reply until reopening the chat — the
"no smooth customer interaction" gap, sharpened by the card promising "Connect me". Fixed by
mirroring the embedded widget's 4s poll (paused when hidden / mid-send). **Verify:** with a
customer's direct-widget chat open post-handoff, reply as the agent from the inbox → the
reply appears in the customer widget within ~4s, no refresh.

## Open / follow-ups
- **Runtime verification** is the founder's — the above has not been exercised against a live handoff.
- Possible v2: re-surface the card on a post-handoff customer message (today it shows on the handoff turn +
  on reload while uncaptured; `handleSend` reads `handoff`, not `handoffCaptureNeeded`).
- Possible v2: capture concern for email-channel conversations (no widget today).
