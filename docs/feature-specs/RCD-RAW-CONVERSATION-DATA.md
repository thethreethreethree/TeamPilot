# RCD — Raw Conversation Data (feature spec)

**Status:** Phase 1 (capture foundation) shipped · Phases 2–5 blocked on ONE founder decision (§ Decision, below)
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

- **Phase 2 — transport contract.** Extend `content.js`/`background.js` to send structured RCD; a new `/api/care/extension/rcd` ingest route with a Zod schema for `{ messages: [{role, sender, text, media[]}] }`. Multipart/binary handling for media bytes.
- **Phase 3 — persistence.** Migration: `care_rcd_conversations` + `care_rcd_messages` (+ a Storage bucket for media) with tenant RLS + retention. Append-only per §3.1. Media download worker.
- **Phase 4 — web display.** RCD panel below the `<Composer>` in `ConversationsApp.tsx`; render text + media thumbnails (reuse `InlineAttachment`). Visible in both modes (NOT `ExpertOnly`).
- **Phase 5 — mobile display.** RCD bottom sheet in `CareRadialHome.tsx`; same data. Wire `ExperienceModeProvider` if mode-respect is wanted.
- **Throughout:** each adapter's live selectors need a real-browser confirmation before that channel's RCD is trusted (the standing UNVERIFIED caveat).

## 7. Maintenance note

Per the Jeff-product-knowledge mandate pattern: when a new channel/adapter is added, its `extractRCD()` + a browser-confirmed selector set must be added in the same change. RCD coverage is only as complete as its adapters.
