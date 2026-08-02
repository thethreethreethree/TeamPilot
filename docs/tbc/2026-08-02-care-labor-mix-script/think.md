---
tbc_version: 1
trigger: feature
started_at: 2026-08-02T04:18:30Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 12
hypotheses: 1
---

# THINK — a read-only tool for the C.A.R.E AI-labor mix (prices the VA offer)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) MATCH DOC_MANIFEST (build.md). Both in the working tree; the
relevant principles were read this session.

## 2. Why (§3.4 honesty, §3.5 measure consequence)
The founder is pricing a "Managed C.A.R.E / save-15%" VA offer. Its economics hinge on ONE measured number:
how much human labor the AI removes. I told the founder "one query gives the three labor tiers" — this makes
that query a runnable, honesty-guarded tool instead of a sentence in a PDF. Without it, the number lives only
as hand-written SQL the founder would have to reconstruct; with it, `npm run care:labor-mix` returns the mix
from live data any time, and REFUSES to let a small sample masquerade as signal.

This is NOT a product feature and NOT a pricing decision (§3.3 — no overtaking): it's read-only analytics
tooling, exactly the shape of the existing `scripts/verify-invariants-live.mjs`. Its consumer is the founder
invoking it — so it is not dead code (the pure-function-with-no-caller trap I deliberately avoided).

## 3. Design + interconnection (§1.5 ripple)
One `scripts/care-labor-mix.mjs` (mirrors verify:live's env-load + `pg` read-only connection) + one npm alias
`care:labor-mix`. The SQL partitions every `status='resolved'` support_conversation by its messages
(`author_type` + `co_pilot_invoked`, 0040): fully_deflected (no agent msgs) / copilot_assisted (agent msgs, all
AI-drafted) / fully_manual (≥1 unaided agent msg). Ripple: read-only, no schema/route/write; one package.json
script line. Nothing else depends on it.

## 4. Class sweep (A26)
This is the operational twin of the derivation already stated in the founder PDF and in
`project_va_managed_care_offer_2026_08_02`. No other place computes an AI-labor mix (the care analytics surfaces
count agent vs customer for other purposes but don't split the co-pilot tier). No duplication introduced.

## 5. Hypothesis
- **H1:** the script connects read-only, the SQL runs against the LIVE schema, and it returns a sane 3-tier
  partition summing to N (resolved count); on a small N it prints the DIRECTIONAL-ONLY warning; it never writes.

## 6. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-02T04:18:30Z", "source_file": "CLAUDE.md", "line_range": "12-24", "why_it_governs": "Understand the metric before tooling it — deflection is a 3-tier labor mix, not binary.", "how_this_build_will_embody_it": "Section 2/3 state the earned model; the partition matches it." },
  { "id": "§0.1", "read_at": "2026-08-02T04:18:30Z", "source_file": "CLAUDE.md", "line_range": "20-40", "why_it_governs": "Methodology in the tree, consulted this session.", "how_this_build_will_embody_it": "Doc integrity MATCH; hashes in build.md." },
  { "id": "§1.5", "read_at": "2026-08-02T04:18:30Z", "source_file": "CLAUDE.md", "line_range": "78-96", "why_it_governs": "Ripple trace before adding a tool that reads shared tables.", "how_this_build_will_embody_it": "Section 3: read-only, one script + one npm line, nothing depends on it." },
  { "id": "§1.5.1", "read_at": "2026-08-02T04:18:30Z", "source_file": "CLAUDE.md", "line_range": "78-110", "why_it_governs": "Feature-workflow gate — the tool must actually deliver its intended result end-to-end when invoked.", "how_this_build_will_embody_it": "Verified by running it live (check.md) — it returns the mix + honesty guard, not just a unit-passing stub." },
  { "id": "§3.3", "read_at": "2026-08-02T04:18:30Z", "source_file": "CLAUDE.md", "line_range": "270-282", "why_it_governs": "Guide, don't overtake — a metric tool must not become a pricing decision.", "how_this_build_will_embody_it": "It reports a number; it decides nothing; the price call stays the founder's." },
  { "id": "§3.4", "read_at": "2026-08-02T04:18:30Z", "source_file": "CLAUDE.md", "line_range": "292-306", "why_it_governs": "Honesty is the moat — a small-N mix must not be dressed as a reliable figure.", "how_this_build_will_embody_it": "The tool prints N and a DIRECTIONAL-ONLY warning below 200; I did not price off the N=6 baseline." },
  { "id": "§3.5", "read_at": "2026-08-02T04:18:30Z", "source_file": "CLAUDE.md", "line_range": "310-330", "why_it_governs": "Measurement rules — anchor to consequence (human-minutes saved), not a vanity rate.", "how_this_build_will_embody_it": "The mix is framed as effective human-labor tiers, the thing that actually sizes the VA team." },
  { "id": "A19", "read_at": "2026-08-02T04:18:30Z", "source_file": "ThinkerThinker.md", "line_range": "57", "why_it_governs": "Methodology must live in the tree.", "how_this_build_will_embody_it": "Confirmed present before citing." },
  { "id": "A22", "read_at": "2026-08-02T04:18:30Z", "source_file": "ThinkerThinker.md", "line_range": "57-58", "why_it_governs": "Citations require session-reading.", "how_this_build_will_embody_it": "This manifest + Session-Reads trailer." },
  { "id": "A26", "read_at": "2026-08-02T04:18:30Z", "source_file": "ThinkerThinker.md", "line_range": "67", "why_it_governs": "A found need is a class — check for other labor-mix computations.", "how_this_build_will_embody_it": "Section 4: none exist; no duplication." },
  { "id": "A30", "read_at": "2026-08-02T04:18:30Z", "source_file": "ThinkerThinker.md", "line_range": "91", "why_it_governs": "Encode the lesson where the future edit meets it.", "how_this_build_will_embody_it": "The script header states the model + the honesty rule inline." },
  { "id": "A38", "read_at": "2026-08-02T04:18:30Z", "source_file": "ThinkerThinker.md", "line_range": "95", "why_it_governs": "'Verified' = a command run.", "how_this_build_will_embody_it": "check.md pastes the actual live run (N=6 baseline)." }
]
```
