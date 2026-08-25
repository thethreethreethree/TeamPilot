---
started_at: 2026-08-25T13:50:00+08:00
---

# THINK — complete the Coach v5.0 Knowledge Base to 10/10 books (D6)

## The task (founder-approved this session)
The Coach KB (`docs/COACH_KNOWLEDGE_BASE.md`, embedded WHOLE in every Coach call by `knowledgeBase.ts`) was at
**7 of 10 books** — Carnegie, Gladwell, Stone/Patton/Heen were unverified placeholders. The founder opted into the
deep-research workflow to complete them. §5 governs why this matters: the Coach must reason from **source-checked**
principles, not fabricated-but-fluent ones (knowledge-imitating-intelligence) — so the 3 books had to be compiled
from LEGITIMATE primary/author sources with adversarial source-checking, not the model's training memory.

## What was produced (source-checked, not assumed)
The deep-research workflow (103 agents, 0 errors, ~5.2M tokens, 25 claims 3-vote source-checked, **0 refuted**) returned
15 named operational principles: 6 Carnegie moves, 4 Gladwell diagnostic CAUTIONS (framed correctly — his book is
diagnostic, so his principles are cautions ON the confident reads the other books' techniques produce, not a 4th
tactic set), 5 Difficult-Conversations moves, + a cross-book convergence note. Sources: dalecarnegie.com +
Carnegie's public-domain text; Hachette/Little-Brown + a Gladwell interview + Levine's Truth-Default Theory; Harvard
PON + co-author Sheila Heen. Attribution caveats honored (the "transparency illusion" is a faithful gloss not
Gladwell's literal phrase; cite dalecarnegie.com not a blog) — folded into the do-not-cite notes.

## The integration (§1.5.1 layer 2 — the KB actually works end-to-end)
Inserted the 3 source-checked sections as books 8/9/10, renumbered Convergences→11 / How-to-Use→12 / Refuted→13, deleted
the stale not-yet-confirmed-books placeholder, updated the status header (7/10→10/10), fixed the one internal cross-ref
"(section 8)→(section 11)", folded the convergence note in as section 11.6, and replaced the "must-not-cite Carnegie/
Gladwell/Stone until source-checked" line with the attribution cautions. The loader embeds the whole file, so the 3 books
go live with the file — no wiring change (source-checked: buildSystemPrompt.test unchanged). Done via a scripted, asserted
integration (10-book count checked) to avoid hand-transcribing ~4,500 words — the script was temp + deleted.

## §5 / honesty discipline
Every principle is primary-source-source-checked; nothing that failed source-checking was included (0 refuted this run); the
do-not-cite notes name the attribution nuances so the Coach never over-quotes. This is the anti-knowledge≠intelligence
discipline: the Coach's grounding is earned against sources, not the model's confident memory.

## A26 / A30 gate
The KB structural-integrity guard (`knowledgeBase.test.ts`, shipped 54ebaaf7 this session, A26-swept to the sales KB
in dbc1f23a) already locks per-book format; its book-count floor is raised 7→10 here — so a dropped book fails a
test. The guard is the standing gate for KB completeness + integrity.

## Ripple (holistic — §6 item 5)
- Content-only + a test-floor bump; no schema/route/code-logic change. The loader is unchanged.
- Per-call token cost rises (~9k→~13k) — the accepted design (COACH_PROMPT_DESIGN.md section 7.2: full KB inline, tokens
  are the cost of the product) + the founder's explicit opt-in. No cap (by design).
- Cross-refs audited: the only section-number reference ("section 8") was updated; book-internal N.M refs (books 1-7)
  are unchanged (their numbers didn't move).

## Session-read manifest (A22 — every citation carries a THIS-build read_at ≥ started_at 13:50:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-25T13:57:40+08:00",
    "why_it_governs": "Understanding earned before solving.",
    "how_this_build_will_embody_it": "Understood the KB structure + the loader + the research's source-checking before integrating; the content is source-checked, not assumed." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-35", "read_at": "2026-08-25T13:57:42+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Cited axioms re-read fresh this build." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-08-25T13:58:10+08:00",
    "why_it_governs": "Layer 2 operational effectivity — the KB is the Coach's operational grounding; a complete, correctly-wired KB is what makes the Coach actually work with full grounding.",
    "how_this_build_will_embody_it": "The 3 books go live via the loader (source-checked by buildSystemPrompt.test); the Coach now reasons from 10/10 books." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-149", "read_at": "2026-08-25T13:58:12+08:00",
    "why_it_governs": "THINK+search the class + neighbors.",
    "how_this_build_will_embody_it": "The KB-integrity guard was swept to BOTH KBs (coach + sales) before this landed; the floor is raised here." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-430", "read_at": "2026-08-25T13:57:44+08:00",
    "why_it_governs": "Knowledge ≠ intelligence — the Coach must reason from source-checked principles, not fluent fabrication.",
    "how_this_build_will_embody_it": "Every added principle is 3-vote source-checked against a legitimate primary/author source; 0 refuted; attribution caveats honored in the do-not-cite notes." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-437", "read_at": "2026-08-25T13:57:46+08:00",
    "why_it_governs": "Quick-decision checklist (understand-why, ripple, sweep).",
    "how_this_build_will_embody_it": "Ran it: understood the source discipline, traced ripple (token cost, cross-refs), the guard is the gate." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-457", "read_at": "2026-08-25T13:57:50+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this build." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-596", "read_at": "2026-08-25T13:57:52+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a fresh read_at; trailer lists them." },
  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-693", "read_at": "2026-08-25T13:58:14+08:00",
    "why_it_governs": "Sweep the class to its boundary.",
    "how_this_build_will_embody_it": "The KB-integrity guard covers both KBs; this build raises the coach-KB floor to the full 10." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-772", "read_at": "2026-08-25T13:58:16+08:00",
    "why_it_governs": "Encode the lesson in a gate.",
    "how_this_build_will_embody_it": "The KB integrity test (10-book floor + per-book format) fails without cooperation if a book is dropped or malformed." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1003", "read_at": "2026-08-25T13:58:18+08:00",
    "why_it_governs": "The gate-status word is a claim about the canonical command actually run.",
    "how_this_build_will_embody_it": "check.md pastes the full `npm run check` output + EXIT code." }
]
```
