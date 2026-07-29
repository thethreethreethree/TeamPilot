# CLOSURE — doc-upload audit remediation

## 1. Session-read manifest

13 entries in think.md (this-session read_at), validated by verify-manifest.mjs. Clauses re-read:
CLAUDE.md §0, §0.1, §1.5.1, §1.5.2, §6; ThinkerThinker.md A19, A22, A26, A27, A30, A31, A33, A38.

## 2. Build inventory (reachability per A31)

| Fix | write path | read path | status |
|---|---|---|---|
| F5 cap align (500k→100k) | extractText MAX_EXTRACTED_CHARS | extracted text fits editor → Save enabled | BUILT |
| F3 byte cap (15MB→4MB) + client pre-check | route + DocUploadButton | oversized → friendly 413/toast, not opaque | BUILT |
| F2 decode &amp; last | decodeEntities order | `&amp;lt;`→`&lt;` | BUILT |

## 3. Verification record (A38)

```
> npm run check   (typecheck · lint · theme:audit · rls:audit · invariant:audit · tbc · test)
  invariant:audit — Violations: 0
✓ tbc:docs ✓ tbc:manifest ✓ tbc:artifacts ✓ tbc:residual ✓ tbc:freshness
      Tests  1647 passed | 15 skipped (1662)
CHECK_EXIT=0
```

Coverage: all gates + full suite, exit 0. UNTESTED: the live browser upload of a >4MB file (client
pre-check verified by code inspection, not an e2e run) — noted, not claimed green.

Targeted before the full run: `npx tsc --noEmit` exit 0; extractText 13/13 (incl. F2 + F5 gates).

## 4. Findings ledger

| # | severity | disposition | class boundary swept |
|---|---|---|---|
| F5 | MEDIUM | FIXED (gate) | corpus/product editors + saves all cap 100k; extraction was the lone 500k |
| F3 | MEDIUM | FIXED (promise + residual) | only function-body upload over the platform cap (storage=signed-URL, logo=2MB) |
| F2 | LOW | FIXED (gate) | extractText.decodeEntities is the sole decode-logic site |
| F1 | MEDIUM/LOW | DECLINED (A33) | extractText is the sole server-side archive-decompress site |
| F4 | LOW | DECLINED (A33) | inherent to accepting .txt; manager-review mitigates |

## 5. Gates added

- F5: `MAX_EXTRACTED_CHARS <= 100_000` + a >cap doc extracts to ≤100k (fails if extraction cap drifts
  above the field cap again).
- F2: `&amp;lt;` → `&lt;` (fails if `&amp;` is decoded before named entities again).

## 6. Residual queue (A36)

```json
[
  {
    "id": "RES-2026-07-30-DUR-04",
    "item": "Binary-as-text: a non-text file renamed .txt decodes to replacement-character garbage rather than being rejected (F4).",
    "why_skipped": "'Is this actually text?' has no precise detector without false positives (a valid UTF-8 doc with unusual bytes trips a heuristic) — A33 declines the noisy gate.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-07-30T01:50:00Z",
    "outcome": "OPENED (per Prompt 3 step 4 — the highest-confidence-irrelevant entry). Reviewed adversarially: the ONLY path to harm would be garbage silently reaching the coach prompt. It does not — extraction FILLS THE DRAFT and the manager reads + Saves it (the founder's explicit review step), so a human sees the garbage before it is persisted or prompted. The .txt/.md arms also produce visible mojibake (not silent), making it obvious in review. So the missing gate genuinely does not matter here: the review step IS the control. If upload ever becomes auto-save-without-review, this must be revisited (add a printable-ratio heuristic then). No code change."
  },
  {
    "id": "RES-2026-07-30-DUR-01",
    "item": "Zip-bomb: a .docx/.odt/.epub entry is fully decompressed before the char cap (F1).",
    "why_skipped": "jszip exposes no public streaming byte cap; the per-entry uncompressed size is a private field. A pattern gate would fire on every legitimate .async call.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-07-30T01:51:00Z",
    "outcome": "OPENED. Bounded by: manager-gate (attacker must be a tenant admin), self-tenant (they DoS their own request), the 4MB input cap (F3, shrinks max input), and Vercel memory/maxDuration (the function is killed, no persistence). Blast radius = one of the manager's own extract requests failing. If jszip is ever replaced with a streaming unzip (e.g. fflate's streaming API, already installed) that can abort past N bytes, wire the bound then. Declined gate is honest for now."
  },
  {
    "id": "RES-2026-07-30-DUR-03",
    "item": "The 4MB cap assumes Vercel's default ~4.5MB serverless body limit; the deploy's actual limit is unconfirmed from here (F3).",
    "why_skipped": "The platform limit is a deploy/plan setting not visible to code or a unit test.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-07-30T01:52:00Z",
    "outcome": "OPENED — it matters for the exact ceiling. 4MB is safe under Vercel's documented default; if the deploy allows more, the cap can rise (change one constant in the route + DocUploadButton, kept in sync by the shared value). Founder-verifiable in 1 min via a test upload. Recorded so the cap is a known knob, not a guess frozen in."
  }
]
```

Top-ranked residual (DUR-04, high) opened with an outcome per A36 + Prompt 3 step 4.

## 7. Hypothesis outcomes

- **H1** (cap align fixes F5, no regression) — CONFIRMED (13/13; 300k→100k).
- **H2** (&amp; last fixes F2) — CONFIRMED (gate + existing entity test both pass).
- **H3** (F1 has no clean gate; decline honest) — CONFIRMED (jszip private field; declined + residual).

## 8. Un-named reliance (A35) — clauses I leaned on but did not cite in the manifest

- **A28 (precedent decides):** I read the corpus route to learn the 100k field cap that F5 aligns to —
  relying on the existing pattern, not a chosen number. Opened: the field cap IS the precedent; F5 follows
  it rather than inventing a cap. Worth a manifest entry next time; noted here honestly.
- **A29 (mine recent fixes for siblings):** the sweep for F1/F2 siblings leaned on A29's discipline. Opened:
  no unswept sibling found (extractText is the sole site of each class). Named here so the reliance is on record.

## 9. Doc hashes

- CLAUDE.md — `e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f`
- ThinkerThinker.md — `0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc`
