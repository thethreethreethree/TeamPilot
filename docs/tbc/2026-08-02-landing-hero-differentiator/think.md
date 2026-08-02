---
tbc_version: 1
trigger: feature
started_at: 2026-08-02T22:41:37Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 12
hypotheses: 1
---

# THINK — Elostate landing rebuild: hero + differentiator (preview route)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) MATCH DOC_MANIFEST (build.md). Both in the working tree; the
relevant principles were read this session.

## 2. Why (§1.5.1 feature-workflow, founder directive)
The founder asked for a rebuilt elostate.com landing that reflects the evolved product — premium, keynote-grade,
matte-black/signal-yellow, with the filament-e bulb mark and the message hierarchy "we make your team THINK; one
platform replaces four tools; we prove it in your data." Approved after an option-based review: headline "Make
it think", Framer Motion, "Request access" (pilot-honest) CTA. Hero + differentiator are the two founder-flagged
priorities.

## 3. Design + interconnection (§1.5 ripple, §3.3 not-overtaking)
- **Isolation:** landing gets its OWN palette tokens (`brand.ts`) + self-hosted Sora (`sora.ts`), deliberately
  SEPARATE from the app's ember/ink theme — so the marketing look doesn't touch the product's 300+ themed
  surfaces (§1.5 ripple: zero blast radius on the app).
- **Preview route:** everything assembles at `/landing-preview`; live `src/app/page.tsx` (elostate.com) is
  UNTOUCHED until the founder approves (§3.3 — don't swap the live page unilaterally). The route is
  `robots: noindex`.
- **CTAs** point at the existing `/redeem` + `/login` flows (preserved from the current page); no new auth path.

## 4. Robustness pivot (§5 distrust-the-confident-answer, §1.5.2 proactive audit)
Initial plan used Framer Motion for the hero entry. A render check against the live dev server showed the
motion mount-reveal left the hero CONTENT invisible until JS ran — a real failure mode (no-JS / slow hydration /
any motion error → blank hero). Diagnosed from the render, not assumed. Pivoted the entry + scroll reveals to
**CSS + IntersectionObserver** (`Reveal`): content ships VISIBLE, JS only "arms" the hidden-then-reveal when
present, reduced-motion shows everything. Same scroll wow, robust, faster. Framer Motion stays installed for any
richer interaction later. (styled-jsx was also tried and dropped — it didn't apply under Turbopack; CSS Modules
are the reliable path.)

## 5. Hypothesis
- **H1:** `/landing-preview` renders hero + differentiator correctly in the real Next build (typecheck clean,
  dev server 200, both sections visible + on-brand); content is robust (visible without JS via the Reveal
  default-visible pattern); live `page.tsx` is unchanged.

## 6. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-02T22:41:37Z", "source_file": "CLAUDE.md", "line_range": "12-24", "why_it_governs": "Understand the product + message before designing the page; the differentiator must SHOW the diagnostic engine, not just claim it.", "how_this_build_will_embody_it": "The differentiator traces symptom→signals→root-cause, mirroring the real events→signals→problems chain." },
  { "id": "§0.1", "read_at": "2026-08-02T22:41:37Z", "source_file": "CLAUDE.md", "line_range": "20-40", "why_it_governs": "Methodology in the tree, consulted this session.", "how_this_build_will_embody_it": "Doc integrity MATCH; hashes in build.md." },
  { "id": "§1.5", "read_at": "2026-08-02T22:41:37Z", "source_file": "CLAUDE.md", "line_range": "78-96", "why_it_governs": "Holistic ripple — a marketing rebuild must not destabilize the product.", "how_this_build_will_embody_it": "Landing-only tokens + self-hosted font + a preview route; app theme + live page untouched." },
  { "id": "§1.5.1", "read_at": "2026-08-02T22:41:37Z", "source_file": "CLAUDE.md", "line_range": "78-110", "why_it_governs": "Feature-workflow continuity — trace the visitor flow (hero → CTA → redeem).", "how_this_build_will_embody_it": "CTAs wired to the existing /redeem + /login; 'See it work' scrolls to the differentiator." },
  { "id": "§1.5.2", "read_at": "2026-08-02T22:41:37Z", "source_file": "CLAUDE.md", "line_range": "120-140", "why_it_governs": "THINK-then-verify; render-check the build rather than trust it.", "how_this_build_will_embody_it": "Section 4: the render check surfaced the motion-invisibility bug before it shipped." },
  { "id": "§3.3", "read_at": "2026-08-02T22:41:37Z", "source_file": "CLAUDE.md", "line_range": "270-282", "why_it_governs": "Guide, don't overtake — the founder reviews before the live page changes.", "how_this_build_will_embody_it": "Preview route only; engineering calls flagged for review; live page.tsx untouched." },
  { "id": "§5", "read_at": "2026-08-02T22:41:37Z", "source_file": "CLAUDE.md", "line_range": "300-320", "why_it_governs": "Distrust the confident answer — 'Framer Motion just works' was wrong.", "how_this_build_will_embody_it": "Section 4 records the pivot to a robust CSS/IO reveal after the render disproved the assumption." },
  { "id": "§6", "read_at": "2026-08-02T22:41:37Z", "source_file": "CLAUDE.md", "line_range": "352-372", "why_it_governs": "Decision checklist before acting.", "how_this_build_will_embody_it": "Understood, ripple-traced, robustness-verified, why-explained." },
  { "id": "A19", "read_at": "2026-08-02T22:41:37Z", "source_file": "ThinkerThinker.md", "line_range": "57", "why_it_governs": "Methodology must live in the tree.", "how_this_build_will_embody_it": "Confirmed present before citing." },
  { "id": "A22", "read_at": "2026-08-02T22:41:37Z", "source_file": "ThinkerThinker.md", "line_range": "57-58", "why_it_governs": "Citations require session-reading.", "how_this_build_will_embody_it": "This manifest + Session-Reads trailer." },
  { "id": "A30", "read_at": "2026-08-02T22:41:37Z", "source_file": "ThinkerThinker.md", "line_range": "91", "why_it_governs": "Encode the lesson where the future edit meets it.", "how_this_build_will_embody_it": "Reveal + Bulb + Hero comments state the default-visible robustness contract." },
  { "id": "A38", "read_at": "2026-08-02T22:41:37Z", "source_file": "ThinkerThinker.md", "line_range": "95", "why_it_governs": "'Verified' = a command run.", "how_this_build_will_embody_it": "check.md pastes typecheck + the dev-server render evidence." }
]
```
