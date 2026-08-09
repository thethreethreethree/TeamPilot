# Sales Coach — Data Usage Disclosure

_Maps to: Developer Dashboard → Privacy practices → "Data usage" (category checkboxes) and the Limited-Use
certification. Check ONLY the categories below; leave the rest unchecked._

## Categories to CHECK (collected)

### ☑ Authentication information
- **What:** the user's account session token and refresh token.
- **Why:** to keep the user signed in so the tools run against their own account (the single purpose).
- **How used:** sent only as the `Authorization` header on requests to the extension's backend (`elostate.com`).
- **Stored:** on-device in `chrome.storage.local`. Not transmitted anywhere except as the auth header.
- **Shared with:** no one.

### ☑ Personal communications
- **What:** the sales conversation messages the user selects (or points an adapter at) on the current page.
- **Why:** this IS the thing being coached — the extension cannot coach a conversation it can't read.
- **How used:** sent to the backend (`elostate.com`), which relays it to a **third-party AI provider (currently
  DeepSeek, `api.deepseek.com`)** to generate the coaching result, then returns the result.
- **Stored:** **not stored.** Processed to produce the result and discarded. The Sales Coach extension has no
  save/Capture feature — every tool is processed-and-discarded.
- **Shared with:** the AI sub-processor (DeepSeek) only, and only to generate the requested result; the
  sub-processor does not retain the text.

### ☑ Website content
- **What:** the on-page text the user selects or the site adapter reads on the active tab (this is how the
  conversation above is obtained).
- **Why / How used / Stored / Shared:** identical to Personal communications — it is the same data (the
  conversation), read from the page. Not stored; sent to the backend + AI provider only to generate the result.

## Categories to LEAVE UNCHECKED (not collected)
Personally identifiable information (beyond the auth token), health information, financial/payment information,
location, web history, user activity (no click/scroll/keystroke/mouse tracking), user-generated content beyond
the text the user submits to a tool.

## Limited Use certification (check all — true for this extension)
- ☑ Data is **not** sold to third parties.
- ☑ Data is **not** used or transferred for any purpose unrelated to the single purpose (sales-conversation
  coaching).
- ☑ Data is **not** used or transferred for personalized advertising.
- ☑ Data is **not** used or transferred for creditworthiness or lending decisions.
- ☑ Data is **not** transferred to data brokers or resellers.

> The conversation text IS transmitted to one sub-processor (the AI provider) — but solely to provide the
> disclosed single purpose (generating the coaching result), which is a permitted use, not a "transfer for an
> unrelated purpose." Disclose the sub-processor; do not certify "no data transferred to third parties."
