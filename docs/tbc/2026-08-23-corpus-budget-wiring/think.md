---
started_at: 2026-08-23T13:43:15+08:00
---

# THINK — wire the knowledge-corpus budget (INV22 re-starvation gap; my own unwired WIP)

## The problem, from the record (§0 — understanding earned before solving)

The reasoning-model token-starvation class (INV22 "error dressed as no-data", chased to its root THIS
session: fix = HEADROOM 7000 + MAX_TOTAL 8000, test-locked) was closed for the **built-in** corpora
(~3.2–4.6k tokens, safe). But the guard I *started* for the remaining vector — a **custom, admin-editable**
corpus large enough to re-starve — is `src/lib/llm/corpusBudget.ts`, and it is **UNWIRED, UNTESTED, and
never committed** (verified: `grep capCorpus` → zero callers; no test file; `git log` empty). Its own doc
CLAIMS it's "used at BOTH ingestion and load in both Sales Coach and C.A.R.E" — aspirational, not actual.
That is the "validation written but never wired" class ([[reference_validation_schema_written_but_unwired]]).

**This is MY unfinished work, not a founder deferral** — so A20 says finish the default, don't park it. (The
contrast with D4, which the founder EXPLICITLY deferred, is the A20-vs-deferral discriminator I recorded earlier
this session.)

## Root cause + why it produces empty AI (§3.4 — honesty is the moat)

- Both Sales corpora (`sales_coach_corpus_versions`, kinds `methodology` + `product`) are saved via
  `/api/coach/sales-session/corpus` and `/product` with `content: z.string().max(100000)` — **100,000 chars
  ≈ 25,000 tokens** allowed.
- The analysis brains inject that content **RAW** into the LLM system prompt. The output clamp is 8000 tokens
  (reasoning + answer); a 25k-token corpus drives the reasoning model to spend its whole budget "thinking"
  → the answer is starved → **empty review/dissect/prep**. It silently punishes the BEST customers (the ones
  who invest in a rich corpus) with broken AI — the exact §3.4 / INV22 failure the file exists to prevent.

## A26 class sweep — the boundary (verified adversarially, each a read suspect)

Class root shape: *"an admin-editable per-tenant corpus injected into an LLM system prompt with no size cap."*

IN-CLASS → FIX (raw injection):
1. `methodologyBlock` (salesReviewPrompt.ts) — `${custom}` raw → covers dissect/moments/pivot/review/score + copilot/formulate (7 consumers, one chokepoint).
2. `reviewProductBlock` (prepShared.ts) — `${product.trim()}` raw → same 7.
3. `buildPrepSystemPrompt` (salesPrep.ts) — `${methodology}` + `${product.trim()}` raw (its own inline blocks, not the shared chokepoint).
4. `buildQASystemPrompt` (salesPrepQA.ts) — same shape as prep.

INGESTION → FIX (cap too loose): 5. `/corpus` route, 6. `/product` route (`max(100000)`).

BOUNDED → EXCLUDED (reachability/verified-safe): liveCue (`.slice(0,600/400)`), roleplay (`.slice(0,4000)`),
attribute (`.slice(0,1200)`); C.A.R.E `ai_product_context`/`ai_assistance_guidance` + Sales suggest guidance
+ v5 analyze/followup `supportProductContext` (all zod `max(8000)` ≈ 2k tok, safe); strategy-library + the
corpus/product GET routes (return corpus for DISPLAY/EDIT — must NOT cap, the admin needs the full text);
built-in KBs (`getSalesKnowledgeBase`/`ELOSTATE_PRODUCT_KNOWLEDGE`/`DEFAULT_METHODOLOGY`, code-managed, safe).

## The fix (holistic ripple, §6 item 5) + altitude (§1.5.1 layer 1)

- **SAVE (primary):** `capCorpus(content)` at both routes → store capped, return `{truncated, originalChars}`.
  New corpora are ≤budget at rest, so EVERY downstream injection (incl. any future brain) is safe by default.
- **LOAD (defensive, for LEGACY corpora saved before the cap):** `capCorpus(...).content` at the 4 injection
  helpers. The 2 shared helpers are the natural LLM chokepoint (display paths don't use them, so full-text
  display is preserved); prep/prepQA get the same one-line cap on their inline blocks.
- `corpusBudget.ts`: drop `import "server-only"` (capCorpus is a PURE string fn — server-only would break any
  transitively client-imported prompt builder for no benefit); correct the doc's "used at…" line to the
  actually-wired sites; commit it.
- Budget stays the file's chosen 24,000 chars (≈6k tok) — larger than every built-in KB, safely under the
  starve level. Per-corpus; methodology+product capped ≈12k tok combined, still within safe reasoning margin.

## A30 gate (a lesson in prose returns — encode it so it fails without cooperation)

Tests: capCorpus unit (under-budget passthrough / boundary truncation at a clean break / idempotence /
truncated+originalChars honesty); one detection test per injection helper (a >budget corpus yields a capped
emitted prompt — fails if someone deletes the capCorpus call); a save-route test (over-budget save stores
capped + reports truncated).

## Residual (A26 honest stopping point — flagged, not silently dropped)

The admin-facing **UI toast** "corpus truncated from N chars" at save: the routes will RETURN `truncated`/
`originalChars`, but wiring the settings UI to surface it is a small follow-up. Deferring it leaves NO
starvation gap (LOAD+SAVE caps fully prevent empty AI); it leaves only the minor §3.4 nicety that the admin
isn't yet actively told at save time. Flagged for a clean follow-up, not claimed done.

## Session-read manifest (A22 — every citation carries a THIS-build read_at ≥ started_at 13:43:15)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-23T13:43:40+08:00",
    "why_it_governs": "Understanding earned before solving.",
    "how_this_build_will_embody_it": "Traced the full chain (save cap 100k → raw injection → 8k output clamp → empty AI) end-to-end before writing a line." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-08-23T13:43:45+08:00",
    "why_it_governs": "Methodology in the working tree, read this build.",
    "how_this_build_will_embody_it": "Verified ThinkerThinker.md in-tree; re-read every cited § fresh." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-107", "read_at": "2026-08-23T13:44:10+08:00",
    "why_it_governs": "Layer 2 (operational effectivity) — a corpus feature that renders but starves the model isn't 'working'.",
    "how_this_build_will_embody_it": "The fix restores layer-2 effectivity (a rich corpus produces a real read, not empty)." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-148", "read_at": "2026-08-23T13:44:20+08:00",
    "why_it_governs": "Proactive THINK+search — this gap was found by auditing new untracked code, not by a founder report.",
    "how_this_build_will_embody_it": "THOUGHT the hypothesis (unwired guard → live starvation), then swept the class to confirm." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-374", "read_at": "2026-08-23T13:45:30+08:00",
    "why_it_governs": "Honesty is the moat — empty AI dressed as 'no result' is the dishonesty this build removes.",
    "how_this_build_will_embody_it": "Prevents the silent empty; the save path reports truncation honestly rather than dropping content unseen." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-445", "read_at": "2026-08-23T13:52:00+08:00",
    "why_it_governs": "Quick-decision checklist (holistic ripple, item 5).",
    "how_this_build_will_embody_it": "Traced ripple (display paths preserved; server-only removed to avoid client-build breakage) + added gates." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-460", "read_at": "2026-08-23T13:51:00+08:00",
    "why_it_governs": "Methodology in the tree — no cited-from-cache labels.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this build." },
  { "id": "A20", "source_file": "ThinkerThinker.md", "line_range": "480-497", "read_at": "2026-08-23T13:47:30+08:00",
    "why_it_governs": "Don't park a decidable default as 'founder decision' — finish it.",
    "how_this_build_will_embody_it": "Finishes MY unwired corpusBudget WIP (a default), distinct from D4 (the founder's own deferral)." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-601", "read_at": "2026-08-23T13:49:30+08:00",
    "why_it_governs": "Citations without session-reads are undetected violations.",
    "how_this_build_will_embody_it": "This manifest pairs every cited § with a THIS-build read_at; the Session-Reads trailer lists them." },
  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-720", "read_at": "2026-08-23T13:46:00+08:00",
    "why_it_governs": "A bug is one instance of a class; sweep to the boundary; verify each suspect; flag the residual honestly.",
    "how_this_build_will_embody_it": "Swept ALL corpus consumers; named 6 in-class sites + the excluded (reachability/safe) set + the UI residual." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-775", "read_at": "2026-08-23T13:50:00+08:00",
    "why_it_governs": "A prose lesson returns — encode a gate that fails without the author's cooperation.",
    "how_this_build_will_embody_it": "Detection test per injection helper: deleting a capCorpus call makes the >budget-input test fail." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1010", "read_at": "2026-08-23T13:48:30+08:00",
    "why_it_governs": "'Verified' names the exact canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the full `npm run check` output + EXIT code." }
]
```
