---
tbc_version: 1
trigger: feat
started_at: 2026-07-30T02:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 13
hypotheses: 3
---

# THINK — C.A.R.E doc upload + a new Jeff customer-assistance guidance field

Founder (2 images, 2026-07-30): add the multi-format upload feature to C.A.R.E, and add a Jeff
"customer-assistance guidance" field — the methodology-equivalent for support. Confirmed via
AskUserQuestion: a NEW dedicated guidance field wired into Jeff's replies + upload on THREE surfaces
(Adaptive Knowledge, the new guidance field, product-context).

## 1. Document integrity (§0.1) — MATCH

CLAUDE.md (e08874…, 429) + ThinkerThinker.md (0428…, 1039) MATCH DOC_MANIFEST.json.

## 2. Why + precedent (§0, A28)

C.A.R.E's Jeff config today (read from the code): Adaptive Knowledge (uploadable .md FACTS, 0193),
`ai_product_context` (WHAT you represent), `ai_tone`. There is NO "HOW to assist" guidance field. The
Sales Coach already has the parallel (methodology + product); the doc-upload extractor + DocUploadButton
were just built. This build REUSES that infra (A28) rather than reinventing: same extractText, a
care-gated extract route, the DocUploadButton made reusable.

## 3. Session-read manifest (A22, A35)

```json
[
  { "id": "§0",     "read_at": "2026-07-30T02:05:00Z", "source_file": "CLAUDE.md", "line_range": "10-20",   "why_it_governs": "Understand first — I read the actual C.A.R.E config surfaces (config.ts, tenant route, prompt.ts, the widget settings page) to learn that no guidance field exists before proposing one.", "how_this_build_will_embody_it": "Section 2 states the gap from the code." },
  { "id": "§0.1",   "read_at": "2026-07-30T02:05:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",   "why_it_governs": "Methodology in the tree, read this session.", "how_this_build_will_embody_it": "Integrity MATCH; this-session read_at." },
  { "id": "§1.5.1", "read_at": "2026-07-30T02:05:00Z", "source_file": "CLAUDE.md", "line_range": "78-90",   "why_it_governs": "Four layers — a guidance field that saves (layer 2) but never reaches Jeff's prompt (layer 3) is dead surface; the seam must be closed.", "how_this_build_will_embody_it": "The field feeds buildCareSystemPrompt via the 2 real callers (widget + email); prompt test locks it." },
  { "id": "§1.5.2", "read_at": "2026-07-30T02:05:00Z", "source_file": "CLAUDE.md", "line_range": "139-160", "why_it_governs": "Think then search — I grounded the scope (does a guidance field exist? which surfaces? caps?) before building, and asked the founder the one genuine fork.", "how_this_build_will_embody_it": "Scope confirmed by AskUserQuestion; per-field caps read from the code (8k product/guidance, 200k knowledge)." },
  { "id": "§6",     "read_at": "2026-07-30T02:05:00Z", "source_file": "CLAUDE.md", "line_range": "352-368", "why_it_governs": "Checklist — trace what a new prompt-feeding field affects: Jeff's replies (customer-facing) + the multi-field config save (A34). Guidance is scoped WITHIN Jeff's honesty rules so it can't override his identity.", "how_this_build_will_embody_it": "The block says 'within your core identity and honesty rules'; the save degrades if the column is missing." },
  { "id": "A19",    "read_at": "2026-07-30T02:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-475", "why_it_governs": "The methodology assets governing this build were read from the working tree this session, not cited from cached labels.", "how_this_build_will_embody_it": "This-session reads recorded across the 13 entries." },
  { "id": "A22",    "read_at": "2026-07-30T02:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-615", "why_it_governs": "Citations without session-reading are undetected violations.", "how_this_build_will_embody_it": "Commit uses Session-Reads Form A." },
  { "id": "A27",    "read_at": "2026-07-30T02:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "720-734", "why_it_governs": "The care extract route is a new upload surface — its extension-allowlist validation must be enforced (not a claimed cap), and it's allowlisted in the invariant with that reason.", "how_this_build_will_embody_it": "Route validates by the 8-extension allowlist + 4MB cap + per-field char cap; invariant-audit allowlist entry added." },
  { "id": "A28",    "read_at": "2026-07-30T02:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "735-760", "why_it_governs": "Precedent decides shape: the Sales-Coach extractor/route/DocUploadButton + the existing care config save (business_type A34 guard) are the templates. This build extends them, not reinvents.", "how_this_build_will_embody_it": "extractText reused (maxChars param); care extract route mirrors the SC one; the config save extends the existing deferred-column guard." },
  { "id": "A31",    "read_at": "2026-07-30T02:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "791-817", "why_it_governs": "Reachability: migration → config mapper → prompt callers → Jeff's reply (read); and upload → extract → editor → save → config (write). Every hop asserted.", "how_this_build_will_embody_it": "build.md asserts both seams; the prompt test proves the read-path reaches the reply." },
  { "id": "A34",    "read_at": "2026-07-30T02:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "870-897", "why_it_governs": "The new column (0202) is unapplied — reads must degrade, writes fail honestly, the predicate names the column.", "how_this_build_will_embody_it": "config select(*) omits it → null; the save's deferred-column guard drops ai_assistance_guidance on a missing-column error + tells the admin migration is pending." },
  { "id": "A30",    "read_at": "2026-07-30T02:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-790", "why_it_governs": "A fix/feature is not complete until the class is gated — the prompt wiring + the route authz are unit-pinned so a regression fails.", "how_this_build_will_embody_it": "careGuidancePrompt test (block present/absent) + care extract route test (401/403/415/200)." },
  { "id": "A38",    "read_at": "2026-07-30T02:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1025", "why_it_governs": "'Verified' is a claim about the canonical command actually run — this build closes only after npm run check passes.", "how_this_build_will_embody_it": "closure.md pastes npm run check output + exit code." }
]
```

## 4. Hypotheses

```json
[
  { "id": "H1", "claim": "The new field is A34-safe: config select(*) omits it pre-0202 → null → no prompt block; the save drops it on a missing-column error so OTHER settings still persist.", "confidence": "high", "test": "read config.ts select(*) + the tenant-route deferred-column guard.", "outcome": "CONFIRMED — select('*') omits absent columns (line-89 comment); the guard drops the ordered deferrable columns + retries; typecheck 0." },
  { "id": "H2", "claim": "Guidance reaches Jeff's actual replies (not dead surface) via the widget + email callers, scoped within his core rules.", "confidence": "high", "test": "wire both callers; prompt unit test that the block appears with the guidance + the 'within your core rules' scoping.", "outcome": "CONFIRMED — careGuidancePrompt test 3/3; both callers pass tenant?.aiAssistanceGuidance." },
  { "id": "H3", "claim": "One extractor + one reusable DocUploadButton serve all THREE C.A.R.E surfaces with per-field caps (guidance/product 8k, knowledge 200k).", "confidence": "high", "test": "care extract route with a maxChars form field; DocUploadButton endpoint+maxChars props; wire all three.", "outcome": "CONFIRMED — route clamps maxChars to 200k; all three surfaces pass their cap; extract route test 4/4." }
]
```

## 5. Four-layer

- **1 structure:** one migration + one config field + one prompt block + one extract route; DocUploadButton
  made reusable; the config-save guard generalized. No new component pattern.
- **2 effectivity:** guidance reaches Jeff's replies (prompt test); uploads extract on all three surfaces
  (route test + typecheck).
- **3 composition:** the guidance editor sits with Knowledge + product-context on the same care settings
  page; upload fills each draft, then the existing save persists. No existing surface broken.
- **4 surface:** a "Customer-assistance guidance" panel + an "Upload a file" control on each surface.

**verdict: SHIPPABLE** (code degrades to no-op until 0202 is applied).
