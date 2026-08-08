# Sales Coach — Chrome Web Store submission package

Everything the CWS Developer Dashboard asks for, ready to paste. Mirrors the C.A.R.E extension's approved
submission guide (`extension/store/CHROME-WEB-STORE-SUBMISSION.md`) with the Sales Coach extension's actual,
verified details. The Privacy tab is where most rejections happen — that content is filled in below.

> **Marketing copy in section 5 is a DRAFT for founder review.** Everything else (permissions, data disclosure,
> checklist) is verified fact about the built extension. The store listing voice/name/description is the
> founder's call.

## 0. Build the package (strips dev-only bits)
```bash
node scripts/build-sales-extension-download.mjs   # → public/sales-coach-extension.zip
```
The script removes `http://localhost:4321` from the manifest, validates (MV3, 128px icon, description length,
required files present), and zips `extension-sales/` deterministically. That prod-hardened zip is what you
upload (it's also what `/extension/download-sales` serves).

## 1. Pre-submission checklist — verified (build-sales-extension-download.mjs + a zip-contents check)
- [x] `manifest.json` valid JSON · `manifest_version` 3
- [x] Description 121 chars (< 132)
- [x] icon16/48/128 present and declared (128 declared)
- [x] Every declared permission used in code — `activeTab`, `scripting`, `storage`, host `elostate.com`
- [x] No unused permissions — the copied `*.supabase.co` host grant AND the `optional_host_permissions`
      `*://*/*` all-hosts grant were both removed (both were RCD-only in C.A.R.E; the text-only sales extension
      never calls Supabase and never requests optional hosts — it talks only to `elostate.com` under `activeTab`)
- [x] No `eval()` / `new Function()` / remotely-hosted code (MV3-compliant)
- [x] Production manifest is localhost-free (stripped at build; verified in the shipped zip)
- [ ] Loads via Load-unpacked without errors ← **founder confirms** (see the test runbook)
- [ ] Version bumped on each re-upload (currently `0.1.0`)

## 2. Single purpose (required — multi-purpose gets rejected)
> The Sales Coach extension helps a logged-in subscriber understand and respond to a sales conversation shown
> on the current web page: it reads the room, coaches the rep's reply, catches them up, and drafts the next
> message. That single purpose — coach the conversation you're viewing — governs every feature.

## 3. Permission justifications (one per permission — production set)
| Permission | Justification |
|---|---|
| `activeTab` | The panel is injected only when the user clicks the Sales Coach toolbar icon, and only into that one active tab — the page the user explicitly invoked us on. Nothing in the background, no other tabs. |
| `scripting` | Used to inject the panel (`chrome.scripting.executeScript`) into the active tab on the icon click. No programmatic injection happens without that user gesture. |
| `storage` | Stores the user's session token (and its refresh token) in `chrome.storage.local` so they stay signed in between page visits, plus an optional API-base override. No conversation content is ever stored. |
| Host `https://elostate.com/*` | The extension's own backend. The background service worker calls it to run the tools with the user's token. It is the only network destination. |

We deliberately do **not** request `<all_urls>`, `tabs`, `history`, per-site host permissions, optional host
permissions, or Supabase host access: adapters run under `activeTab` on the user's click, and all network
traffic goes to `elostate.com`.

## 4. Data usage disclosure (certify in the dashboard)
> ⚠️ **Accuracy note (verified 2026-08-08):** the conversation text IS transmitted to a THIRD-PARTY AI provider
> (currently DeepSeek, `api.deepseek.com`) to generate the result — the server relays it. Your Google data-use
> certification and the privacy policy must disclose that sub-processor; do NOT certify "no data transferred to
> third parties" without it. Facts below are verified from the code; you make the final certification (and see
> the F1 item in the founder action queue — same sub-processor point on the live privacy pages).
- **What is sent, and where:** only the conversation text the user selects (or points an adapter at) on the
  current page, sent to `elostate.com` (authenticated by the user's own session token) to run the requested
  tool — and from there **transmitted to our AI provider (currently DeepSeek) to generate the result.**
- **What is stored:** the session token + refresh token (auth) and an optional API-base setting, in
  `chrome.storage.local`. **Conversation text is processed to produce the result and then discarded — not
  persisted by us.** The Sales Coach extension has NO save path (unlike C.A.R.E's Capture) — it is ephemeral
  on our side. (Whether the AI provider retains it is governed by their terms — confirm your DeepSeek DPA.)
- **Not collected / not done:** no browsing history, no analytics, no ads, and we don't SELL your data or
  transfer it to any third party for that party's OWN purposes. The only transmission is to our AI provider,
  solely to produce the result you asked for.
- **Privacy policy URL:** `https://elostate.com/extension/privacy-sales` (live) — see F1: its "no third-party
  sharing" line needs the same sub-processor disclosure before launch.

## 5. Store listing copy — DRAFT (founder to review/replace)
**Name:** Sales Coach — coach the sales conversation you're viewing
**Short description (manifest, 121 chars):** *Sales coaching on the conversation you're viewing: read the room,
coach your reply, catch up, and draft the next message.*
**Category:** Productivity
**Detailed description (draft):**
> Sales Coach puts your coaching on the conversation wherever it actually happens — Gmail, Outlook, Instagram,
> Messenger, WhatsApp Web, LinkedIn, Slack, and more.
>
> Click the Sales Coach icon and a panel opens on the page. Point it at the open thread (or highlight any text):
> • **Read the room** — what's working, the opportunity, the next move.
> • **Coach my reply** — grade your draft against the sales playbook before you send.
> • **Catch me up** — where the deal stands in seconds.
> • **Draft my reply** / **Say it for me** — a strong next message, grounded in the methodology, one click to copy.
>
> We only read the conversation you point us at, and we don't store it. Requires an active plan or trial —
> sign in once from the panel, no copy-pasting tokens.

**Screenshots (1280×800):** founder to capture — the panel open on a Gmail or LinkedIn thread with a "Read the
room" or "Draft my reply" result is the strongest single shot. (At least one is required.)

## 5b. Security hardening before Public (do at publish time)
Once the extension has a **fixed published id**, set `NEXT_PUBLIC_SALES_EXTENSION_ID` in production to that id.
The connect handoff (`/extension/connect?product=sales`) is already product-aware and pins the token to that id
when set; until it's set it hands off + warns (dev posture). Setting it arms the "only the official extension
receives the token" lock — do this before flipping to Public.

## 6. Visibility
Start **Unlisted** for beta (installable by direct link, no public search) until a real-account run confirms it
end-to-end per the test runbook; flip to **Public** after (and after the icon + the `NEXT_PUBLIC_SALES_EXTENSION_ID`
pin above).
