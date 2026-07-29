# CLOSURE — Sales Coach doc upload + objection injection

## 1. Session-read manifest

14 entries in think.md's manifest, each with a this-session read_at (validated by verify-manifest.mjs).
Clauses re-read this session: CLAUDE.md §0, §0.1, §1.5.1, §1.5.2, §6; ThinkerThinker.md A19, A22, A26,
A27, A28, A30, A31, A33, A38.

## 2. Build inventory (reachability per A31)

| Feature | write path | read path | status |
|---|---|---|---|
| Multi-format extraction | extractText(buffer, filename) | {text, format} into the editor | BUILT |
| Upload endpoint | POST /extract (manager, 15MB, typed errors) | JSON text → DocUploadButton | BUILT |
| Upload UI (both editors) | file input → onExtracted → setText | draft fills → existing Save → prompt | BUILT |
| Objection rules → both modes | extractObjectionGuidance(full methodology) | injected block in live-cue + roleplay review prompts | BUILT |

## 3. Verification record (A38)

```
> npm run check   (typecheck · lint · theme:audit · rls:audit · invariant:audit · tbc · test)
  invariant:audit — Documented exceptions: 13 · Violations: 0
✓ tbc:docs ✓ tbc:manifest ✓ tbc:artifacts ✓ tbc:residual ✓ tbc:freshness
      Tests  1637 passed | 15 skipped (1652)
CHECK_EXIT=0
```

Coverage: all gates + the full test suite, exit 0. Dogfood: `npm run tbc:revision` → 6/6 requested-change
items dispositioned → exit 0. The added upload route is documented in the invariant-audit allowlist with
the reason its inline extension-allowlist validation is stronger + better-fit than the storage path.

Targeted before the full run: `npx tsc --noEmit` exit 0; extractText 11/11; objectionGuidance 4/4; PDF
proven live (unpdf, 7,248 chars from a real PDF — check.md).

## 4. Findings ledger

No findings.

## 5. Gates added

None new. extractText's format boundary + objectionGuidance's precedence are unit-pinned (the precise,
testable form, A30/A33) rather than gated.

## 6. Residual queue (A36)

```json
[
  {
    "id": "RES-2026-07-30-UP-01",
    "item": "The live-cue prompt now carries an added objection block (bounded 800 chars) on the latency-critical real-time path — a small but real per-cue token/latency delta not measured live.",
    "why_skipped": "Measuring live-cue latency needs a running deployment + real cue traffic; the block is bounded and only present when the methodology has objection content.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-07-30T00:55:00Z",
    "outcome": "OPENED. Reviewed: the block is capped at 800 chars and null when there are no objection rules, so the added cost is bounded and conditional. The founder's requirement (objection rules must drive live cues) cannot be met without SOME added context on this path; 800 chars is the smallest that reliably carries a rule set. If live-cue latency regresses, the cap is the first knob. Tracked."
  },
  {
    "id": "RES-2026-07-30-UP-02",
    "item": "PDF extraction of heavily letter-spaced / unusual-font PDFs produces spacing artifacts (the smoke test showed 'B U I L D' for a letter-spaced heading); scanned/image-only PDFs have no text layer and correctly raise EmptyExtractionError (no OCR).",
    "why_skipped": "Robust OCR + perfect glyph-spacing reconstruction is a large, separate concern; unpdf covers text-layer PDFs, which is the common case for exported documents.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-07-30T00:56:00Z",
    "outcome": "OPENED — it matters for edge PDFs. Normal prose PDFs (Word/Docs exports) extract cleanly; letter-spaced display text is cosmetic and the manager reviews the draft before saving (the review step catches it). Scanned PDFs fail honestly (EmptyExtractionError → a clear 'no readable text' message) rather than silently. OCR is the follow-up if clients hit it; recorded so it isn't presented as fully solved."
  }
]
```

Top-ranked residual (UP-01, medium) is opened with an outcome per A36.

## 7. Hypothesis outcomes

- **H1** (.docx/.odt/.epub need no new dep — jszip) — CONFIRMED.
- **H2** (objection rules truncated out today) — CONFIRMED (live-cue 600, roleplay 4000); fixed by the
  un-truncated objection block.
- **H3** (no migration needed) — CONFIRMED (reuses corpus/product store + endpoints).
- **H4** (a bad upload must not crash / bleed across formats) — CONFIRMED (typed per-format errors → 4xx;
  size + char caps; generic 500 on parser throw).

## 8. Doc hashes

- CLAUDE.md — `e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f`
- ThinkerThinker.md — `0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc`
