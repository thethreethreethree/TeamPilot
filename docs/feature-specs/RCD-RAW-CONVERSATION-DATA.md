# RCD — Raw Conversation Data (feature spec)

**Status:** Pipeline built end-to-end for TEXT + attribution + media metadata (app-rendered, founder-decided 2026-07-26) — RUNTIME-UNVERIFIED; migration 0194 must be applied. Media BYTES (the "store bytes" choice) are the one remaining piece — Phase 2c, gated on the host-permissions decision. Downstream (ingest, private bucket, signed URLs, both displays) is already byte-ready.
**Founder directive (2026-07-26):** *"modify our C.A.R.E extension so that it is capable of retrieving/capturing all content of the message from all of the channels… by all content I mean image and all data/media content. This is now defined as RCD RAW CONVERSATION DATA, and it is present on the bottom part of the C.A.R.E system. for both Mobile and Website. This is true for both Expert, and Standard mode."*

---

## 1. What RCD is

The complete, faithful, **structured** record of a conversation as it actually happened — every message's **text + sender/role + all media (images, files, audio, video)** — captured from all 11 channels the C.A.R.E extension supports, surfaced at the **bottom of the C.A.R.E app** on **both web and mobile**, in **both Standard and Expert mode**.

**Why (the need under the ask):** today the extension scrapes a lossy, mostly-unlabeled, **text-only** blob. A customer's screenshot, receipt, or attached file simply vanishes, and who-said-what is often lost. The AI and the agent therefore reason from an incomplete record. RCD makes the *full* conversation a first-class asset (§1.1 data-as-asset: nothing discarded).

## 2. Governing framework (why the design is shaped this way)

- **A39** (central) — multi-party text must carry per-party attribution **at the source**, or a downstream consumer reconstructs roles confidently wrong. → RCD is a per-message array with `role`/`sender`, never a flat blob.
- **A31** — schema-complete ≠ built; a feature needs BOTH a write path (capture→store) and a read path (render), or it "does not exist." → the plan pairs every capture phase with its display phase.
- **A26** — sweep the whole class → all 11 adapters, not a subset.
- **§1.5 / A5** — additive; never regress the working text path the 6 tools consume.
- **§2 / §3.4 / A18** — storing customer media/PII is a real constraint to interrogate, not silently resolve.
- **AMD-006** — build foundation-up (structure → effectivity → composition → surface).

## 3. Current-state map (as of 2026-07-26)

| Concern | Reality |
|---|---|
| Extension | Plain MV3 in `extension/` — `manifest.json`, `background.js`, `content.js`, `adapters.js`, `config.js`. |
| Adapters (11) | gmail, outlook, instagram, messenger, whatsapp, linkedin, gorgias, zendesk, intercom, front, slack — all in `extension/adapters.js`. **Were text-only**; only gmail + whatsapp carried role labels. Selectors self-flagged UNVERIFIED for 10/11. |
| Data shape | A flat `string` (whole convo concatenated, 20k cap). No structured message array, no media field. |
| Transport | `content.js` → `background.js` → JSON `{ conversation, draft?, intent?, lastSpeaker? }` → `/api/care/extension/<tool>`. All `.strict()` string-only. **No binary/multipart.** |
| Persistence | **None** — extension tool routes process-and-discard. The extension's current verified-honest posture is *"nothing stored."* |
| Web display | `ConversationsApp.tsx` (3-column). Bottom of centre column = `<Composer>` (reply + tool buttons). Natural RCD host region. |
| Mobile display | `/care/mobile` → `CareRadialHome.tsx` (radial launcher + slide-up bottom sheets). NOT wrapped by `ExperienceModeProvider` (mode-agnostic today). |
| In-app media | The in-app product already models media (`Message.mediaUrl/mediaType`, `InlineAttachment`) — a pattern to reuse for the RCD panel. |

## 4. What is already built (Phase 1 — shipped, commit `15ef16b7`)

`extension/adapters.js` — additive structured capture, no regression to the text path:
- `defaultMediaFrom(node)` — captures image/file/audio/video **references** (URLs in the page), filters UI icons by size, de-dupes.
- `rcdFrom(msgSel, roleOf)` — per-message `{ role, sender, text, media[] }`, attribution preserved at source (A39).
- `rcdOrText()` — degrade floor: selector miss → one message from the proven text extraction (never worse than today).
- `extractRCD()` on all 11 adapters (A26).
- Tested: `src/lib/care/__tests__/extensionRcd.test.ts` (11 fake-DOM logic tests). **Live third-party selectors remain RUNTIME-UNVERIFIED** (no headless browser can confirm them; honest per AMD-006 3rd addendum).

## 5. 🚦 THE decision that unblocks everything (founder)

**Do we persist customer conversation content, and how?** RCD "present in the C.A.R.E app, mobile + web" means the extension must send captured data to our backend and STORE it — reversing the current *"nothing stored"* posture. Options:

| Option | What it means | Trade-off |
|---|---|---|
| **A. Store bytes** (recommended) | Download the media + store it in a tenant-RLS'd Supabase Storage bucket + an `care_rcd_*` table; text stored too. | Faithful + durable in-app later. But we now hold customers' scraped media/PII → retention window + consent + PII-in-screenshots are real obligations. |
| **B. References only** | Store text + media **URLs** (no bytes). | Cheap, lighter privacy footprint. But WhatsApp blob URLs die and Gmail/CDN URLs need the customer's own auth → media often un-viewable later in-app. Effectively text + dead links. |
| **C. Ephemeral, extension-only** | Render RCD live in the extension's on-page panel, never transmitted/stored. | Preserves *"nothing stored."* But desktop-only — **cannot** satisfy "mobile + website in the C.A.R.E app." |

Secondary confirmations:
- **Placement:** RCD panel at the bottom of the **C.A.R.E app** (Composer region on web, a bottom sheet on mobile) — confirm, vs the extension overlay.
- **Mobile mode:** leave `/care/mobile` mode-agnostic (RCD shows in both, trivially) or wire `ExperienceModeProvider` so mobile *respects* Standard/Expert.
- **The mockup image** you referenced never reached my context — if it pins the layout, re-send.

## 6. Phased plan (ready to execute on the decision)

Assumes **Option A** (the only one that fully satisfies the directive). Each phase pairs write + read (A31).

- **Phase 1 — capture.** ✅ `extension/adapters.js`: `extractRCD()` on all 11 adapters (structured + attributed + media, additive). `15ef16b7`.
- **Phase 2 — ingest transport.** ✅ `/api/care/extension/rcd` (JSON in → rows + signed upload URLs out; degrade 503 if 0194 unapplied). `27aabce7`. 5 route tests.
- **Phase 2b — extension wiring.** ✅ (text + attribution + media METADATA) `content.js` "Capture conversation" → ingest via `background.js`. Consent copy updated (§3.4: Capture STORES). `e0ba5cb2`/`cabea147`.
- **Phase 2c — media BYTES.** ⬜ NOT built. content.js may make NO direct network calls (security invariant, `extensionWorker.test.ts`), and the worker can't read page-scoped `blob:` URLs — so byte sync needs a deliberate invariant-safe design: read bytes in content.js WITHOUT fetch (canvas for images / FileReader for blobs, mind CORS-taint) → pass to the worker → worker PUTs to the signed URL with a SCOPED `*.supabase.co` host permission. This is the "store bytes" the founder chose; everything downstream (ingest, bucket, signed URLs, both displays) is already byte-ready. Gated on the host-permissions decision.
- **Phase 3 — persistence.** ✅ Migration `0194`: `care_rcd_conversations`/`_messages`/`_media` + PRIVATE `care-rcd-media` bucket, tenant RLS, content-immutable (§3.1). `b0881d47`. **Must be applied.**
- **Phase 4 — web display.** ✅ `RcdPanel` mounted in `CareShell` (bottom, app-wide, both modes). Read routes `GET /api/care/rcd` + `/api/care/rcd/[id]` (signed media URLs). `f28e12c4` / `c6ab0275`.
- **Phase 5 — mobile display.** ✅ `RcdMobileSheet` in `CareRadialHome` (Layers nav button; dark-console styling). `ba98523f`.
- **Retention purge (Phase 3b).** ✅ `/api/care/rcd/retention-cron` — service-role purge: removes media BYTES first, then deletes conversations (cascade). `RCD_RETENTION_DAYS` (default 90). DORMANT until `CRON_SECRET` set + a `vercel.json` schedule added (a conscious activation — it deletes customer PII). 4 gate tests. `79590d6b`.
- **Media bytes — images only.** ✅ Phase 2c: content.js canvas-reads image bytes (invariant-safe) → worker PUTs to the signed URL (`ac443b91`). ⬜ NON-image bytes (files/video/audio) stay metadata-only — canvas is image-only; those need a worker-fetch path + broader host permissions (a security decision).

## Runtime verification (founder — the whole feature is code-complete but UNVERIFIED)

1. **Apply migration `0194`** (creates the tables + private bucket). Until then the panel shows empty and ingest returns 503.
2. **Web:** open the C.A.R.E app → the "Raw Conversation Data" bar sits at the bottom → expand → empty state.
3. **Extension:** on a supported channel (e.g. WhatsApp Web), click **Capture conversation → C.A.R.E**. Confirm the status line reports messages captured + attachments uploaded.
4. **Byte upload / image thumbnails** — the worker PUTs to the signed URL; the `*.supabase.co` host permission is already added to `manifest.json`, so **reload the extension and accept the new permission**. Same-origin/blob images (WhatsApp) canvas-read fine; cross-origin images without CORS taint the canvas → they stay filename-only. Confirm thumbnails appear.
5. **Web + mobile:** the captured conversation appears in the RCD panel (web) and the RCD sheet (mobile, Layers button) with correct roles + media thumbnails.
6. **Per-adapter selector confirmation** — each channel's `extractRCD` selectors are still best-effort/UNVERIFIED (10/11); confirm capture quality per channel and tighten selectors as needed.

## Open data-governance items (founder decisions — flagged, not built)

- **Targeted GDPR/CCPA erasure.** The `care_rcd_*` tables are content-immutable with a retention-only (time-based) delete path — there is **no** mechanism to erase ONE customer's captured messages/media on request. Storing customer PII creates that obligation. Options: a service-role targeted-delete tool (deletes that customer's captures + bucket objects), or anonymization. Same class as the existing `anonymizeCustomer()` consideration for the event tables. Not built — a legal/compliance decision.
- **Sub-processor + storage disclosure.** RCD stores customer conversations scraped from third-party platforms into the tenant's workspace. Whether/how the business must disclose that to their own customers is the business's data-processing decision; the extension privacy + download pages now state honestly that Capture stores.
- **Chrome Web Store.** The new `*.supabase.co` host permission needs a justification in the CWS submission; the store listing/description should mention Capture. Adding a host permission also disables an already-installed extension until the user re-accepts.

## 7. Maintenance note

Per the Jeff-product-knowledge mandate pattern: when a new channel/adapter is added, its `extractRCD()` + a browser-confirmed selector set must be added in the same change. RCD coverage is only as complete as its adapters.

## 8. Capture-layer audit — issues Phase 2/3 MUST handle (found auditing the Phase-1 foundation)

THINK-first review of what `extractRCD`/`defaultMediaFrom` actually capture, and what breaks downstream. These sharpen the persistence decision in section 5 above — several are reasons Option A (store bytes) beats Option B (references).

1. **🔒 Captured media URLs can carry auth tokens / be session-scoped.** Many platforms serve media from `?token=…`/signed-CDN URLs or ephemeral `blob:` URLs valid only in the agent's page session. Consequence: (a) storing the raw URL persists a **credential** (leak risk — must never land in a client-readable column or a log); (b) the URL is often **un-fetchable later** from our server or another device. → Option A must **download the bytes at capture time in the agent's browser** (where the session/blob is valid) and upload those, NOT store the URL. Option B is therefore not just "lighter" — for token/blob URLs it stores dead-or-dangerous links. This is the decisive technical argument for Option A.
2. **PII inside images.** Screenshots customers paste routinely contain IDs, card numbers, addresses. Storing them = holding sensitive PII. Retention window + access scoping (tenant-RLS bucket, no public URLs) + possibly redaction are Phase-3 requirements, not nice-to-haves (§3.4 / A18).
3. **Fidelity cap vs "ALL content".** `rcdFrom` keeps the most-recent **500 messages** and text helpers cap at 20k chars — a deliberate payload bound, but it means a very long thread's oldest turns are dropped. If "ALL content" must be literal for compliance/record, Phase 2 needs pagination or a higher/paged cap. Flagged so the cap is a conscious choice, not a silent truncation (§3.4).
4. **Attachment-chip under-capture (per-adapter).** `defaultMediaFrom` scans the message node; platforms that render attachments **outside** the message body (Gmail chips, some ticketing UIs) will under-capture until each adapter's container selector is widened — and confirmed live. Tracked as the standing per-adapter runtime-verification task.
5. **Icon/emoji filter false-negatives.** The `<40px` filter can drop a genuinely tiny product thumbnail, and unsized (lazy) images are captured by design (better over- than under-capture). Acceptable for best-effort; revisit if noise is high in real use.
6. **Runtime verification is the gate to trust.** 10/11 adapters' selectors are unconfirmed against live DOM. Until each is browser-verified, that channel's RCD is best-effort. The ephemeral extension-side render (if built) would double as the founder's verification surface — a candidate Phase-2 sub-step, pending the placement decision.
