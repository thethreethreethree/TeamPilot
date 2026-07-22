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
| Host `https://elostate.com/*` | The extension's own backend. The background service worker calls it to run the C.A.R.E tools with the user's token. It is the only network destination. |

We deliberately do **not** request `<all_urls>`, `tabs`, `history`, or per-site host permissions: adapters run
under `activeTab` on the user's click, so no broad host access is needed.

## 4. Data usage disclosure (certify in the dashboard)
- **What is sent:** only the conversation text the user selects (or points an adapter at) on the current page,
  sent to `elostate.com` to run the requested tool, authenticated by the user's own session token.
- **What is stored:** the session token + refresh token (auth) and an optional API-base setting, in
  `chrome.storage.local`. **Conversation text is processed to produce the result and then discarded — never
  persisted** (ephemeral by design).
- **Not collected:** no browsing history, no analytics, no selling/transfer of data, no use for ads or
  creditworthiness. Handled only to provide the single stated purpose.
- **Privacy policy URL:** `https://elostate.com/extension/privacy` (already live).

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
> More tools (Ask Coach, AI Co-pilot) are rolling out.
>
> The panel stays open while you work, minimizes to a bubble, and closes with one click. We only read the text
> you point us at, and we don't store your conversations.
>
> Requires a C.A.R.E account (Pro, or an active trial). Sign in once from the panel — no copy-pasting tokens.

**Screenshots (1280×800):** founder to capture — the panel open on a Gmail thread with a Summarize result is
the strongest single shot. (At least one is required.)

## 5b. Security hardening before Public (do at publish time)
Once the extension has a **fixed published id**, pin it in the connect handoff. Today `/extension/connect?ext=<id>`
auto-sends the user's session to whatever extension id is in the URL. Attack (high bar): a malicious extension
that (a) is already installed and (b) declared `externally_connectable` for elostate.com could receive the token
if a logged-in user is lured to a crafted `?ext=<attacker_id>` URL. Since a malicious installed extension is
already a severe compromise, this is low marginal risk — but the fix is cheap and a reviewer may flag it:
- After publishing, add the published extension id to an allowlist in `src/app/extension/connect/page.tsx`, and
  only auto-send when `ext` matches (unknown ids → show the manual copy fallback instead of auto-sending).
- The id is random for the unpacked dev build, so this can only be pinned once the store id exists.

## 6. Visibility
Start **Unlisted** for beta (installable by direct link, no public search) until the load-test + a real-account
run confirm it end-to-end; flip to **Public** after.
