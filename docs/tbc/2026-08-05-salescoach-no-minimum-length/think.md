---
tbc_version: 1
trigger: fix
started_at: 2026-08-04T22:09:11Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 15
hypotheses: 1
---

# THINK — Sales Coach: no minimum length, every session gets all content

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) MATCH the top-level DOC_MANIFEST.json.
Both are in the working tree; the cited axioms were re-read this session (manifest below).

## 2. Diagnosis (§1.2 retrospective / §0 understand-before-solving)
Founder report, reproduced 4× by the sales agent: a real full pitch of **5–7 minutes** rendered on the
After-Pitch screen as **"This call was too short to read yet"** with only **2 of the scores** showing
(the two computed metrics: talk/listen + questions). "Your read", the LLM score categories, Dissect, and
the rest were absent.

Root cause is TWO layers, both of which judge a call "too thin" — and the founder's 5–7 min pitch tripped
the first without ever reaching the length floor of the second:

1. **LLM prompt refusals.** Every v5 content engine's system prompt instructed the model to
   `return hasSignal:false` (an empty state) when it judged the transcript "too thin to grade/read
   fairly". A genuine short-but-complete pitch is exactly the input the model reads as "thin", so it
   refused — producing the "too short to read" narrative and dropping the LLM score categories (leaving
   only the two deterministic computed scores). This is the layer the founder actually hit.

2. **Engine length floors.** Each engine also had a hard code gate — `if (agentSegments.length < 3)` /
   `if (segments.length < 4) return EMPTY` (`MIN_AGENT_SEGMENTS`/`MIN_SEGMENTS`). A 5–7 min pitch clears
   these easily, so they did not cause *this* report — but they are literally the "minimum time" the
   founder's directive names, and would suppress all content on a genuinely brief (1–2 exchange) call.

## 3. Founder directive (owns the product decision — §3.3 guide, don't overtake)
Verbatim, across three escalating messages: *"don't put a minimum time, each session should have
&lt;My read&gt; &lt;Summarize&gt; &lt;Dissect&gt;, and all Sales Coach related tools/feedback… please don't
contradict my instruction, and perform the build I asked."* This is a product decision the founder owns.
The §3.4 honesty line is preserved a different way — see §5.

## 4. Interconnection trace (§1.5 holistic)
- The After-Pitch page (`after-pitch/page.tsx`) renders strengths/scores by `.length`, and shows the
  "too short to read" note only on `!narrative.hasSignal`, and the whole "No conversation captured" empty
  state only on `!summary.hasSignal`. Once the engines return content, these gates are satisfied — no page
  edit is required. The only inputs that still legitimately short-circuit are a genuinely empty rep side
  (0 agent turns — a capture gap, matching the existing talk-ratio `custW===0` caveat) and a 0-segment
  transcript (`afterPitch.ts` / `salesSummary.ts`).
- `salesSummary.ts` already had no length floor (only a 0-segment guard) — Summarize was never the problem.
- The live in-call cue engines (`liveCue`, `liveConfidence`) and cross-session aggregates
  (`salesWhyPatterns` `MIN_WHYS`) are a different domain (real-time / multi-session) and are left untouched.

## 5. §3.4 honesty preserved — no fabrication
Removing the *refusal* is not licence to *invent*. Every prompt keeps its hard rule: ground every point in
a REAL transcript line, never fabricate a quote or a statistic. A short call now gets a short, REAL read of
what is actually there — the opener, the tone, the customer's first reaction — never a manufactured lesson.
"Always generate" + "never fabricate" are compatible: a brief exchange genuinely contains a first move worth
naming.

## 6. Hypothesis
- **H1:** After the change, a short-but-real session (≥1 rep turn) generates the full content set —
  Your read, all score categories, Dissect, moments, pivot, why, summary — with no "too short" empty state;
  only a genuinely empty (0-turn / 0-segment) capture is excluded; typecheck + v5 suite + secretless build
  all pass.

## 7. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-04T22:09:11Z", "source_file": "CLAUDE.md", "line_range": "12-24", "why_it_governs": "Understand before solving — trace the two 'too thin' layers before touching either.", "how_this_build_will_embody_it": "Section 2 diagnoses both layers from the record before any edit." },
  { "id": "§0.1", "read_at": "2026-08-04T22:09:11Z", "source_file": "CLAUDE.md", "line_range": "26-44", "why_it_governs": "Precondition gate — the methodology must be in the working tree and re-read, not cited from cached labels.", "how_this_build_will_embody_it": "Doc-integrity MATCH in Section 1; ThinkerThinker axioms re-read this session (A11/A22/A38 entries below)." },
  { "id": "§1.2", "read_at": "2026-08-04T22:09:11Z", "source_file": "CLAUDE.md", "line_range": "48-58", "why_it_governs": "Retrospective identification — identify the problem from the actual record (4× reproduced report), not by theorizing forward.", "how_this_build_will_embody_it": "Section 2 reads the reproduced symptom and locates the two layers that produced it." },
  { "id": "§1.5", "read_at": "2026-08-04T22:09:11Z", "source_file": "CLAUDE.md", "line_range": "78-96", "why_it_governs": "Holistic — the after-pitch page + sibling surfaces + live/aggregate engines must not silently break.", "how_this_build_will_embody_it": "Section 4 traces the page gates and scopes the change away from live/aggregate engines." },
  { "id": "§1.5.1", "read_at": "2026-08-04T22:09:11Z", "source_file": "CLAUDE.md", "line_range": "78-140", "why_it_governs": "Four-layer feature gate — L2 operational effectivity (does the after-pitch feature actually deliver content end-to-end for a real short call) and L3 workflow continuity.", "how_this_build_will_embody_it": "Section 4 traces the page read-path; the fix restores L2 (content shows) without breaking L3 (rep flows to next door)." },
  { "id": "§1.5.2", "read_at": "2026-08-04T22:09:11Z", "source_file": "CLAUDE.md", "line_range": "142-175", "why_it_governs": "THINK-then-search — before editing one engine, hypothesize the class and sweep every sibling engine for the same gate.", "how_this_build_will_embody_it": "check.md's A26 sweep enumerates all v5 engines, fixes the class, and records the deliberate out-of-scope boundary." },
  { "id": "§6", "read_at": "2026-08-04T22:09:11Z", "source_file": "CLAUDE.md", "line_range": "352-380", "why_it_governs": "Decision checklist before acting — understood-why, retrospective+outside-view, not repeating a failed approach, holistic, explain-why.", "how_this_build_will_embody_it": "think.md walks the diagnosis (why), the record (4× repro), the ripple trace, and the honesty-preserving rationale." },
  { "id": "§3.3", "read_at": "2026-08-04T22:09:11Z", "source_file": "CLAUDE.md", "line_range": "270-282", "why_it_governs": "Guide, don't overtake — the founder owns this product decision; do it, don't relitigate on honesty grounds.", "how_this_build_will_embody_it": "Section 3 records the directive; the build performs it." },
  { "id": "§3.4", "read_at": "2026-08-04T22:09:11Z", "source_file": "CLAUDE.md", "line_range": "300-315", "why_it_governs": "Honesty is the moat — 'always generate' must not become 'fabricate'.", "how_this_build_will_embody_it": "Section 5: prompts keep the ground-in-real-transcript rule; only the refusal is removed." },
  { "id": "§5", "read_at": "2026-08-04T22:09:11Z", "source_file": "CLAUDE.md", "line_range": "395-410", "why_it_governs": "Builder-under-pressure — the standing-guard hook must not push me to manufacture, and the founder's decision must not be softened OR over-honesty'd against their explicit will.", "how_this_build_will_embody_it": "Section 3/5: performed the founder's directive as asked while preserving the no-fabrication floor — neither relitigated nor rubber-stamped." },
  { "id": "A11", "read_at": "2026-08-04T22:09:11Z", "source_file": "ThinkerThinker.md", "line_range": "51,273-286", "why_it_governs": "The System mirrors, it does not judge — scores stay evidenced observations the rep can contest.", "how_this_build_will_embody_it": "Score prompt keeps rationale+citation per category; only the refuse-if-thin gate is dropped." },
  { "id": "A22", "read_at": "2026-08-04T22:09:11Z", "source_file": "ThinkerThinker.md", "line_range": "58,65,74", "why_it_governs": "Citations require session-reading; this manifest + trailer record it.", "how_this_build_will_embody_it": "This manifest pairs each cited § with a read timestamp + line range." },
  { "id": "A38", "read_at": "2026-08-04T22:09:11Z", "source_file": "ThinkerThinker.md", "line_range": "95", "why_it_governs": "'Verified' = a command run, reported in the gate's words with an exit code.", "how_this_build_will_embody_it": "check.md pastes tsc / vitest / build:ci output with exit codes." },
  { "id": "A19", "read_at": "2026-08-04T22:09:11Z", "source_file": "ThinkerThinker.md", "line_range": "458-474", "why_it_governs": "The methodology must live in the working tree and be consulted — not cited as a cached label.", "how_this_build_will_embody_it": "TT.md is present (hash MATCH) and its axioms were re-read this session before citing them." },
  { "id": "A30", "read_at": "2026-08-04T22:09:11Z", "source_file": "ThinkerThinker.md", "line_range": "91", "why_it_governs": "A lesson in prose returns — encode it in a gate that fails without the author's cooperation.", "how_this_build_will_embody_it": "The updated salesReview.generate test locks the new 'no minimum' contract so a future edit can't silently reintroduce the floor; each MIN=1 carries a founder-decision comment where the edit meets it." }
]
```
