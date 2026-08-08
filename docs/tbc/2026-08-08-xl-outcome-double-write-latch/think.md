---
tbc_version: 1
trigger: fix
started_at: 2026-08-08T07:15:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 11
hypotheses: 1
---

# THINK — recordOutcome append-only double-write latch (A29 sweep finding)

(Build `xl` — post-9 daily builds sort after `x9` as xa..xl.)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) unchanged this session. The cited axioms were RE-READ FRESH
this build (07:24–07:27Z), timestamps post-dating started_at (A22) — not carried from the earlier builds.

## 2. How this was found (A29 — mine recent FIXES for unswept siblings)
The founder invoked a rigorous audit. Running A29 against this session's fix log, the anchor was the
append-only double-write class: `9463f709`/`63b13084` added `useRef` latches to `submitWhy` and `generateReview`
(button-triggered handlers that POST append-only §3.1 events). A fix under pressure addresses the reported
instances and usually leaves the CLASS. Swept the sibling handlers on the same page.

## 3. The finding, verified adversarially (a pattern match is a suspect)
`recordOutcome` (`src/app/dashboard/sales-coach/[id]/page.tsx:323`) POSTs `/outcome`. Suspect: it used only a
`useState` guard (`savingOutcome`), not a `useRef` latch. VERIFIED it's a real defect, not just a pattern match:
- `/outcome` → `setSessionOutcome` (`src/lib/data/salesCoach.ts:275`) does `sb.from("events").insert(...)` — an
  immutable `coach.session_outcome_recorded` §3.1 event, appended EVERY call (the column write is idempotent;
  the EVENT is not).
- `recordOutcome` had NO top-of-handler re-entrancy guard at all — only `setSavingOutcome(outcome)`, which
  disables the button on the NEXT render. A fast double-click fires two POSTs before the re-render → **two
  identical outcome events**, skewing any downstream-consequence (KPI) metric that counts them.
- Cleared the two OTHER suspects adversarially: `submitNameAndFinish` PATCHes a forward-only status/rename
  (idempotent UPDATE, no event insert — not a sibling); `getPrep`/`askCoach` are on-demand, not stored.

## 4. The fix — at the CHOKEPOINT (A33)
`saveDealValue` also routes through `recordOutcome`, so `recordOutcome` is the single chokepoint every
outcome-event append passes through. A `useRef` latch THERE guards the outcome buttons AND saveDealValue by
construction — `if (outcomeSubmitRef.current) return; outcomeSubmitRef.current = true;` before the first await,
released in `finally` (so a deliberate later re-record — a real correction — still works). Mirrors the
`submitWhy`/`generateReview` pattern verbatim.

## 5. Gate or promise (A30 / A33)
**PROMISE — precise client gate DECLINED (A33), consistent with the existing fixes.** "A handler that appends an
event needs a re-entrancy latch" is a semantic property (which handlers append? call-graph, two hops through
setSessionOutcome), not a grep — a broad gate fires on read-only handlers. The existing latches (`submitWhy`/
`generateReview`) are themselves ungated for the same reason (grep-confirmed: no test references them). The
PRECISE gate would be a CHOKEPOINT one layer down — server-side idempotency in `setSessionOutcome` (skip
appending an identical outcome event within a short window / dedupe on a request id) — which makes "no double
outcome event" true by construction regardless of the client. That touches §3.1 append-only semantics (does the
event model dedupe identical events?) — a founder/architecture decision, FLAGGED in closure, not picked here.

## 6. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-08T07:26:00Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand before solving — verify the suspect (does /outcome actually append?) before fixing.", "how_this_build_will_embody_it": "Section 3 traces /outcome→setSessionOutcome→events.insert before the fix." },
  { "id": "§0.1", "read_at": "2026-08-08T07:26:00Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Precondition gate — methodology in tree, hashes verified.", "how_this_build_will_embody_it": "Section 1 records the MATCH + fresh reads." },
  { "id": "§1.5.1", "read_at": "2026-08-08T07:26:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer L1/L2 — a double-write corrupts the data layer feeding the KPI surface.", "how_this_build_will_embody_it": "The latch protects the §3.1 event integrity the KPI layer reads." },
  { "id": "§1.5.2", "read_at": "2026-08-08T07:26:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Proactive audit found it; sweep the class not just the reported instance.", "how_this_build_will_embody_it": "A29 sweep from the fixed instances to this sibling." },
  { "id": "§6", "read_at": "2026-08-08T07:26:00Z", "source_file": "CLAUDE.md", "line_range": "352-380", "why_it_governs": "Decision checklist — gate or promise.", "how_this_build_will_embody_it": "Section 5 answers it: promise (client) + flags the chokepoint gate." },
  { "id": "§3.1", "read_at": "2026-08-08T07:31:00Z", "source_file": "CLAUDE.md", "line_range": "257-263", "why_it_governs": "Events are append-only/immutable — a duplicate outcome event corrupts the immutable §3.1 record the KPI layer replays.", "how_this_build_will_embody_it": "The latch prevents a second identical immutable outcome event; the chokepoint residual concerns the same event-model integrity." },
  { "id": "A19", "read_at": "2026-08-08T07:27:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Methodology in tree, consulted this build not cached.", "how_this_build_will_embody_it": "Axioms re-read fresh (07:24–07:27)." },
  { "id": "A22", "read_at": "2026-08-08T07:27:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-609", "why_it_governs": "Citations require in-session reading; timestamps reflect THIS build.", "how_this_build_will_embody_it": "Re-read fresh rather than backdating start." },
  { "id": "A30", "read_at": "2026-08-08T07:27:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-787", "why_it_governs": "Gate the class, or name why not.", "how_this_build_will_embody_it": "Section 5 answers gate-or-promise explicitly." },
  { "id": "A33", "read_at": "2026-08-08T07:24:00Z", "source_file": "ThinkerThinker.md", "line_range": "850-861", "why_it_governs": "A gate must be precise or not exist; find the chokepoint or decline.", "how_this_build_will_embody_it": "Client gate declined (semantic); the chokepoint (server idempotency) is named + founder-flagged." },
  { "id": "A38", "read_at": "2026-08-08T07:27:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = the canonical command by name + output.", "how_this_build_will_embody_it": "check.md pastes `npm run check` + exit code." }
]
```
