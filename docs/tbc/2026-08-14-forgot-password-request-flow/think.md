---
tbc_version: 1
trigger: feature
started_at: 2026-08-14T05:00:30Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 13
hypotheses: 1
---

# THINK — password-recovery REQUEST flow ("Forgot password?")

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes verified this session. The cited
amendments (A19/A22/A26/A30/A38) were RE-READ in ThinkerThinker.md this session (not cited from cached labels,
per A22) — see the manifest read_at timestamps.

## 2. Why (record-check §1.2 — half-built flow, confirmed by reading the code)
Founder report: there is no "Forgot Password" option. Reading the auth surface confirms the flow is HALF built:
- `src/app/auth/recover/page.tsx` — the recovery COMPLETION page — EXISTS and is solid: it reads the token
  from the URL fragment, `setSession`, and lets the user set a new password via `supabase.auth.updateUser`.
- Neither `src/app/login/page.tsx` nor `src/app/sales-coach/login/page.tsx` has any way to REQUEST a recovery
  email. `grep -rn resetPasswordForEmail src` returns ZERO hits. Both login pages' own hint copy even tells the
  user to "use the recovery link" / "reset it from the main ELOSTATE sign-in" — a link that does not exist.

So a user who forgets their password is stranded: the room (`/auth/recover`) is built, but there is no door to
it. This is the exact §1.5.1 layer-3 failure — a feature (recovery) that is internally correct but breaks
workflow continuity because the entry point is missing. It is also why sanpedrodf@gmail.com had to be reset
manually (a live recovery email was sent this session as the immediate remediation).

## 3. The fix (four-layer §1.5.1, foundation up)
- **Layer 1 (structure):** a single source of truth for the completion route + the redirect it builds, in
  `src/lib/auth/passwordRecovery.ts` (`RECOVER_PATH`, `recoverRedirectUrl`, `looksLikeEmail`,
  `RECOVERY_REQUESTED_MESSAGE`). Pure + tested. The request page and any future caller build the SAME redirect,
  so they cannot drift onto different routes.
- **Layer 2 (effectivity):** a new client page `src/app/auth/forgot/page.tsx` calls
  `supabase.auth.resetPasswordForEmail(email, { redirectTo: recoverRedirectUrl(window.location.origin) })`. The
  end-to-end path (request → email → /auth/recover → set password → signed in) now closes; the completion half
  already works and was exercised live this session.
- **Layer 3 (composition/continuity):** both login pages get a "Forgot password?" link → `/auth/forgot`; the
  forgot page has a "← Back to sign in" link. No dead end in either direction.
- **Layer 4 (surface):** the forgot page mirrors `/auth/recover`'s look (glass-card, ember accent, PasswordInput
  family, LearningHint teaching blocks) so it reads as the same product.

## 4. Interconnections traced (§1.5)
- The redirect target `/auth/recover` is an EXISTING page — the new flow depends on it. A structural test asserts
  `src/app/auth/recover/page.tsx` exists on disk, so deleting/renaming it fails the build instead of silently
  breaking recovery (A30 gate-the-lesson; the drift-guard vein).
- Anti-enumeration (§3.4 honesty): the confirmation must NOT reveal whether an account exists — Supabase's
  `resetPasswordForEmail` already returns success regardless of existence; the on-page message is neutral
  ("If an account exists…"). The page shows an error ONLY for a real transport failure (rate-limit/network).
- `supabaseEnabled` gate: in demo mode there is no auth, so the page states that instead of pretending to send.
- No schema, no server route, no migration — this is a client surface + a pure helper. Nothing cross-tenant.

## 5. Hypothesis (§1.5.2)
- **H1 — before this change, is there genuinely no request-side entry (so the completion page is unreachable
  from the product)?** Confirmed: `grep -rn "resetPasswordForEmail" src` → 0 hits before this build; both login
  pages route the user to a recovery link that is not rendered anywhere. After: the helper + page + two links
  make `resetPasswordForEmail` reachable, and `passwordRecovery.test.ts` locks the redirect + the recover-page
  existence.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-14T05:01:00Z", "source_file": "CLAUDE.md", "line_range": "1-40", "why_it_governs": "Understand the problem from the record before building — read the actual auth pages, not the founder's one-line framing.", "how_this_build_will_embody_it": "Read /auth/recover, both login pages, ChangePasswordPanel + grepped resetPasswordForEmail (0 hits) before writing anything; the gap is the missing REQUEST side." },
  { "id": "§0.1", "read_at": "2026-08-14T05:01:20Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition; the governing docs must be present + read this session.", "how_this_build_will_embody_it": "Doc hashes verified (Section 1); the cited amendments re-read in-session." },
  { "id": "§1.2", "read_at": "2026-08-14T05:01:40Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Retrospective identification — read the actual record (the auth pages + a resetPasswordForEmail grep) to confirm the flow is half-built rather than trusting the one-line report.", "how_this_build_will_embody_it": "Section 2 diagnoses from the code: completion page present, request side absent (grep → 0 hits), login copy pointing at a non-existent link." },
  { "id": "§1.5", "read_at": "2026-08-14T05:02:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — trace what the new flow depends on (the existing /auth/recover page) and what it must not break (enumeration, demo mode).", "how_this_build_will_embody_it": "Section 4 traces the recover-page dependency (guarded by a disk-existence test), anti-enumeration, and the demo-mode gate." },
  { "id": "§1.5.1", "read_at": "2026-08-14T05:03:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "The four-layer feature gate — this is a user-facing feature; the failure was a layer-3 continuity gap (a room with no door).", "how_this_build_will_embody_it": "Section 3 builds foundation-up: helper (L1) → forgot page (L2) → links both ways (L3) → mirrored surface (L4)." },
  { "id": "§1.5.2", "read_at": "2026-08-14T05:04:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-search: hypothesize the request side is genuinely absent, then confirm by grep rather than assuming.", "how_this_build_will_embody_it": "H1 stated + confirmed (grep resetPasswordForEmail → 0 hits before; the test locks reachability after)." },
  { "id": "§3.4", "read_at": "2026-08-14T05:05:00Z", "source_file": "CLAUDE.md", "line_range": "244-260", "why_it_governs": "Honesty — a reset confirmation must not leak whether an account exists (enumeration is a dishonest signal to an attacker), and demo mode must not pretend to send.", "how_this_build_will_embody_it": "Neutral RECOVERY_REQUESTED_MESSAGE (test-locked); errors only on real transport failure; supabaseEnabled gate states demo mode honestly." },
  { "id": "§6", "read_at": "2026-08-14T05:06:00Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Pre-action checklist — trace ripple (the recover-page dependency, both login pages, demo mode).", "how_this_build_will_embody_it": "Both login pages updated; the recover dependency guarded; demo mode handled." },
  { "id": "A19", "read_at": "2026-08-14T05:07:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-475", "why_it_governs": "Consult the in-tree methodology + the actual code before acting, not cached labels.", "how_this_build_will_embody_it": "Read the real auth pages this session; the design mirrors the existing /auth/recover implementation." },
  { "id": "A22", "read_at": "2026-08-14T05:08:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-605", "why_it_governs": "Citations require in-session reading of the cited asset.", "how_this_build_will_embody_it": "A19/A22/A26/A30/A38 were opened + read in ThinkerThinker.md this session before citing them; read_at timestamps reflect that." },
  { "id": "A26", "read_at": "2026-08-14T05:09:00Z", "source_file": "ThinkerThinker.md", "line_range": "689-694", "why_it_governs": "A reported gap is one instance of a class — sweep it, don't patch a single spot.", "how_this_build_will_embody_it": "Added the request entry to BOTH login surfaces (main + sales-coach), not just the one the founder happened to name." },
  { "id": "A30", "read_at": "2026-08-14T05:10:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Encode the lesson in a gate that fails without cooperation — a recovery flow whose completion page vanished would silently break.", "how_this_build_will_embody_it": "passwordRecovery.test.ts asserts /auth/recover/page.tsx exists on disk + locks the redirect construction; renaming the page reddens the build." },
  { "id": "A38", "read_at": "2026-08-14T05:11:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1006", "why_it_governs": "'Verified' means the canonical command + its output/exit code, not a self-chosen subset.", "how_this_build_will_embody_it": "closure.md pastes `npm run check` output + exit 0." }
]
```
