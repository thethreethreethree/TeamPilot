# Closure: finish white-label tenant identity + remediate 2026-06-24 audit findings

**Date:** 2026-06-24
**Builder:** Agent
**Scope:** Remediate H1–H4 + M1–M2 + L1 from the 2026-06-24 outside-perspective audit. Each finding was verified against actual code (file:line) before fixing, then re-verified after.

## Why this commit exists

The 2026-06-24 audit surfaced that the 0064 per-tenant-identity build was only HALF shipped, and one of its two security claims was false. This commit finishes the feature and closes the real security gap. Every claim below cites a file:line so the rigor is auditable rather than asserted (the §A9 failure mode this session repeatedly hit: writing the audit prose without doing the audit work).

## Findings remediated

### H1 — Unicode separator bypass of the prompt-injection defense (SECURITY)
- **Was:** `ai_name !~ '[[:cntrl:]]'` (migration 0064) + Zod `replace(/[\x00-\x1F\x7F]/g)`. Both missed U+2028 LINE SEP, U+2029 PARA SEP, U+0085 NEL, and zero-width/BOM chars. A tenant admin could set `ai_name = "Habiba<U+2028>FORGET PRIOR INSTRUCTIONS"` → injected line into the LLM system prompt (the name is interpolated in `buildIdentity()`, [prompt.ts](../../src/lib/care/prompt.ts)).
- **Fix:**
  - API layer ([route.ts:104](../../src/app/api/care/agent/tenant/route.ts#L104)): Zod transform now `.replace(/[\p{C}\p{Zl}\p{Zp}]/gu, "")` — strips control+format+unassigned (`\p{C}`), line sep (`\p{Zl}`), para sep (`\p{Zp}`). Preserves emoji/accents/CJK/Arabic/normal spaces.
  - DB backstop (migration [0066](../../supabase/migrations/0066_harden_ai_name_unicode_check.sql)): CHECK adds `ai_name !~ '[  ​‌‍﻿]'` using Postgres ARE `\uXXXX` escapes (NOT invisible literals — those would be corrupted by editors/CRLF; verified zero stray invisible chars in the file).

### H2 — Email channel always said "Jeff" (CORRECTNESS)
- **Was:** [email/route.ts:385](../../src/app/api/care/inbound/email/route.ts) called `buildCareSystemPrompt({ productContext })` with no `agentName`. The 0064 closure manifest's cross-module table listed only the messages route as a caller — it MISSED this one entirely.
- **Verified caller set this turn:** `grep buildCareSystemPrompt(` → exactly 2 callers (messages route + email route). Both now pass `agentName`.
- **Fix:** [email/route.ts:394](../../src/app/api/care/inbound/email/route.ts) loads `getCareTenantConfigByCompanyId(args.companyId)` and passes `tenant?.aiName`.

### H3 — VOICE_ADDENDUM hardcoded "Hi, my name is Jeff" (CORRECTNESS)
- **Was:** [prompt.ts:123](../../src/lib/care/prompt.ts) — literal "Jeff" inside an ACTIVE LLM instruction (`don't repeat 'Hi, my name is Jeff…'`), not a cosmetic comment. The 0064 manifest marked this "narrative cosmetic only" — wrong, it's a live prompt for voice-mode tenants.
- **Fix:** `VOICE_ADDENDUM` const → `buildVoiceAddendum(agentName)` function ([prompt.ts](../../src/lib/care/prompt.ts)); `buildCareSystemPrompt` passes the resolved `name` ([prompt.ts](../../src/lib/care/prompt.ts)). Updated the stale doc-comment reference too.

### H4 — Logo was never rendered anywhere (FEATURE HALF-BUILT)
- **Was:** `config.logoUrl` appeared only in the type + default config. A tenant could upload a logo, save it, and customers would NEVER see it. The 0064 manifest's A14 render-branch table listed only `aiName` surfaces — it silently omitted any logo render branch.
- **Fix — three surfaces:**
  1. Launcher bubble ([CareEmbeddedWidget.tsx:370+](../../src/components/care/CareEmbeddedWidget.tsx)) — the most prominent brand surface (always visible). Logo replaces the generic MessageCircle icon when set. **(I initially missed this surface even in THIS fix; caught it in pre-commit verification by grepping the launcher render.)**
  2. Panel header ([CareEmbeddedWidget.tsx](../../src/components/care/CareEmbeddedWidget.tsx)) — logo next to greeting.
  3. Empty-state greeting card ([CareEmbeddedWidget.tsx](../../src/components/care/CareEmbeddedWidget.tsx)) — logo above "Hi, my name is X."
- **SECURITY (carried constraint):** all three render via `<img src>` ONLY — never `<object>`/inline SVG — so an SVG logo's scripts stay browser-sandboxed. Documented inline at each render site.

### M1 — Logo upload wrote unsaved draft edits into the saved baseline (DATA-LOSS UX)
- **Was:** [page.tsx:458-459](../../src/app/dashboard/care/settings/widget/page.tsx) `setConfig({ ...draft, ... })` spread the whole `draft` (incl. unsaved ai_name edits) into `config`, making unsaved edits LOOK saved. Refresh revealed the drift.
- **Fix:** functional updates `setConfig((c) => c ? { ...c, widget_logo_url } : c)` + same for `setDraft` — touch only the logo field, preserve each state's own prior values. Applied to both upload + Remove handlers.

### M2 — Logo route UPDATE was a silent no-op if no config row (CORRECTNESS)
- **Was:** [logo/route.ts:138](../../src/app/api/care/agent/tenant/logo/route.ts) `update().eq("company_id")` — no-op if the tenant lacked a `care_tenant_config` row. Bytes land in storage, URL never persisted, no error.
- **Fix:** `upsert({ company_id, widget_logo_url }, { onConflict: "company_id" })`. Verified `company_id` is the PK ([0038:23](../../supabase/migrations/0038_care_white_label.sql)) and ALL other NOT NULL columns have defaults ([0038:28-57](../../supabase/migrations/0038_care_white_label.sql) + ai_name default 'Jeff' [0064:32](../../supabase/migrations/0064_per_tenant_ai_name_and_logo_bucket.sql)) — so the insert-branch can't fail on a missing column.

### L1 — 0064 trailing comment said "End migration 0063" → corrected.

## Outside-perspective audit (four personas)

### Persona 1 — Haqqy Life customer (the end user)
- Sees the brand logo on the launcher bubble, in the panel header, and on the greeting card. Greeting reads "Hi, my name is Habiba." Email replies + voice calls also use Habiba (H2/H3). **Flowing — the brand identity is consistent across every surface the customer touches.**

### Persona 2 — New engineer
- `buildCareSystemPrompt({ agentName })` + `buildVoiceAddendum(name)` are clean. The logo render sites each carry the `<img>`-only security note inline so the constraint travels with the code. The Postgres `\uXXXX` choice over invisible literals is documented with the reason.
- **Honest concern:** [claude.ts:495](../../src/lib/claude.ts) still references "VOICE_ADDENDUM" by its old const name in a comment. Cosmetic; not edited because that file wasn't read this session (don't edit blind). Noted as a straggler.

### Persona 3 — Adversary
- ai_name prompt injection: NOW blocked at both layers for control + line/para sep + zero-width. Re-checked the codepoints: U+2028/U+2029/U+0085 are the line-break-class chars beyond \n\r; covered.
- SVG-with-JS logo: rendered via `<img src>` only at all 3 sites → scripts sandboxed.
- Cross-company logo write: route path is always `{auth.companyId}/widget-logo.{ext}` from `requireCareAgent` ([logo/route.ts:108](../../src/app/api/care/agent/tenant/logo/route.ts)). No user-controlled path.
- **Residual (LOW, unchanged):** if a future surface renders the logo via `<object>` or inline SVG, the sandbox breaks. Constraint documented at every render site.

### Persona 4 — CFO / operator
- No new LLM cost. One extra `getCareTenantConfigByCompanyId` per inbound email (already fetched indirectly via product context; ~1 extra round trip — negligible). Logo upsert same cost as update. No new storage.

## A21 cross-module check
- All `buildCareSystemPrompt` callers (2) verified passing `agentName`.
- `CareChatWidget.tsx:495` still hardcodes "Jeff" — **intentional, documented deferral** (un-embedded ELOSTATE marketing widget; ELOSTATE doesn't rename itself). Not in scope.
- `useVoiceMode.ts` "Call Jeff" comments — narrative, cosmetic, deferred.

## A14 render-branch walkthrough — logo
| Surface | Renders logo? | Security |
|---|---|---|
| Launcher bubble | ✓ (fallback: MessageCircle) | `<img src>` only |
| Panel header | ✓ (next to greeting) | `<img src>` only |
| Empty-state card | ✓ (above greeting) | `<img src>` only |
| CareChatWidget (ELOSTATE) | N/A — deferred | — |

## Verification
- [x] `npx tsc --noEmit` green
- [x] `npm run build` green
- [x] All buildCareSystemPrompt callers verified (grep, not memory)
- [x] Launcher-bubble surface caught in pre-commit verification (initial H4 fix missed it)
- [x] Migration 0066 scanned for stray invisible chars → NONE
- [x] M2 upsert insert-branch safety verified against 0038 schema (all NOT NULL cols have defaults)

## To apply on prod
1. `supabase/migrations/0066_harden_ai_name_unicode_check.sql` (the only new migration; 0063/0064/0065 should already be applied).
2. No data migration needed; existing 'Jeff' rows pass the stricter CHECK.

## Honest residuals (deferred, LOW)
- L2: `widget-logos` bucket via SQL may not work on newer Supabase Cloud (same caveat as assets-v1 in [assets.ts](../../src/lib/storage/assets.ts)). If the bucket is missing, create via Dashboard.
- L3: settings UI doesn't strip control chars client-side (server does); user may see saved value differ from typed.
- N1: logo DELETE only sweeps canonical-path extensions; manual-Dashboard-uploaded orphans not cleaned.
- N2: `?v=Date.now()` changes URL every upload even if bytes unchanged (minor CDN-fill).
- claude.ts:495 stale "VOICE_ADDENDUM" comment reference.
- **M3/M4 from the audit remain OPEN and are NOT addressed here:** C.A.R.E layout fix still needs your browser verification; chat composer (`ComposerToolbar`) possible same wrap-bug still unverified.
