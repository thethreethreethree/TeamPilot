---
tbc_version: 1
trigger: feature
started_at: 2026-08-08T02:40:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 11
hypotheses: 1
---

# THINK — Sales Coach extension: preview the captured text, not just its length

(Build `xg` — post-9 daily builds sort after `x9` as xa..xg.)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) recomputed this session (`sha256sum`) — both equal the
values xf recorded and the DOC_MANIFEST, unchanged since xf hours earlier. Methodology is in the working tree
(A19); the axioms cited below were opened this session (section 6), not cited from cached labels (A22).

## 2. How this was found (§1.5.2 proactive audit — not founder-reported)
A fresh outside-view pass (the detached-observer stance) over my OWN not-yet-launched deliverable, dispatched under the four-layer
lens (§1.5.1) against the surface I honestly flagged as the build's soft spot: the Tier-2 adapter selectors
are REASONED, not runtime-verified (adapters.js header). The happy path and the empty-capture path were both
already clean (traced this session — see section 3). The gap is the third path: a wrong-but-non-empty capture.

## 3. The problem, understood from the record (§0)

`content.js captureConversation()` prefers a per-site adapter, else the rep's manual highlight. When an
adapter's `extract()` returns `""` (selector miss / throw) the code correctly falls through to manual
selection, and `runTool` guards `if (!currentSelection.trim())` with a clear "highlight… and press Capture"
message. That path is honest.

The unguarded path: a **generic Tier-2 selector that matches the WRONG nodes and returns plausible
non-empty text** — e.g. telegram `.text-content`, googlevoice `div.content`, googlechat `[jsname] div[dir='auto']`.
These are broad selectors that can catch sidebar chrome, quoted/preview snippets, or an adjacent thread.
`setSelection` then reported only a COUNT — `"47 characters captured"` — which looks **identical** for a
correct grab and a wrong one. The rep, seeing a confident count, runs a tool and the coach reasons over
garbage: a fluent, well-formed, WRONG result the rep has no signal to distrust.

This is A39's boundary failure (attribution/fidelity dies at the SCRAPE boundary) one notch earlier —
not "who said it" but "is this even the conversation" — and it is §3.4 (honesty is the moat) applied to
INPUT: the panel must not present wrongly-captured context as if it were right. The count is A38's shape at
the UI layer — a true statement about a smaller thing ("N characters") delivered in the register of the
larger one ("the conversation is captured").

Crucially, the fix does NOT require verifying the selectors live (which the build sandbox cannot do — that
stays founder-verified per PLATFORM-COVERAGE.md). It makes a wrong grab **self-evident to the human**, who
then re-highlights manually — the always-correct path. The defense is surfaced-to-the-operator, not a
selector I can't confirm.

## 4. Interconnection trace (holistic)
- Enforced-path check: `extension-sales/` is NOT an enforced path (freshness verifier: `src/`, `scripts/`,
  `migrations/` only). The change becomes TBC-triggering solely because its detection test lives under
  `src/lib/coach/extension/__tests__/`. That test is source-substring only (the panel is runtime-unverifiable
  — shadow DOM), matching the file's existing guard style.
- No server contract changes; `setSelection` is display-only. `currentSelection` (what is sent) is untouched —
  the preview is a projection of it, so nothing about the payload or truncation (`MAX_CHARS`) shifts.
- Escaping: the preview is written via `textContent`, so page-controlled text cannot inject markup (same
  posture as the existing selinfo line).

## 5. Hypothesis (§1.5.2)
- **H1:** the pre-fix panel shows only a count, so a wrong non-empty capture is indistinguishable from a right
  one. Confirm: a detection test asserts the panel source contains a bounded preview of the captured text
  (`slice(0, 90)` + a "characters captured … <snippet>" render), and FAILS on the count-only pre-fix string.
  **Held** (test added to `salesExtensionClientWiring.test.ts`; it fails on the old string).

## 6. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-08T02:52:00Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand before solving — trace the three capture paths before touching the panel.", "how_this_build_will_embody_it": "Section 3 traces happy/empty/wrong-non-empty before proposing the preview." },
  { "id": "§0.1", "read_at": "2026-08-08T02:52:00Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Precondition gate — methodology in the tree, hashes recomputed not cached.", "how_this_build_will_embody_it": "Section 1 records the sha256 MATCH recomputed this session." },
  { "id": "§1.5.1", "read_at": "2026-08-08T02:53:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer gate — this is an L2 (does it actually work) + L4 (surface) fix on the capture step.", "how_this_build_will_embody_it": "The preview restores an honest L2 signal (wrong grab visible) and improves the L4 surface." },
  { "id": "§1.5.2", "read_at": "2026-08-08T02:53:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Proactive audit found this; its 'no license to refactor without need' bounds scope to my own deliverable.", "how_this_build_will_embody_it": "Additive, tested change on the not-yet-launched sales panel; no shipped-product rewrite." },
  { "id": "§3.4", "read_at": "2026-08-08T02:54:00Z", "source_file": "CLAUDE.md", "line_range": "282-293", "why_it_governs": "Honesty is the moat — a wrongly-captured context must not read as a correct one.", "how_this_build_will_embody_it": "The preview makes a wrong grab self-evident instead of hiding it behind a count." },
  { "id": "§6", "read_at": "2026-08-08T02:54:00Z", "source_file": "CLAUDE.md", "line_range": "352-380", "why_it_governs": "Decision checklist before acting.", "how_this_build_will_embody_it": "think walks the gap, the trace, the hypothesis, the scope call." },
  { "id": "A19", "read_at": "2026-08-08T02:57:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-476", "why_it_governs": "Methodology in the tree, consulted not cached.", "how_this_build_will_embody_it": "TT.md present (hash MATCH); A19/A22/A30/A38/A39 opened this build before citation." },
  { "id": "A22", "read_at": "2026-08-08T02:56:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-621", "why_it_governs": "Citations require session-reading; the manifest is the shipping artifact that proves it.", "how_this_build_will_embody_it": "This manifest pairs each cited id with a real in-session read timestamp + line range." },
  { "id": "A30", "read_at": "2026-08-08T02:55:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-789", "why_it_governs": "A lesson in prose returns — encode the class in a gate that fails without the author.", "how_this_build_will_embody_it": "The fix ships a detection test that fails on the count-only regression, not just a comment." },
  { "id": "A38", "read_at": "2026-08-08T02:50:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1020", "why_it_governs": "'Verified' = the canonical command by name, with its output.", "how_this_build_will_embody_it": "check.md pastes `npm run check` and its exit status — the earlier green was pre-edit and does not count." },
  { "id": "A39", "read_at": "2026-08-08T02:51:00Z", "source_file": "ThinkerThinker.md", "line_range": "1024-1037", "why_it_governs": "Fidelity dies at the scrape boundary; a broad selector silently reconstructs the wrong content.", "how_this_build_will_embody_it": "The preview surfaces the boundary's output to the human so a wrong scrape is caught before it reaches the model." }
]
```
