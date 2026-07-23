# Verify: Co-Pilot reply-vs-follow-up mode (founder browser test)

The build is code-verified end-to-end (logic, data path, full suite, CI gates). The **only** unverified
piece is the live-DOM behavior on the extension. This is the 2-minute test + the exact thing to capture if
it's wrong, so a failure is fixable in one pass (instrument-first: get the real DOM, fix the named cause).

## The core behavior
When the **last message in the thread is the customer's** → the Co-Pilot drafts a **reply**.
When the **last message is your own** (you spoke last, customer hasn't answered) → it drafts a **follow-up**
(a nudge/check-in), NOT a reply to your own words.

## Test 1 — In-app Co-Pilot (dashboard) — DETERMINISTIC, most reliable
1. Open a C.A.R.E conversation where **your** (agent) message is the last one.
2. Click **AI Co-Pilot**.
3. ✅ PASS: the draft is a follow-up ("just following up…", "wanted to check in…", adds info) — it does NOT
   open by answering a customer message that isn't there.
4. Then open a conversation where the **customer** spoke last → Co-Pilot should draft a normal **reply**.

*(In-app uses `authorType` from the DB, so this path is deterministic — if this one is wrong, the issue is the
prompt/LLM, not DOM reading.)*

## Test 2 — Extension Co-Pilot on WhatsApp — the UNVERIFIED path
1. Open a WhatsApp Web chat where **your** last message is the most recent bubble.
2. Click the C.A.R.E icon → **AI Co-pilot**.
3. ✅ PASS: a follow-up. ❌ FAIL: it drafts a reply to your own message.

### If Test 2 FAILS — capture this (one paste fixes it precisely)
The deterministic signal reads the last message bubble's role class. If it's wrong, I need the real DOM:
1. On the WhatsApp tab, open DevTools (F12) → Console.
2. Paste and run:
   ```js
   const n = document.querySelectorAll("[data-pre-plain-text]");
   const last = n[n.length - 1];
   console.log("bubble:", last?.closest(".message-out, .message-in")?.outerHTML?.slice(0, 300));
   console.log("classes up the tree:", (()=>{let e=last,c=[];while(e&&c.length<6){c.push(e.className);e=e.parentElement}return c})());
   ```
3. Paste both console lines back to me. That tells me the actual class/structure WhatsApp now uses for
   agent-vs-customer, and I fix `adapters.js` `lastSpeaker()` to match — exactly, not by guessing.

*(Gmail and other channels have no reliable agent-vs-customer DOM marker, so they use the LLM path — the mode
instruction + sender labels + agent-name anchor. If those mis-fire, it's a prompt fix, and Test 1 is the clean
signal for whether the prompt logic itself is sound.)*

## Why WhatsApp might fail (honest)
The `lastSpeaker()` DOM read is UNVERIFIED — I can't run a browser. It reuses the live-confirmed
`[data-pre-plain-text]` anchor + the `.message-out`/`.message-in` role class (the same ones the text-scrape
uses), but the *last-bubble* read specifically is unconfirmed. Worst case it returns "unknown" and falls back
to the LLM path — so it never breaks the panel, it just may not be deterministic until the selector is confirmed.
