# 2026-07-25 Verification Runbook

Click-by-click checks for everything shipped this session. Do the **⚡ FIRST** block
before anything else — it confirms the AI-tools outage is actually resolved on your
deployment (which hinges on your Vercel env, not just the code). Est. 10–15 min total.

Prereq: the push has deployed (check Vercel → Deployments is green for the latest commit).

---

## ⚡ FIRST — is the AI actually working on the deploy? (2 min, gates everything else)

1. **Settings → LLM Connection → Run test.**
   - ✅ PASS: result shows **model = `deepseek-v4-flash`**, a latency, and a short reply.
   - ❌ If it shows a `model_unavailable` error → your Vercel **`DEEPSEEK_MODEL`** is set to a
     stale value (likely `deepseek-chat`). Remove it or set `deepseek-v4-flash`, redeploy, retest.
   - ⚠️ If the panel shows a **"single provider — no failover"** warning: that's expected if
     `ANTHROPIC_API_KEY` is unset. Optional — set it in Vercel to enable failover.
2. **Open any C.A.R.E conversation → composer → AI Co-Pilot.** Expect a drafted reply (not
   "Co-pilot couldn't draft"). Then **Summarize** and **Ask Coach** — each returns content.
   - If these fail with a visible error detail, copy the detail (it now names the real cause).

---

## Desktop C.A.R.E — tool reorg (2 min)

3. **Composer tool row order** reads: **Summarize · AI Co-Pilot · Ask Coach · Spawn Task**
   (Standard mode; Expert also shows Formulate). Co-Pilot is now before Ask Coach.
4. **Agent Tools** button (wrench, in the ticket header) → expands to **Dissect · Coach ·
   Decision Dialogue** → a **collapse control** returns it to the single "Agent Tools" button
   (it toggles both ways now, not one-way).
5. **Send & Resolve** (secondary button next to Send, hidden on internal notes): type a reply,
   click it → the reply sends, THEN the Resolve capture opens → fill it → you auto-advance to
   the next conversation. (Note: the resolve step is the capture form, not one-click — that's a
   deliberate learning-loop trade; see the Standard §3.4 decision.)

## Standard vs Expert mode (2 min)

6. Toggle **Experience Mode** (Standard ↔ Expert). In **Standard**: the queue defaults to "My
   Tickets" (other views behind "More views"), row tag-chips + bulk-select hidden, customer
   panel collapsed, Formulate/Priority/Close hidden. In **Expert**: everything is present
   (nothing should have regressed).

## Mobile radial `/care/mobile` (3 min, on a phone)

7. Open `/care/mobile`. Tap the glowing **center** → the ring "lights up" (tools become active).
8. **Swipe up/down on the center** → cycles conversations (the N/total counter changes).
9. **Open to read** → the thread loads (customer left, agent/AI right). **Reply** sends.
10. Ring: **Co-Pilot** fills the reply with a draft · **Ask Coach** (with a draft) returns a
    suggestion, "Use this" replaces the draft · **Summarize/Dissect** show a result sheet.
11. Wrench (top-left) → **Dissect** + **Spawn Task** (opens the conversation). **No Feedback
    button** should appear on this surface.

## ACMS knowledge upload → live AI (3 min)

12. Widget/Care settings → **AI Personality → Adaptive Knowledge** → upload a small `.md` with a
    fact (e.g. "We offer teeth whitening for $199."). 
13. As a customer in the widget, ask "Do you offer teeth whitening?" → the AI should answer using
    that fact. (Security note: the fence is hardened against a `.md` that tries to inject
    instructions — you don't need to test that, it's covered by tests + a live probe.)

---

## Founder env actions (do in Vercel — see FOUNDER-ACTION-QUEUE 2026-07-25 block)
- [ ] `DEEPSEEK_MODEL` not stale (verified in step 1)
- [ ] `ANTHROPIC_API_KEY` decision (failover vs single-provider)
- [ ] 🔒 `NEXT_PUBLIC_CARE_EXTENSION_ID` set to the Web Store id (token-handoff security pin)

## Open UX decisions (no verification — your call; `docs/CARE-Standard-Simplification.md` §8)
§3.2 one-line AI summary · §3.3 auto-pre-draft · §3.3 Save-draft · §3.4 resolve-capture-vs-one-click.
