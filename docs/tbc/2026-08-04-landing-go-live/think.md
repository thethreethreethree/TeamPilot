---
tbc_version: 1
trigger: feature
started_at: 2026-08-04T00:39:30Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 12
hypotheses: 1
---

# THINK — Elostate landing go-live (homepage swap + a11y/mobile polish)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) MATCH DOC_MANIFEST (build.md). Both in the working tree.

## 2. Why (founder directive 2026-08-04)
The founder approved the new landing and directed: finish the polish, then make it live — with the rule that
**each account lands on its designated module/subscription**; only logged-out visitors see the marketing page.

## 3. The routing decision (§1.5 ripple, §1.5.1 continuity, A21 one-concept-one-encoding)
The old homepage was a client page shown to EVERYONE — the middleware matcher never included `/`, so a signed-in
account also saw marketing. New `/` is a SERVER component:
- signed-in → `redirect(resolveUserLanding(...))` — the CANONICAL helper already used by login + redeem, keyed on
  the same `companies.access_module` signal the middleware confines on (A21: the landing and the confinement
  can't drift). care → /dashboard/care, sales_coach → /dashboard/sales-coach, complete/legacy → /dashboard.
- signed-out → `<LandingPage/>` (the 9-section marketing arc).
Loop-safety (§1.5): `/` → module home; those layouts admit the authed user; no branch redirects back to `/`. A
not-onboarded user resolves to /dashboard → the dashboard layout sends them to /onboarding (existing behaviour).

## 4. Polish (§3.4 accessible, mobile)
Accessibility (founder requirement): added `:focus-visible` rings to every interactive element (nav, CTAs,
footer links) and raised low-contrast muted text to WCAG-AA; decorative module icons `aria-hidden`. Mobile:
`overflow-x: hidden` on every section + `overflow-wrap: break-word` on every heading + mobile heading clamps —
so the body can never scroll sideways regardless of viewport. Entry/scroll animation already robust (CSS,
content ships visible). Extracted the composition to `LandingPage` so `/` and the preview route share one source.

## 5. Hypothesis
- **H1:** `/` serves the new landing to logged-out visitors (SSR content present) and redirects a signed-in
  account to its module home; typecheck clean; no horizontal scroll; live `page.tsx` swap deploys cleanly.

## 6. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-04T00:39:30Z", "source_file": "CLAUDE.md", "line_range": "12-24", "why_it_governs": "Understand the current `/` routing before replacing it — the middleware doesn't match `/`.", "how_this_build_will_embody_it": "Section 3 states the actual current behaviour and the new server-redirect." },
  { "id": "§0.1", "read_at": "2026-08-04T00:39:30Z", "source_file": "CLAUDE.md", "line_range": "20-40", "why_it_governs": "The precondition gate requires the methodology docs be present in the working tree and consulted this session before a substantive build — a live-homepage swap qualifies.", "how_this_build_will_embody_it": "Doc integrity MATCH (hashes in build.md); the constitution was read this session, not cited from cache." },
  { "id": "§1.5", "read_at": "2026-08-04T00:39:30Z", "source_file": "CLAUDE.md", "line_range": "78-96", "why_it_governs": "Holistic ripple — a homepage auth-redirect can loop or lock users out.", "how_this_build_will_embody_it": "Section 3 traces loop-safety + reuses the canonical resolveUserLanding." },
  { "id": "§1.5.1", "read_at": "2026-08-04T00:39:30Z", "source_file": "CLAUDE.md", "line_range": "78-110", "why_it_governs": "Workflow continuity — a signed-in user must land where they work, not on marketing.", "how_this_build_will_embody_it": "Signed-in → module home; signed-out → landing → Request-access CTA." },
  { "id": "§1.5.2", "read_at": "2026-08-04T00:39:30Z", "source_file": "CLAUDE.md", "line_range": "120-140", "why_it_governs": "Verify the routing claim rather than assume.", "how_this_build_will_embody_it": "check.md confirms `/` SSR-serves the landing + the redirect path." },
  { "id": "§3.3", "read_at": "2026-08-04T00:39:30Z", "source_file": "CLAUDE.md", "line_range": "270-282", "why_it_governs": "Founder approved the swap explicitly — execute it, preserving module landing.", "how_this_build_will_embody_it": "The module-landing requirement is the core of the routing." },
  { "id": "§3.4", "read_at": "2026-08-04T00:39:30Z", "source_file": "CLAUDE.md", "line_range": "292-306", "why_it_governs": "Accessible + honest — the founder required a11y; proof stays placeholder-honest.", "how_this_build_will_embody_it": "Focus rings, AA contrast, aria-hidden icons, no-horizontal-scroll." },
  { "id": "§6", "read_at": "2026-08-04T00:39:30Z", "source_file": "CLAUDE.md", "line_range": "352-372", "why_it_governs": "Decision checklist for a live-homepage change.", "how_this_build_will_embody_it": "Routing ripple-traced, canonical helper reused, verified before deploy." },
  { "id": "A19", "read_at": "2026-08-04T00:39:30Z", "source_file": "ThinkerThinker.md", "line_range": "57", "why_it_governs": "Methodology must live in the tree.", "how_this_build_will_embody_it": "Confirmed present." },
  { "id": "A22", "read_at": "2026-08-04T00:39:30Z", "source_file": "ThinkerThinker.md", "line_range": "57-58", "why_it_governs": "Citations require session-reading.", "how_this_build_will_embody_it": "This manifest + Session-Reads trailer." },
  { "id": "A30", "read_at": "2026-08-04T00:39:30Z", "source_file": "ThinkerThinker.md", "line_range": "91", "why_it_governs": "Encode the lesson where the future edit meets it.", "how_this_build_will_embody_it": "page.tsx doc-comment states why signed-in redirects + which signal governs." },
  { "id": "A38", "read_at": "2026-08-04T00:39:30Z", "source_file": "ThinkerThinker.md", "line_range": "95", "why_it_governs": "'Verified' = a command run.", "how_this_build_will_embody_it": "check.md pastes typecheck + `/` SSR-content + the post-deploy live check." }
]
```
