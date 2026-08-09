# Chrome Web Store — screenshot capture guide (both extensions)

_Store-listing asset (separate from the Privacy tab). Screenshots must be created by hand — they're images of
the live panel, which can't be generated from code. This turns "you need screenshots" into an exact shot list._

## Requirements (Chrome Web Store)
- **Size:** 1280×800 px (recommended) or 640×400 px. Use ONE size consistently.
- **Count:** at least **1**, up to **5**. Aim for 3–4 — more screenshots visibly lift install rates.
- **Format:** PNG or JPEG, no rounded corners/drop-shadows added by you (the store frames them).
- **Content rule:** show the actual extension UI. No competitor logos; blur/scrub any real customer names,
  emails, or messages (use a demo/test conversation).

## How to capture cleanly
1. Load the production unpacked build (`chrome://extensions` → Developer mode → Load unpacked → the built
   folder) and sign in.
2. Open a **demo conversation** (a test Gmail thread / test DM) — not a real customer's.
3. Click the toolbar icon to open the panel, trigger the feature, then screenshot the browser at a window size
   that yields 1280×800 (or crop to it). Chrome DevTools device toolbar can force an exact viewport.

---

## Sales Coach — shot list (4)

| # | Screen | What to show | Suggested caption |
|---|---|---|---|
| 1 | Panel open on a conversation | The Sales Coach panel docked over a demo sales thread, tools visible (Prospect Intel, Suggested Response) | "Coach the sales conversation you're viewing — right where it happens." |
| 2 | Suggested Response result | A drafted reply in the panel with the "Move:" note underneath | "Get a ready-to-send reply, plus the sales move behind it." |
| 3 | Prospect Intel result | The where-the-deal-stands / what's-working analysis | "Read the room: where the deal stands and the next move." |
| 4 | Guidance box + Upload | The guidance textarea and the "Upload conversation" button | "Steer the draft with your own intent, or upload a chat export." |

## C.A.R.E — shot list (4)

| # | Screen | What to show | Suggested caption |
|---|---|---|---|
| 1 | Panel open on a conversation | The C.A.R.E panel over a demo support thread, tools visible | "Assist the customer conversation you're viewing." |
| 2 | Summarize / Dissect result | A thread summary or the dissected underlying problem | "Catch up on a long thread — or surface the real problem." |
| 3 | AI Co-Pilot result | A drafted reply forming/complete with the move note | "Draft the next reply in your voice, with the move named." |
| 4 | Capture (optional feature) | The capture-to-workspace action | "Save the conversation — text and media — into your workspace." |

---

## Optional but recommended
- **Small promo tile:** 440×280 px — used in the store's category/search grids. One clean shot of the icon +
  tagline works.
- **Marquee promo:** 1400×560 px — only needed if you want featured placement; skip for launch.

_Once captured, drop them in the Developer Dashboard → Store listing → Screenshots. The 128px icon is already in
each package._
