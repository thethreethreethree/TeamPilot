---
tbc_version: 1
trigger: feature
started_at: 2026-08-01T22:30:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 10
hypotheses: 1
---

# THINK — inject a customer-service philosophy into the C.A.R.E system

## 1. Document integrity (§0.1) — MATCH

CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) MATCH DOC_MANIFEST. Methodology sources for THIS
build are the two founder-provided documents in the working tree (`docs/Amex 500 sample messages.pdf`,
`docs/Transcript (Chris)…Horst Schulz.pdf`) — both read this session before acting.

## 2. Why (founder directive — decision gathered first)

Founder: "inject the philosophy and the methodology in these two … C.A.R.E only." The two sources:
- **Horst Schulz (Ritz-Carlton co-founder) transcript** — the PHILOSOPHY + service-recovery methodology:
  make the customer feel *seen* (service is won/lost there); every employee OWNS the problem AND the
  solution; the recovery sequence Listen → Empathy → Apologize-as-your-own → **full amends ("50% is not
  making amends" — a half-measure is insulting)**; tell the truth ("we messed up"); the pointing-finger
  rule (don't point — *take them there*); one standard: "we are here to care for people."
- **Amex 500-message dataset** — the per-message STRUCTURE + tone: every message = **Acknowledge → Empathy
  → Reassurance → Next Step → Proactive Value → Warm Close**, in a premium/warm/calm/reassuring/proactive
  register. The 500 samples prove the structure folds into 2-4 sentences (compatible with brevity).

The two compose: Schulz = the WHY + recovery; Amex = the SHAPE of every reply.

## 3. Design + interconnection (holistic ripple trace, §1.5.1)

- **Layer 1 (structure):** ONE source of truth — `SERVICE_PHILOSOPHY` constant in `src/lib/care/
  servicePhilosophy.ts` — mirroring the codebase's shared-prompt discipline (`CONVERSATION_IS_DATA`). No
  copy in 5 places to drift.
- **Layer 2 (effectivity):** wired into ALL FIVE reply-drafting surfaces so the whole system speaks one
  standard: customer-facing auto-reply (`buildCareSystemPrompt`), in-app + extension Co-Pilot, in-app +
  extension Formulate. Summarize is a READ (not a reply) → deliberately excluded.
- **Layer 3 (composition):** ordering matters. Identity+honesty rules emit FIRST (the instruction
  baseline), THEN the philosophy (shapes HOW), THEN tenant/customer content, THEN the injection fence LAST.
  So the philosophy never overrides honesty and the untrusted-data fence stays the final word.
- **IP protection (existing rule):** the SOURCES are internal IP — deliberately NOT named in the prompt
  (no "Ritz-Carlton"/"Amex"). The customer experiences the behavior, never the framework — the same rule
  the customer-facing prompt already follows (prompt.ts header).

## 4. Hypothesis / risk

Risk: the "full amends, no half-measure" recovery could push the AI to PROMISE refunds/credits it cannot
grant (violating the existing "never grant a refund/exception — hand off" honesty rule). MITIGATION: the
recovery clause is scoped — own it + tell the truth emotionally, but when the remedy isn't the AI's to
grant, hand off warmly; never promise a remedy it can't deliver. The philosophy text explicitly defers to
the honesty/handoff rules. Verified by the honesty rules emitting first + the explicit deferral line.
