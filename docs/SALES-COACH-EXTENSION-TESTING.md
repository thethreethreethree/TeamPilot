# Sales Coach extension — test it yourself (founder runbook)

*2026-08-08. The 30-minute path from "it's built" to "I've seen it work." Pairs with
[`SALES-COACH-EXTENSION-STATUS.md`](SALES-COACH-EXTENSION-STATUS.md) (what's built + the decisions I need)
and [`../extension-sales/PLATFORM-COVERAGE.md`](../extension-sales/PLATFORM-COVERAGE.md) (every platform + its adapter).*

The server side is CI-green and deployed. The one thing I **cannot** verify without a browser is whether each
platform's on-page reader (the "adapter") grabs the real conversation text. This runbook is how you confirm that
— and how you hand a miss back to me so I can fix it in one line.

---

## 1. Load it (2 minutes)

You don't need the zip for testing — load the folder directly so a fix is just an edit + reload.

1. Open **`chrome://extensions`**.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked** → select the **`extension-sales/`** folder in the repo.
4. The **Sales Coach** icon appears in the toolbar. (It's still the C.A.R.E placeholder icon — that's decision
   #1 in the status doc, not a bug.)

> The downloadable `.zip` at `/extension/download-sales` is for real users. For your own testing, "Load
> unpacked" is faster because reloading after a selector fix is one click.

## 2. Sign in once (1 minute)

1. Open any supported site (Gmail is easiest), click the **Sales Coach** toolbar icon → the panel slides in.
2. Click **Sign in** → a tab opens on the connect page → it hands the extension your session → close the tab.
3. The toolbar badge shows a green **✓** when connected.

> **Expected warning:** until we set `NEXT_PUBLIC_SALES_EXTENSION_ID` in prod (decision #3), the connect page
> will note it's handing off to an **un-pinned** extension id. That's the dev fallback and is safe for *your*
> testing — it just means the "only the official extension" lock isn't armed yet. We arm it before public launch.

## 3. The per-platform confirm loop (30 seconds each)

For each platform, open a **real conversation**, click the toolbar icon, then click **Capture conversation**
(or just **Read the room**, which captures first). The panel shows a short **preview** of what it grabbed —
use it:

- **The preview shows the start of the real conversation, and Read the room reflects it** → the adapter works
  on that platform. ✅ Done — tell me "X confirmed" and I'll drop the UNVERIFIED label for X.
- **It's empty, or asks you to highlight the text manually** → the adapter's selector missed. That's a
  *safe* miss (it never fabricates — see "Why a miss is safe" below), but the selector needs tightening.
  See "When a platform misses" below.
- **The preview shows the WRONG text** (a sidebar, another thread, some page chrome — not the conversation) →
  the selector matched the wrong element. Also safe — just highlight the real messages and press Capture — but
  tell me, and hand me the selector (section 5 below) so I can point the adapter at the right element.

**Start here (Tier 1 — reused from the live C.A.R.E extension, most likely to just work):**
Gmail, Outlook, WhatsApp Web, Instagram DMs, Messenger/Facebook, LinkedIn, Slack.

**Then the reasoned ones (Tier 2 — most likely to need a tighten):**
Telegram Web, Microsoft Teams, Discord, Twitter/X DMs, Google Chat, Google Voice.

**Then the support desks (Tier 3 — reused C.A.R.E selectors; only if your reps sell through them):**
Zendesk, Intercom, Front, Gorgias.

Once **Read the room** works on a platform, the other four tools (Coach my reply, Catch me up, Draft my reply,
Say it for me) use the same reader — so confirming one confirms all five for that platform.

## 4. Why a miss is safe (not a bug to panic over)

There are two ways an unverified selector can miss, and both are safe:

1. **Empty miss** — the selector matches nothing. The adapter **returns nothing rather than guess**: it hands
   back an empty string and the panel falls back to *"highlight the conversation yourself."* It never invents
   text for the coach — that honesty rule is enforced by a test (`salesExtensionClientWiring.test.ts`, the
   never-fabricate guarantee).
2. **Wrong grab** — the selector matches the *wrong* element and returns some other text (a sidebar, another
   thread). This is why the panel shows a **preview** of what it captured, not just a character count: a wrong
   grab is visible to you, so you catch it and re-highlight instead of coaching on the wrong text. Without the
   preview a wrong grab would look identical to a right one — the preview is what makes this failure mode safe.

So neither miss produces a *silent* wrong reading: an empty miss degrades to manual selection, and a wrong grab
is shown to you before you act on it. Either way you can always highlight the real messages and press Capture.

## 5. When a platform misses — hand me the selector (2 minutes)

This is the one thing only you can do (I have no browser). It converts a reasoned selector into a confirmed one:

1. On the platform that missed, **right-click a message bubble** in the open conversation → **Inspect**.
2. In DevTools, look at the highlighted element and its parents for a **stable hook** — a `class`, a
   `data-*` attribute, or a `role`. Prefer something that reads "this is a message body" over a random hashed
   class (hashed classes like `css-1a2b3c` change on every deploy — avoid those).
3. Paste me: **the platform + that selector** (e.g. *"Discord — messages are `<div id="message-content-123">`,
   so `[id^='message-content-']`"*). If you're not sure which element, paste the DevTools HTML snippet of one
   message and I'll pick the selector.
4. I update `extension-sales/adapters.js`, you click **reload** on the extension card, and re-test. One loop.

---

## What "confirmed" gets us

Every platform you confirm moves from "reasoned, unverified" to "live." When you've run the Tier-1 seven, we
know the founder-named platforms (Gmail, Outlook, Instagram, WhatsApp, Messenger, Slack) work end-to-end — the
core of your brief. The Tier-2 six are upside; confirm them as you have reps on those channels.
