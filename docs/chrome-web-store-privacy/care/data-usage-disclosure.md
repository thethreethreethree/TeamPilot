# C.A.R.E — Data Usage Disclosure

_Maps to: Developer Dashboard → Privacy practices → "Data usage" (category checkboxes) and the Limited-Use
certification. C.A.R.E collects one more category than Sales Coach because of the opt-in Capture save-path._

## Categories to CHECK (collected)

### ☑ Authentication information
- **What:** the user's account session token and refresh token.
- **Why:** to keep the user signed in so the tools run against their own C.A.R.E workspace.
- **How used:** sent only as the `Authorization` header on requests to the backend (`elostate.com`).
- **Stored:** on-device in `chrome.storage.local`. **Shared with:** no one.

### ☑ Personal communications
- **What:** the customer conversation messages the user selects (or points an adapter at) on the current page.
- **Why:** it is the thing being assisted — the tools can't summarize/diagnose/draft a conversation they can't read.
- **How used:** sent to the backend (`elostate.com`), which relays it to a **third-party AI provider (currently
  DeepSeek, `api.deepseek.com`)** to generate the result.
- **Stored:** **not stored for the tools** (processed to produce the result, then discarded) — UNLESS the user
  uses **Capture** (see User-generated content).
- **Shared with:** the AI sub-processor (DeepSeek) only, to generate the requested result.

### ☑ Website content
- **What:** the on-page text and, for Capture, images the user selects/points the panel at on the active tab.
- **Why / How used / Stored / Shared:** same as Personal communications — it is how the conversation is obtained
  from the page. Tool text is not stored; Captured content is saved (below).

### ☑ User-generated content (Capture only)
- **What:** when the user explicitly clicks *Capture conversation → C.A.R.E*, the conversation's messages **and
  attached media (images)** are saved to their own C.A.R.E workspace.
- **Why:** so the user's team can keep the thread as part of their customer records (an intentional save action).
- **How used:** stored privately in the user's workspace; image bytes uploaded directly to a signed storage URL.
- **Stored:** in the user's C.A.R.E workspace, per the workspace's retention policy. **Shared with:** only the
  user's own team; never sold, never used to train models.

## Categories to LEAVE UNCHECKED (not collected)
Personally identifiable information (beyond the auth token), health information, financial/payment information,
location, web history, user activity (no click/scroll/keystroke/mouse tracking).

## Limited Use certification (check all — true for this extension)
- ☑ Data is **not** sold to third parties.
- ☑ Data is **not** used or transferred for any purpose unrelated to the single purpose (assisting the
  customer conversation).
- ☑ Data is **not** used or transferred for personalized advertising.
- ☑ Data is **not** used or transferred for creditworthiness or lending decisions.
- ☑ Data is **not** transferred to data brokers or resellers.

> Two disclosures the reviewer needs: (1) conversation text is transmitted to one AI sub-processor solely to
> provide the single purpose (a permitted use, not an unrelated transfer); (2) Capture is an opt-in save of the
> user's own conversation into the user's own workspace. Disclose both; do not certify "no data transferred to
> third parties."
