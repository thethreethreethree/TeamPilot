# CLOSURE — C.A.R.E doc upload + Jeff guidance field

## 1. Session-read manifest

13 entries in think.md (this-session read_at), validated by verify-manifest.mjs. Clauses re-read:
CLAUDE.md §0, §0.1, §1.5.1, §1.5.2, §6; ThinkerThinker.md A19, A22, A27, A28, A30, A31, A34, A38.

## 2. Build inventory (reachability per A31)

| Feature | write path | read path | status |
|---|---|---|---|
| Jeff guidance field | JeffGuidancePanel → tenant PATCH → ai_assistance_guidance | mapper → 2 callers → Jeff's prompt block | BUILT |
| Upload × 3 surfaces | DocUploadButton → care extract route → draft | extracted text → existing save | BUILT |
| A34 coupling | save-guard drops missing column + retries | select(*) omits absent col → null | BUILT |

## 3. Verification record (A38)

```
> npm run check   (typecheck · lint · theme:audit · rls:audit · invariant:audit · tbc · test)
  invariant:audit — Violations: 0  ("every upload route validated" passes — care extract route allowlisted)
✓ tbc:docs ✓ tbc:manifest ✓ tbc:artifacts ✓ tbc:residual ✓ tbc:freshness
      Tests  1654 passed | 15 skipped (1669)
CHECK_EXIT=0
```

Coverage: all gates + full suite, exit 0. Dogfood: `npm run tbc:revision` → 10/10 J-items → exit 0.

Targeted: `npx tsc --noEmit` exit 0; careGuidancePrompt 3/3; care extract route 4/4; widgetSafe 3/3.

## 4. Findings ledger

No findings. New prompt-feeding field reaches every real reply path (not dead surface); the guidance is
admin config scoped within Jeff's core rules; the new upload route is admin-gated + allowlisted.

## 5. Gates added

- careGuidancePrompt test: the guidance block appears when set (scoped within core rules) + absent when not.
- care extract route test: admin-gate + format boundary (401/403/415/200).
- widgetSafe test: the new field cannot leak to the public widget.

## 6. Residual queue (A36)

```json
[
  {
    "id": "RES-2026-07-30-CARE-02",
    "item": "The Jeff guidance cap is 8k chars (matching product-context). A company with lengthy assistance guidance would be truncated.",
    "why_skipped": "8k keeps every-reply prompt bloat/latency down (guidance feeds EVERY Jeff reply, unlike the 100k sales methodology which feeds a post-call review). The right cap is a product judgment.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-07-30T02:20:00Z",
    "outcome": "OPENED (top-ranked). Reviewed: 8k is ~1200 words — ample for escalation rules + do's/don'ts + brand posture (the intended content), and the upload's `truncated` flag + 'trimmed to fit' toast make truncation visible, not silent. A company needing more usually wants FACTS (→ Adaptive Knowledge, 200k) not more behavioral guidance. If real guidance regularly exceeds 8k, raise the cap in ONE place (the tenant-route zod + JeffGuidancePanel MAX_CHARS + the extract maxChars the panel passes). Not a defect; a tunable."
  },
  {
    "id": "RES-2026-07-30-CARE-01",
    "item": "Live behavior against an APPLIED 0202 is not yet exercised — the migration was written but not applied by me.",
    "why_skipped": "Applying a migration needs the DB URL / founder; the code is A34-guarded to degrade until then.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-07-30T02:21:00Z",
    "outcome": "OPENED — matters for full effectivity. Pre-apply: config omits the column → null → no guidance block (Jeff unchanged); a guidance SAVE returns assistanceGuidanceDeferred → the editor says 'migration pending'; OTHER settings still save. Post-apply verification (set guidance, confirm Jeff follows it; upload a PDF into each surface) is the founder/live step. Tracked in docs/BUILD-STATE.md."
  },
  {
    "id": "RES-2026-07-30-CARE-03",
    "item": "Live browser upload on each of the three C.A.R.E surfaces is not yet exercised end-to-end (extractor + route proven; the per-surface wiring is confirmed by tsc + reading, not a click-through).",
    "why_skipped": "Needs a running deployment + a real browser.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-07-30T02:22:00Z",
    "outcome": "OPENED. The route is test-locked (4/4) and the extractor proven (13/13 + live PDF); each surface passes the same DocUploadButton the sales-coach surfaces use in production. A 60-second click-through per surface is the residual confirmation."
  }
]
```

Top-ranked residual (CARE-02, medium) opened with an outcome per A36.

## 7. Hypothesis outcomes

- **H1** (A34-safe) — CONFIRMED. **H2** (guidance reaches replies, scoped) — CONFIRMED. **H3** (one
  extractor + reusable button, per-field caps) — CONFIRMED.

## 8. Doc hashes

- CLAUDE.md — `e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f`
- ThinkerThinker.md — `0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc`
