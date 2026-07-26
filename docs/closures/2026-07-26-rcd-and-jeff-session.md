# Closure — 2026-07-26: RCD + Jeff product knowledge

One actionable record of the session, so the founder has a single list rather than findings
scattered across ~25 commits. All pushed to `main` (auto-deploys). Full canonical gate green
(`npm run check` exit 0 · 1445 tests · 0 leaks/policy-gaps/violations) **and** `next build` green.

---

## 🚦 FOUNDER ACTIONS

1. **Reload the extension** (`chrome://extensions` → reload → **accept the new `*.supabase.co` permission**). The manifest changed for image-byte upload; without a reload, Capture runs old code.
2. **Re-test Capture** on a channel (WhatsApp) → confirm: N messages (not 1), Agent/Customer roles, the prominent "Raw Conversation Data" bar at the app bottom (auto-opens), and whether image **thumbnails** appear. Report the status line back.
3. **Three deferred decisions** (details in `docs/feature-specs/RCD-RAW-CONVERSATION-DATA.md`):
   - **Non-image media bytes** (PDF/video/audio) — metadata-only today; capturing bytes needs BROADER extension host-permissions (a security tradeoff — not taken unilaterally).
   - **Activate retention** — set `RCD_RETENTION_DAYS` (default 90) + add `/api/care/rcd/retention-cron` to `vercel.json` + `CRON_SECRET`. Dormant until then (it deletes customer PII — a conscious activation).
   - **Targeted GDPR/CCPA erasure** for captured customer PII — not built (tables are immutable + retention-only delete). A legal decision; same class as `anonymizeCustomer()`.
4. **Chrome Web Store** (when publishing): justify the new `*.supabase.co` host permission; the store description should mention Capture. Adding a host permission disables an already-installed extension until re-accepted.

---

## Shipped this session

**Jeff can define our own product (founder: "Jeff couldn't answer what C.A.R.E is on our own widget").**
- Root cause (§0): the per-tenant `aiProductContext` DB config was returned BEFORE the ELOSTATE branch, so a stale config silently defeated the good knowledge.
- Fix: `src/lib/care/elostateProductKnowledge.ts` — single source of truth, defines C.A.R.E (Customer Assistance & Response Engine) + ELOSTATE + every shipped feature/channel (incl. email + Live Monitor), made AUTHORITATIVE for our tenant (checked first), reaches the LLM un-truncated. Content-lock test. Standing mandate: update it every feature. `4ddb1af2`, `972853f5`.
- Ripple fixed: the widget-settings "Product context" field is now display-only for our tenant (labeled), not a silent no-op. `43865cc2`.

**RCD — Raw Conversation Data (founder: capture ALL content incl. media from all 11 channels → bottom of the C.A.R.E app, mobile + web, both modes).** Founder decided store-bytes + app-rendered.
- Phase 1 capture — `extractRCD()` on all 11 adapters (structured, attribution at source per A39, media). `15ef16b7`.
- Phase 2 ingest — `/api/care/extension/rcd` (JSON → rows + signed upload URLs; 503 degrade if unapplied). `27aabce7`.
- Phase 2b/2c wiring — content.js Capture → worker ingest → **image bytes via canvas→worker→signed URL** (invariant-safe; content.js makes no direct network calls). `e0ba5cb2`, `ac443b91`.
- Phase 3 data — migration `0194` (APPLIED): private `care-rcd-media` bucket + 3 content-immutable tenant-scoped tables. `b0881d47`.
- Phase 3b retention — purge cron (bytes-then-rows; default 90d; dormant). `79590d6b`.
- Phase 4/5 display — `RcdPanel` (CareShell bottom, web) + `RcdMobileSheet` (mobile Layers). `c6ab0275`, `ba98523f`.
- Read routes + tests — list/detail with signed media URLs; ingest/detail/list/retention route tests. `f28e12c4`, `3e1dc23d`, `c754a321`.

**Fixes from the founder's live testing (the test→fix loop):**
- `PGRST205` missing-table detection → honest "apply the migration" message (was a generic 500). `9adebe28`.
- **Discoverability** — the panel was a thin muted bar the founder couldn't find; now loads on mount, auto-reveals when captures exist, prominent count badge, refresh. `65cabaa9`.
- **WhatsApp per-message split** — used the live-confirmed `[data-pre-plain-text]` anchor (was collapsing to 1 message). `34c9c881`.
- Batch media-URL signing (1 round-trip). `f9dde6ac`.

**Adjacent compliance/security (proactive, §1.5.2):**
- Privacy page + download page said "nothing stored" — now honestly distinguish the ephemeral tools from Capture (which stores). `17cf4165`, `dbe64be8`. (A26 sweep — other "ephemeral" claims are unrelated in-app tools, still accurate.)
- Gate repair — 2 pre-existing red gates (theme:audit CareRadialHome, rls:audit care_knowledge_documents) fixed. `cae39e62`.
- **Storage security audit** (§1.7, gate-uncovered surface): all 3 buckets sound — `assets-v1` private+tenant-scoped, `widget-logos` public-read-by-design + tenant-scoped writes, `care-rcd-media` private + tenant-scoped read + signed-URL writes. No leak. Recommendation on record: `rls:audit` doesn't cover `storage.objects` — a defense-in-depth gate extension is possible but A33-declined (imprecise parser worse than the prose flag).

## Honest limitations (on record)
- The **10/11 adapter selectors are RUNTIME-UNVERIFIED** — capture quality per channel needs live testing; refined as the founder tests each.
- **Non-image media bytes** are not captured (canvas is image-only; needs the host-permission decision).
- **Cross-origin images without CORS** taint the canvas → filename-only.
- Everything above is code-complete + gate-green + build-green, but **runtime-unverified** beyond the founder's one successful live capture.

## Session-Reads
§0 §0.1 §1.1 §1.5 §1.5.1 §1.5.2 §1.7 §2 §3.1 §3.4 §5 §6 · AMD-006 (full) · A5 A17 A18 A24 A26 A30 A31 A33 A34 A38 A39 — all read this session (2026-07-26).
