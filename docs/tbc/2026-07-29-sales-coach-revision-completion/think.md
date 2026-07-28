---
tbc_version: 1
trigger: fix
started_at: 2026-07-29T03:20:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 11
hypotheses: 2
---

# THINK — sales-coach revision completion (declutter + user post-session routing)

Founder-reported "this isn't fixed" (marked-up screenshots, 2026-07-29). Two parts of an
earlier revision were never fully landed. This build completes them.

## 1. Document integrity (§0.1)

Hashes MATCH DOC_MANIFEST.json. Proceed.

## 2. Session-read manifest (A22)

```json
[
  { "id": "§0",     "read_at": "2026-07-29T03:25:00Z", "source_file": "CLAUDE.md", "line_range": "10-20",   "why_it_governs": "Diagnose before patching — the founder asked WHY it wasn't implemented; the root cause (prior revision's scope + an end-only redirect) was read from the code + git before touching anything.", "how_this_build_will_embody_it": "The reason is stated from the record (ce727c36 scope; line-189 end-only redirect) before the fix." },
  { "id": "§0.1",   "read_at": "2026-07-29T03:25:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",   "why_it_governs": "Methodology read this session.", "how_this_build_will_embody_it": "read_at is this session." },
  { "id": "§1.5.1", "read_at": "2026-07-29T03:25:00Z", "source_file": "CLAUDE.md", "line_range": "78-90",   "why_it_governs": "Four layers — layer 3 (workflow continuity) is the routing fix: a rep on an ended session must land where they can act (after-pitch), not the dense manager view.", "how_this_build_will_embody_it": "Section 5 walks the layers; the redirect is a layer-3 fix." },
  { "id": "§1.5.2", "read_at": "2026-07-29T03:25:00Z", "source_file": "CLAUDE.md", "line_range": "139-160", "why_it_governs": "THINK then search — the reason was hypothesised (partial prior implementation) then confirmed by reading the panel + the session page.", "how_this_build_will_embody_it": "Hypotheses carry their confirmed outcomes." },
  { "id": "§6",     "read_at": "2026-07-29T03:25:00Z", "source_file": "CLAUDE.md", "line_range": "352-368", "why_it_governs": "Checklist — scope: remove ONLY the four struck items, not the other helper text; don't overtake the founder's markup.", "how_this_build_will_embody_it": "Exactly the four struck strings removed; the other muted lines left as-is." },
  { "id": "A19",    "read_at": "2026-07-29T03:25:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-475", "why_it_governs": "Methodology in the working tree.", "how_this_build_will_embody_it": "This-session reads recorded." },
  { "id": "A22",    "read_at": "2026-07-29T03:25:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-615", "why_it_governs": "Citations without session-reading are undetected violations.", "how_this_build_will_embody_it": "Every cited id resolves to a this-session entry." },
  { "id": "A26",    "read_at": "2026-07-29T03:25:00Z", "source_file": "ThinkerThinker.md", "line_range": "689-715", "why_it_governs": "The founder invoked THIS asset: the miss is one instance of a recurring class (revision reported done while partial). The build sweeps the immediate class + a permanent fix follows separately.", "how_this_build_will_embody_it": "check.md sweeps for other un-decluttered helper text + other Standard-sees-dense gaps; the recurring class gets its own permanent-solution build." },
  { "id": "A28",    "read_at": "2026-07-29T03:25:00Z", "source_file": "ThinkerThinker.md", "line_range": "735-760", "why_it_governs": "A precedent already decides the routing: the end-action already used isStandard→after-pitch. The fix EXTENDS that precedent to any ended-session view, not a new mechanism.", "how_this_build_will_embody_it": "The redirect reuses isStandard + status!==active; the redundant end-only push is folded into it (one source of truth)." },
  { "id": "A30",    "read_at": "2026-07-29T03:25:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-790", "why_it_governs": "A lesson in prose returns — the recurring miss demands a GATE/mechanism, not a promise. This build fixes the instance; the permanent structural fix is the follow-on.", "how_this_build_will_embody_it": "The recurring class is escalated to its own permanent-solution build (durable unfinished-work ledger + revision checklist)." },
  { "id": "A38",    "read_at": "2026-07-29T03:25:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1025", "why_it_governs": "'Verified' is a command — closes after npm run check.", "how_this_build_will_embody_it": "closure.md pastes the canonical command output." }
]
```

## 3. Hypotheses

```json
[
  { "id": "H1", "claim": "The four struck helper strings are still in LiveCoachingPanel because the earlier revision (ce727c36) didn't scope their removal.", "confidence": "high", "test": "grep the strings + read ce727c36's message.", "outcome": "CONFIRMED — strings present; ce727c36 was rename + reorder + auto-coach, no declutter. Now removed." },
  { "id": "H2", "claim": "The user post-session lands on the manager view because the after-pitch redirect fires ONLY on the End action, not on viewing/reloading an ended session.", "confidence": "high", "test": "Read the endSession redirect + the session-page render.", "outcome": "CONFIRMED — line 189 pushed only on End; the page renders summary/timeline for any view. Fixed with a load-time redirect for isStandard + status!==active." }
]
```

## 4. Spec fidelity

- **Restated:** (1) remove the four struck helper texts on the live-coaching screen, keeping "Tap Start live coaching before you begin"; (2) a Standard rep on an ended session lands on the After-Pitch Summary, not the manager summary/timeline.
- **As written, bounded.** Only the four struck strings removed (not the other helper lines — that would overtake). The redirect reuses the existing isStandard precedent.
- **Precedent (A28):** the end-action isStandard→after-pitch redirect; extended, not reinvented.

## 5. Four-layer pre-walk (§1.5.1)

- **1 structure:** declutter = text removals; routing = one load-time redirect useEffect that subsumes the end-only push (one source of truth).
- **2 effectivity:** the live screen shows only the kept line; a Standard rep opening/reloading an ended session is replaced to after-pitch. typecheck exit 0.
- **3 composition:** the rep's post-session moment lands on the actionable after-pitch (Start Next Door), not the dense manager page — the exact continuity the founder wants. Managers (Expert) still get the full page.
- **4 surface:** decluttered, less noisy live screen.

**verdict: SHIPPABLE.**
