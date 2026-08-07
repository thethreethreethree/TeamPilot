# CLOSURE — Sales Coach Extension, Phase 1a: text-in sales dissect

## What shipped
The first verifiable slice of the standalone Sales Coach extension: a text-in sales dissect engine
(`generateSalesTextDissect`) and its route (`POST /api/coach/extension/dissect`), reusing the shared
extension guard, the shared coach LLM, and the shared injection fence. Text-in → a grounded sales read
(what's working / opportunity / next move + a §3.3 guiding question) → honest-empty on thin input.

## Un-named reliance (not self-evident)
- **This is SUBSTRATE, not a shippable end-feature.** No browser client posts to the route yet. The
  reachability seam is deliberately half-wired (see check.md) and must not be reported as a live user
  feature until Phase 2 wires the client. Building the client first would be dead surface; building the
  server first is the correct order because the server is the half this sandbox can actually verify.
- **The engine is text-in for a reason.** The v5 `generateSalesDissect` needs speaker-labeled segments from a
  DB session; the extension only has raw viewed text. Do not "unify" them — they serve different inputs. This
  mirrors the C.A.R.E split (`generateConversationDissect` text-in vs the in-app segment path).
- **Grounding is the honesty contract.** Every strength must quote a real line or it is dropped. Do not relax
  the whole-excerpt match to a prefix match — that reopens the "real opening + fabricated tail" hole the
  C.A.R.E engine's comment warns about.
- **Standalone extension = the CLIENT is separate; the SERVER guard is shared on purpose.** The founder chose
  a separate extension package, but the server-side `guardExtensionRequest`/entitlement is product-neutral
  infrastructure and is reused (not duplicated) — a separate client can still authenticate through the same
  server gate.

## Flagged, not fixed (§3.3)
- None new. The remaining toolset (coach-reply, co-pilot, live-cue) and the client package are sequenced
  Phase 2, recorded in the project memory, not skipped.

## Residual (A36)
```json
[
  { "id": "RES-01", "item": "No browser client posts to /api/coach/extension/dissect yet — the human-facing seam is unwired.", "why_skipped": "Phase 1a is the verifiable server substrate; the client package (manifest/panel/adapters) is Phase 2, and its selectors are unverifiable in this no-browser sandbox. Building the client first would be dead surface.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-08T04:20:00Z", "outcome": "OPENED — Phase 2 builds the standalone client package + wires the panel to this route." },
  { "id": "RES-02", "item": "Rep-vs-prospect attribution on an unlabeled external thread relies on the LLM + a rep-name anchor, not verified labels.", "why_skipped": "The extension has no ground-truth speaker labels for an external DM/email; the rep-name WHO-IS-WHO anchor is best-effort (a miss degrades, never fabricates — same posture as the C.A.R.E extension). Live confirmation belongs with per-platform adapter verification in Phase 3.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-08T04:20:00Z", "outcome": "OPENED — revisit with per-platform adapter labeling in Phase 3." }
]
```
