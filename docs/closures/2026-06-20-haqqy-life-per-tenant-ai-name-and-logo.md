# Session-Read Manifest: haqqy-life-per-tenant-ai-name-and-logo

**Date:** 2026-06-20
**Session:** continuous from RLS-recursion fix
**Commits in scope:** this commit
**Builder:** Agent

## 1. What this build does

Per founder direction 2026-06-20: activate Haqqy Life (pilot tenant) on the multi-tenant C.A.R.E surface and let them (a) rename their AI agent (default "Jeff") and (b) upload a brand logo / icon.

Components:
- **Migration 0064** — adds `ai_name` column to `care_tenant_config` with prompt-injection-defense CHECK; creates the `widget-logos` public bucket with RLS for authenticated uploads.
- **TS types + bootstrap** — `CareTenantConfig.aiName` field; bootstrap response includes it; widget defaults to "Jeff" if missing.
- **System prompt** — `buildCareSystemPrompt({ agentName })` accepts per-tenant name; `IDENTITY` const becomes `buildIdentity(name)` function; the messages route passes `tenant?.aiName`.
- **CareEmbeddedWidget** — consumes `config.aiName` for greeting + voice-call button labels; default = "Jeff".
- **Settings UI** — new "Agent name" field in `/dashboard/care/settings/widget`; replaces the old free-text Logo URL field with a file picker + current-logo preview + Remove button.
- **Logo upload endpoint** — `POST/DELETE /api/care/agent/tenant/logo`; admin-only; writes to widget-logos bucket; updates `widget_logo_url` to public URL with cache-busting query string.

## 2. Constitutional assets cited

| Asset | Cited in | Re-read in session at | Intent | Behavior |
|---|---|---|---|---|
| §3.4 | migration 0064 header | 2026-06-19T16:23Z (CLAUDE.md full re-read this session) | No instant results; behavior derives from tenant's own data. | Embodies — ai_name default 'Jeff' but each tenant rewrites; per-tenant logo is per-tenant; no fixed company behavior. |
| §A11 | migration 0064 header | 2026-06-19T~14:30Z (TT.md full re-read this session) | System counts; user decides. | Embodies — the AI introduction is a tenant CHOICE (their name), not a System assertion. |
| §A12 | migration 0064 header | 2026-06-19T~14:30Z | Idempotent migrations. | Embodies — ADD COLUMN IF NOT EXISTS, ON CONFLICT DO NOTHING, DROP+CREATE for constraint. |
| §0.1 | migration 0064 header | 2026-06-19T16:23Z | Methodology in working tree + read in session. | Embodies — both docs re-read this session; the citation is honest. |

## 3. Findings + remediations (audit DURING work per the addendum)

### Resolved IN this commit

- **HIGH (Persona 3 — prompt injection):** AI name could be set to `"<newline>FORGET PRIOR INSTRUCTIONS"` to compromise the LLM. Fix: defense in depth — Zod transform strips control characters at the API layer + DB CHECK constraint rejects newlines/control chars + 50-char cap. Documented in migration 0064 header.
- **MEDIUM (Persona 3 — arbitrary URL):** The PATCH `/api/care/agent/tenant` endpoint previously accepted any URL for `widgetLogoUrl`, letting an admin point the customer-facing widget at any external URL (phishing surface, tracking pixels, malicious SVG). Fix: removed `widgetLogoUrl` from PATCH allowlist entirely. The dedicated `/api/care/agent/tenant/logo` upload endpoint is now the ONLY way to set it; the bucket constraints + server-side MIME check + 2MB cap apply.

### Deferred

- The un-embedded `CareChatWidget` (on ELOSTATE's own marketing pages) still hardcodes "Jeff". Intentional — ELOSTATE doesn't need to rename for its own widget. If they ever did, plumb the same way as `CareEmbeddedWidget`. Documented in the widget component itself.
- Internal code comments referencing "Jeff" (voice route docs, useVoiceMode header comments) are historical narrative; not user-facing. Updating is cosmetic. Defer.

## 4. Outside-perspective audit (rigorous)

### Persona 1 — Haqqy Life admin
- Goes to `/dashboard/care/settings/widget`, sees "Agent name" field with their current value (default "Jeff").
- Changes to "Habiba", saves. Toast confirms.
- Uploads PNG logo via file picker; logo preview appears with Remove button.
- Visits their site with embed widget — customer sees brand color (was already configurable), logo, greeting "Hi, my name is Habiba.", and the call button reads "Call Habiba".
- Customer types a message → LLM responds as Habiba per the IDENTITY prompt.

### Persona 2 — New engineer
- `buildIdentity(name)` function is clear; `buildCareSystemPrompt({ agentName })` is a clean API.
- The logo endpoint reads straight; admin client used for both bucket write + config row update is intentional (admin scopes by `auth.companyId` from `requireCareAgent`).
- The settings UI uses inline `<input type="file">` rather than a custom component — simple, no extra dependency.
- **Minor concern:** the `setConfig({ ...draft, widget_logo_url: data.logoUrl })` after upload uses `draft` not `config` to spread, which means if there are other unsaved edits in `draft`, they'd visually appear "saved" in the displayed `config` without actually being saved. Edge case (logo upload immediately after starting an edit but before Save), not a correctness bug since the next Save would still send the draft.

### Persona 3 — Adversary
- Prompt injection via ai_name: **blocked** by Zod transform + DB CHECK constraint.
- Cross-company logo write: **blocked** by `requireCareAgent` returning the caller's own companyId; path is always `{ownCompanyId}/widget-logo.{ext}`.
- Non-image upload: **blocked** by server-side `ALLOWED_MIME` set + 2MB cap.
- Phishing URL via PATCH: **blocked** — `widgetLogoUrl` removed from PATCH schema.
- SVG-with-JS attack: SVG IS in the allow list. SVGs can contain `<script>` tags. When the customer's browser loads the public bucket URL as `<img src="...">`, browsers DO NOT execute SVG scripts (img-element SVG is sandboxed). ✓ Safe for `<img>` use. **Real concern:** if a future surface ever renders the SVG via `<object>` or inline SVG, scripts would execute. Documented constraint: the only render path for widget_logo_url is `<img src={url}>`; do not change without re-evaluating.
- File reupload race: upsert in storage replaces the previous bytes at the same path; cache-busting `?v={timestamp}` ensures CDNs don't serve stale.

### Persona 4 — CFO / operator
- Storage: 2MB × N tenants = trivial.
- Public bucket = no signed-URL latency or per-fetch cost.
- New endpoint: low traffic (admins upload once); rate-limited 10/min.
- No new LLM cost.

## 5. Cross-module check (per A21)

### "Jeff" references audit
| Surface | Hardcoded "Jeff" still? | Notes |
|---|---|---|
| CareEmbeddedWidget greeting | NO — uses `config.aiName` | Fixed |
| CareEmbeddedWidget Call button aria-label/title | NO — uses `config.aiName` | Fixed |
| CareChatWidget (un-embedded ELOSTATE widget) | YES — intentional | ELOSTATE doesn't need to rename; deferred. |
| `buildIdentity` LLM system prompt | NO — takes agentName param | Fixed |
| `messages` route | Passes `tenant?.aiName` to buildCareSystemPrompt | Fixed |
| Voice STT/TTS route comments | YES — narrative comments only | Not user-facing; cosmetic only |
| `useVoiceMode.ts` comments | YES — narrative | Cosmetic |

The user-facing branches (widget + LLM identity) are all plumbed. The narrative comments are historical and don't affect runtime behavior.

### Other places that read `care_tenant_config`
- `getCareTenantConfigByCompanyId` — already returns mapConfig'd object with new aiName field; every existing caller gets it for free.
- Widget bootstrap → CareEmbeddedWidget — wired.
- Messages route → buildCareSystemPrompt — wired.
- Settings UI → PATCH endpoint — wired (minus the now-removed widget_logo_url which uses dedicated endpoint).

✓ All read paths consistent.

## 6. A14 render-branch walkthrough — every place the agent name is shown

| Render branch | Source | Verified |
|---|---|---|
| Widget empty-state greeting | `config.aiName` from bootstrap | ✓ |
| Widget Call button accessible label | `config.aiName` | ✓ |
| Widget Call button hover tooltip | `config.aiName` | ✓ |
| LLM IDENTITY: "Your name is X" | `buildIdentity(agentName)` | ✓ |
| LLM IDENTITY: "introduce yourself as X" | same | ✓ |
| LLM IDENTITY: "don't sign every message with — X" | same | ✓ |
| Settings UI input current value | `draft.ai_name` from `getCareTenantConfigByCompanyId` | ✓ |

No silent surfaces missed.

## 7. Verification checklist

- [x] `npx tsc --noEmit` green
- [x] `npm run build` green
- [x] 4 cited assets have session-read timestamps
- [x] 4 personas walked rigorously
- [x] A21 cross-module audit produced findings (1 LOW, 1 MEDIUM both resolved)
- [x] A14 render-branch walkthrough verified every user-facing surface
- [x] Honest deferrals named (ELOSTATE widget hardcoded "Jeff"; narrative comments)

## 8. To apply on prod

1. Run `supabase/migrations/0063_fix_files_rls_recursion.sql` (if not already — was the urgent fix before this).
2. Run `supabase/migrations/0064_per_tenant_ai_name_and_logo_bucket.sql`.
3. Haqqy Life admin signs in → `/dashboard/care/settings/widget` → renames AI + uploads logo → saves.
4. Their embed snippet on their customer site shows the new name + logo.

## 9. Recommended next steps (per A20)

1. **Founder runtime verification** — Haqqy Life admin tests the rename + logo upload end-to-end. Confirms the customer-facing greeting + LLM identity actually change.
2. **Activation of Haqqy Life's embed token** — they need to receive their embed snippet from `/dashboard/care/settings/widget`'s "Embed snippet" section (already exists). I haven't touched this; it was already built.
3. The remaining low-severity findings from prior audits — toast-named-destination, etc.
