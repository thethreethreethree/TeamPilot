# C.A.R.E — Chrome Web Store submission package

Everything the CWS Developer Dashboard asks for, ready to paste. Follows `chrome-web-store-publishing.md`.
The Privacy tab (section 5 of that guide) is where most rejections happen — that content is filled in below.

## 0. Build the package (strips dev-only bits)
```bash
node extension/store/build-store-package.mjs        # → extension/store/dist/ (localhost stripped, dead files dropped)
cd extension/store/dist && zip -r ../care-extension.zip . -x '.*'
```
The script removes `http://localhost:4321` from `host_permissions` + `externally_connectable` (an unused
permission is the #1 rejection reason) and excludes `popup.*`, `README.md`, and the `store/` tooling.

## 1. Pre-submission checklist — verified (build-store-package.mjs + validation)
- [x] `manifest.json` valid JSON · `manifest_version` 3
- [x] Description 104 chars (< 132)
- [x] icon16/48/128 exist at their **native declared dimensions** (16×16 / 48×48 / 128×128 px, LANCZOS-downscaled from the 1024² master); 128 declared
- [x] Every declared permission used in code (activeTab, scripting, storage, host elostate.com)
- [x] No `eval()` / `new Function()` / remotely-hosted code (MV3-compliant)
- [x] Production manifest is localhost-free
- [ ] Loads via Load-unpacked without errors ← **founder confirms** (README checklist)
- [ ] Version bumped on each re-upload (currently `0.1.0`)

## 2. Single purpose (required — multi-purpose gets rejected)
> C.A.R.E helps a logged-in C.A.R.E subscriber understand and respond to a customer conversation shown on the
> current web page: it summarizes the selected conversation and diagnoses the underlying problem. That single
> purpose — assist the conversation you're viewing — governs every feature.

## 3. Permission justifications (one per permission — production set)
| Permission | Justification |
|---|---|
| `activeTab` | The panel is injected only when the user clicks the C.A.R.E toolbar icon, and only into that one active tab. This grants access to the page the user explicitly invoked us on — nothing in the background, no other tabs. |
| `scripting` | Used to inject the panel (`chrome.scripting.executeScript`) into the active tab on the icon click. No programmatic injection happens without that user gesture. |
| `storage` | Stores the user's C.A.R.E session token (and its refresh token) in `chrome.storage.local` so they stay signed in between page visits, plus an optional API base override. No conversation content is ever stored. |
| Host `https://elostate.com/*` | The extension's own backend. The background service worker calls it to run the C.A.R.E tools with the user's token. It is the primary network destination. |
| Host `https://*.supabase.co/*` | Capture only. When the user saves a conversation's media (images) to their workspace, the worker uploads the bytes DIRECTLY to a per-file **signed URL** on the workspace's storage (Supabase), so large media never traverses our API's request-body limit. The URL is pinned to `*.supabase.co` in code so it can't be turned into an open PUT proxy. |
| `optional_host_permissions: *://*/*` (OPTIONAL, not requested at install) | Capture only. To include a conversation's **cross-origin images** in a Capture, the worker must fetch those image bytes, which requires host access to the image's origin. This is an **optional** permission the user explicitly grants via a permission page, only when they first Capture media — it is NOT requested on install and the tools work without it (media then stays metadata-only). |

We do **not** request `<all_urls>`, `tabs`, or `history` at install: the tools run under `activeTab` on the
user's click. The all-hosts permission above is **optional and user-granted at runtime**, solely to fetch
cross-origin image bytes for the Capture-to-workspace feature.

## 4. Data usage disclosure (certify in the dashboard)
> ⚠️ **Accuracy note (verified 2026-08-09):** the conversation text IS transmitted to a THIRD-PARTY AI provider
> (currently DeepSeek, `api.deepseek.com`) to generate the tool result — the server relays it. Your Google
> data-use certification and the privacy policy must disclose that sub-processor; do NOT certify "no data
> transferred to third parties" without it. The live privacy page (`/extension/privacy`) was updated to disclose
> this. Facts below are verified from the code; you make the final certification.
- **What is sent, and where:** the conversation text the user selects (or points an adapter at) on the current
  page, sent to `elostate.com` (authenticated by the user's own session token) to run the requested tool — and
  from there **transmitted to our AI provider (currently DeepSeek) to generate the result.**
- **Capture (the one save-path):** when the user explicitly clicks *Capture conversation → C.A.R.E*, the
  messages **and any attached media (images)** are saved to their own C.A.R.E workspace (media bytes uploaded
  directly to a signed Supabase URL). This is opt-in per action, stored privately in the user's workspace, never
  sold, never used to train models.
- **What is stored by the extension itself:** only the session token + refresh token (auth) and an optional
  API-base setting, in `chrome.storage.local`. **Tool conversation text is processed to produce the result and
  then discarded by our backend — not persisted** (Capture is the only save, and it's user-initiated).
- **Not done:** no browsing history, no analytics, no selling of data, no use for ads or creditworthiness, no
  use to train our own models. Handled only to provide the single stated purpose.
- **Privacy policy URL:** `https://elostate.com/extension/privacy` (live; updated 2026-08-09 to disclose the AI
  sub-processor + Capture).

## 5. Store listing copy
**Name:** C.A.R.E — assist the conversation you're viewing
**Short description (manifest, 104 chars):** *Summarize, Dissect, Coach and Co-Pilot the conversation on your
screen, powered by your C.A.R.E account.*
**Category:** Productivity
**Detailed description (paste):**
> C.A.R.E brings your customer-conversation tools to wherever the conversation actually happens — Gmail, your
> help desk, social DMs, anywhere.
>
> Click the C.A.R.E icon and a panel opens on the page. Point it at the open thread (or highlight any text) and:
> • **Summarize** — catch up on a long thread in seconds.
> • **Dissect** — surface the real underlying problem, not just the last message.
> • **Ask Coach** — grade a draft reply against the books. • **AI Co-Pilot** — draft the next reply, with the move named.
>
> The panel stays open while you work, minimizes to a bubble, and closes with one click. We only read the text
> you point us at, and we don't store your conversations.
>
> Requires a C.A.R.E account (Pro, or an active trial). Sign in once from the panel — no copy-pasting tokens.

**Screenshots (1280×800):** founder to capture — the panel open on a Gmail thread with a Summarize result is
the strongest single shot. (At least one is required.)

## 5b. Security hardening before Public (do at publish time)
The pin is **already built** — you do NOT write code. `/extension/connect` reads `allowedExtId` from
`NEXT_PUBLIC_CARE_EXTENSION_ID` and, when it's set, hands the token off **only** to that exact extension id
(`isExtensionHandoffAllowed` refuses any other, so a lure to `?ext=<attacker_id>` cannot exfiltrate the token).
When the env id is unset (unpacked dev, per-install ids we can't predict), it hands off + warns (dev posture).
So the only publish-time action is to set the env var to the published id:
- After publishing, set `NEXT_PUBLIC_CARE_EXTENSION_ID` = the store id in production, then **redeploy** (it's a
  `NEXT_PUBLIC_*` var, inlined at build time, so it takes effect only on a fresh build).
- Do this only AFTER publishing — a set-but-wrong id makes the connect page REFUSE the handoff, breaking sign-in
  on every sideloaded install (their id ≠ the pinned id).
- Full ordered steps + the positive/negative verify checks: see
  [`docs/CHROME-WEB-STORE-READINESS.md`](../../docs/CHROME-WEB-STORE-READINESS.md) → "Post-publish: pin the extension IDs".

## 6. Visibility
Start **Unlisted** for beta (installable by direct link, no public search) until the load-test + a real-account
run confirm it end-to-end; flip to **Public** after.
