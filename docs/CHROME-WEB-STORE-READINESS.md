# Chrome Web Store — upload readiness (both extensions)

_Audited 2026-08-09. This is the single "can we upload, and what's left" page. The per-extension paste-ready
dashboard content already exists — this points to it and tells you what's actually blocking._

## TL;DR verdict

| Extension | Verdict | The file you upload | One-line reason |
|---|---|---|---|
| **Sales Coach** | 🟢 **Nearly ready** — 1 founder step + assets | `public/sales-coach-extension.zip` | Lean, least-privilege, submission copy complete + accurate. Only non-code items remain (smoke test, screenshots). |
| **C.A.R.E** | 🟡 **Not ready** — 1 permissions decision + doc fix | `extension/store/care-extension.zip` (built by its packager) | Its manifest requests an all-hosts `*://*/*` optional permission (top rejection reason) with no code that uses it, and its submission doc understates that. |

**Recommendation: submit Sales Coach FIRST.** It's lean (text-only, 3 permissions, one host) → fastest,
lowest-risk review. That derisks your first pass through the CWS process before the heavier C.A.R.E review
(media capture + Supabase host + broad permission).

---

## What "the file you upload" actually is

The Web Store takes a **ZIP of the extension**, not a document. Both are already built by the repo's
`prebuild` step and are also served from the site. To (re)build a clean, production-hardened zip:

```bash
# Sales Coach → public/sales-coach-extension.zip  (strips localhost, validates MV3/icons/description, zips)
node scripts/build-sales-extension-download.mjs

# C.A.R.E → a localhost-stripped package you then zip
node extension/store/build-store-package.mjs        # → extension/store/dist/
cd extension/store/dist && zip -r ../care-extension.zip . -x '.*'
```

Everything the Developer Dashboard asks for beyond the zip (name, description, single-purpose statement,
per-permission justifications, data-use certification, privacy-policy URL) is **already written, paste-ready**:

- Sales: [`extension-sales/CHROME-WEB-STORE-SUBMISSION.md`](../extension-sales/CHROME-WEB-STORE-SUBMISSION.md)
- C.A.R.E: [`extension/store/CHROME-WEB-STORE-SUBMISSION.md`](../extension/store/CHROME-WEB-STORE-SUBMISSION.md)
- General process: [`chrome-web-store-publishing.md`](../chrome-web-store-publishing.md)

---

## Blockers, by owner

### ✅ Fixed this session (was blocking BOTH)
- **Privacy-policy overclaim.** Both live privacy pages said _"We don't sell or share your data with third
  parties"_ — but every tool sends the conversation text to a **third-party AI provider (DeepSeek)** to generate
  the result, so that claim was false and would fail the Web Store data-use review (and mislead users). Both
  pages ([`/extension/privacy`](../src/app/extension/privacy/page.tsx),
  [`/extension/privacy-sales`](../src/app/extension/privacy-sales/page.tsx)) now accurately disclose the AI
  sub-processor and say only what's verifiable (we don't sell / advertise / train on it; the backend doesn't
  retain it). **No unverifiable claim about DeepSeek's own retention was added** — see the founder item below.

### 🔴 Founder decision — C.A.R.E only (the real blocker)
- **`optional_host_permissions: ["*://*/*"]` in `extension/manifest.json`.** An all-hosts permission is the #1
  Web Store rejection reason. I grepped the C.A.R.E client (`extension/*.js`) and found **no
  `chrome.permissions.request` / no runtime use of it** — it looks like a dead copied artifact (the same one the
  Sales port already removed). Its media-upload path uses the separate `https://*.supabase.co/*` host in the
  worker, not this. **Decision: (a) remove it** (recommended, if the RCD media-capture path genuinely doesn't
  request it — I'll verify the capture flow and remove on your word), **or (b) keep + justify it precisely**
  (e.g. reading cross-origin image bytes). Until this is resolved, C.A.R.E should not be submitted.

### 🟠 Me — can do on your word
- **C.A.R.E submission doc is understated vs its real manifest.** `extension/store/CHROME-WEB-STORE-SUBMISSION.md`
  doesn't justify the `https://*.supabase.co/*` host (real — direct media upload to signed URLs) or the `*://*/*`
  optional, and its data-use section omits both the third-party AI (DeepSeek) and the media Capture. The Sales
  doc already discloses the AI sub-processor; the C.A.R.E doc must match its own manifest before submission. I'll
  update it once the `*://*/*` decision above is made (its content depends on keep-vs-remove).

### 🟡 Founder — non-code, required for BOTH before submit
- **Load-unpacked smoke test.** Load each unpacked build in Chrome (`chrome://extensions` → Developer mode →
  Load unpacked) and confirm it opens with no manifest/console errors. (This is the one checklist item the
  packagers can't verify for you.)
- **Store listing assets (images — must be created, can't be code):** at least **one screenshot** (1280×800 or
  640×400) per extension; the 128×128 icon is already in the package; a 440×280 promo tile is optional but helps.
- **Legal sign-off on the privacy wording.** I made the copy *accurate* (removed the false claim, disclosed the
  sub-processor). You own the final legal call — in particular, do NOT add any claim that DeepSeek itself does
  not retain the text unless your DeepSeek DPA says so. The current wording deliberately avoids that.
- **Version bump on each re-upload** (both are `0.1.0` / `0.3.0` today; CWS rejects a re-upload with an
  unchanged version).

### ℹ️ Not a blocker, but sequence it right
- **Extension-ID pinning.** `NEXT_PUBLIC_SALES_EXTENSION_ID` / `NEXT_PUBLIC_CARE_EXTENSION_ID` should be set to
  the **Web Store extension ID** only AFTER the item is published (a Web Store item has a stable ID; sideloaded
  installs have per-install IDs). Setting it while still sideloading breaks the sign-in token handoff. So:
  publish → get the ID → set the env → the handoff pins to the published extension. (Tracked in memory.)

---

## Fast path to a first submission

1. Founder: run the Sales load-unpacked smoke test + take 1–2 screenshots.
2. Founder: skim the accurate privacy wording (both pages) — sign off or tweak.
3. Upload `public/sales-coach-extension.zip`; paste the fields from `extension-sales/CHROME-WEB-STORE-SUBMISSION.md`;
   set the privacy-policy URL to `https://elostate.com/extension/privacy-sales`; submit.
4. In parallel: decide the C.A.R.E `*://*/*` permission → I remove-or-justify + update the C.A.R.E doc → then
   submit C.A.R.E the same way (privacy URL `https://elostate.com/extension/privacy`).
