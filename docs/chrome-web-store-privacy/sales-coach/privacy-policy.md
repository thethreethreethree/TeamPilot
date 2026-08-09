# Sales Coach — Privacy Policy

_The hosted, publicly reachable version is live at **`https://elostate.com/extension/privacy-sales`** — paste
that URL into: Developer Dashboard → Store listing → "Privacy policy". This markdown is the source of truth;
keep the hosted page consistent with it (a drift-guard test enforces the third-party-AI disclosure)._

**Last updated:** 2026-08-09

## What this extension does
Sales Coach is a browser panel for signed-in subscribers that coaches the sales conversation shown on the page
you're viewing. It reads the on-page conversation when you invoke it, and returns coaching (where the deal
stands, a suggested reply). It has no feature that saves your conversations.

## What data we handle

**Account authentication.** Your account session token and refresh token, stored on your device in the browser's
extension storage (`chrome.storage.local`), so you stay signed in. It leaves your browser only as the
authorization header on requests to our backend.

**Conversation content (the text you point a tool at).** When you run a tool, the conversation text you selected
or the panel read from the page is sent to our backend to generate the result.

## How it's collected
Only when you act: the panel reads the active page's conversation when you click the toolbar icon and run a tool
(or when you highlight text and run a tool). We do not read pages in the background, and we do not read anything
you have not selected and submitted to a tool.

## How it's used, and who it's shared with
The conversation text is sent to our backend (`elostate.com`, authenticated by your session token) and from
there **transmitted to our third-party AI provider (currently DeepSeek) — a sub-processor — solely to generate
the coaching result. The provider does not retain the text.** It is used for no other purpose. We do **not** sell
your data, use it for advertising, use it for creditworthiness decisions, transfer it to data brokers, or use it
to train our own models.

## How it's stored and secured
The session/refresh token lives only in on-device extension storage. Conversation text is **processed to produce
the result and then discarded** — the Sales Coach extension has no save path; nothing you run through a tool is
persisted by us. Traffic is over HTTPS.

## Retention
Conversation text: not retained — neither by us (processed and discarded per request) nor by our AI provider.
Auth tokens: retained on your device until you sign out or remove the extension.

## Your choices — access, correction, deletion
Because conversation text is not stored, there is nothing to access, correct, or delete for it. To remove the
locally stored auth tokens, sign out in the panel or uninstall the extension. For questions about your account
data, contact us below.

## Limited Use compliance
Our use of data received from the extension complies with the Chrome Web Store **Limited Use** policy: it is
used only to provide and improve the single stated purpose (coaching the conversation you're viewing), and is
not sold, not used for unrelated purposes, not used for personalized advertising or creditworthiness, and not
transferred to data brokers.

## Contact
privacy@elostate.com
