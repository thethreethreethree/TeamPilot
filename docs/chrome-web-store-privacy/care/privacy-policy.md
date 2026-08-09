# C.A.R.E — Privacy Policy

_The hosted, publicly reachable version is live at **`https://elostate.com/extension/privacy`** — paste that URL
into: Developer Dashboard → Store listing → "Privacy policy". This markdown is the source of truth; keep the
hosted page consistent with it (a drift-guard test enforces the third-party-AI disclosure)._

**Last updated:** 2026-08-09

## What this extension does
C.A.R.E is a browser panel for signed-in subscribers that assists the customer conversation shown on the page
you're viewing. It reads the on-page conversation when you invoke it, and returns a summary, a diagnosis of the
underlying problem, or a drafted reply. It can also, only when you choose, capture the conversation into your own
C.A.R.E workspace.

## What data we handle

**Account authentication.** Your account session token and refresh token, stored on your device in the browser's
extension storage (`chrome.storage.local`), so you stay signed in. It leaves your browser only as the
authorization header on requests to our backend.

**Conversation content (the text you point a tool at).** When you run a tool, the conversation text you selected
or the panel read from the page is sent to our backend to generate the result.

**Captured conversations (only when you click Capture).** The messages and any attached images of a conversation
you explicitly choose to save.

## How it's collected
Only when you act: the panel reads the active page's conversation when you click the toolbar icon and run a tool
(or highlight text and run a tool), and captures media only when you click Capture. We do not read pages in the
background, and we do not read anything you have not selected and submitted.

## How it's used, and who it's shared with
Conversation text is sent to our backend (`elostate.com`, authenticated by your session token) and from there
**transmitted to our third-party AI provider (currently DeepSeek) — a sub-processor — solely to generate the
result. The provider does not retain the text.** Captured conversations are saved to **your own C.A.R.E
workspace**, visible only to your team; captured
image bytes are uploaded directly to a signed storage URL on your workspace's storage provider (Supabase). We do
**not** sell your data, use it for advertising, use it for creditworthiness decisions, transfer it to data
brokers, or use it to train our own models.

## How it's stored and secured
The session/refresh token lives only in on-device extension storage. Tool conversation text is **processed to
produce the result and then discarded** — it is not persisted by us unless you use Capture. Captured content is
stored privately in your workspace. Traffic is over HTTPS; media uploads use per-file signed URLs pinned to the
storage host.

## Retention
Tool conversation text: not retained — neither by us (processed and discarded per request) nor by our AI
provider. Captured conversations: kept in your workspace per your workspace's retention policy. Auth tokens:
retained on your device until you sign out or remove the extension.

## Your choices — access, correction, deletion
Tool conversation text isn't stored, so there is nothing to access or delete for it. Captured conversations live
in your C.A.R.E workspace and can be viewed, edited, or deleted there by your team. To remove the locally stored
auth tokens, sign out in the panel or uninstall the extension. For account-data questions, contact us below.

## Limited Use compliance
Our use of data received from the extension complies with the Chrome Web Store **Limited Use** policy: it is
used only to provide and improve the single stated purpose (assisting the conversation you're viewing, including
the opt-in Capture), and is not sold, not used for unrelated purposes, not used for personalized advertising or
creditworthiness, and not transferred to data brokers.

## Contact
privacy@elostate.com
