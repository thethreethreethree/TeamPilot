# CLOSURE — CWE-209 nested-.message gate

## What shipped
Invariant 14 (CWE-209) now detects the NESTED raw-`.message` shape (`error: fc.error.message`) that let
finance/forecast leak a raw RPC error past the one-hop regex (fixed in xi). The direct alternative gained an
optional intermediate property; a permanent detection-test (invariant 14 had none) locks the nested/direct/
interpolated/catch shapes as matches and the controlled shapes as non-matches, and binds the widening to the
script so it can't be silently reverted. 0 violations on the current tree — this is a regression guard.

## Un-named reliances (A35 — name them)
- **The terminal `.message` is the raw-exception signal.** The widening stays low-noise only because it still
  requires `.message` at the end; controlled result fields (`auth.error`, `result.error`) don't, so they're
  excluded by construction, not by allowlist.
- **The `status 400-429` / `kind:` exclusions still hold.** A legitimately-surfaced nested `.message` at a
  domain/validation status or in an LlmError window is still excluded, unchanged.
- **The detection-test's regex copy mirrors the script.** The `SCRIPT.toContain(...)` assertion is what keeps
  the copy honest — if the script is narrowed, the toContain fails even though the inline copy would still pass.

## Residual (A36 — ranked by confidence-it-does-not-matter; top must be OPENED)
```json
[
  { "id": "R1", "item": "The broader { error: X.error } (non-.message FIELD) widening — a result object carrying a raw string in a field that does NOT end in .message.", "why_skipped": "Genuinely needs cross-file analysis (is result.error raw or curated?), which a route-level regex can't do without a large brittle allowlist of every controlled helper. A33 — don't ship a noisy gate.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-11T18:45:00Z", "outcome": "Opened: the two real instances of THIS field-shape (files/upload-url target.error, knowledgeDocs error?.message-into-.error) are already FIXED (xh, xi) and their routes/helpers now return literals, so there is no live leak of this shape to gate against today. The gate would be purely preventive for a future helper — and the better place for THAT is at the helper (a `return { ok:false, error: <raw> }` lint in src/lib), not the route. Deferred deliberately, not forgotten; the whole-app grep in xi is the current safety net." },
  { "id": "R2", "item": "The instanceof-Error catch alternative was NOT widened to nested access.", "why_skipped": "The `X instanceof Error ? X.message` catch shape is always on a caught Error (one hop); a nested form there is not a real code shape. Left as-is to avoid regex bloat.", "confidence_it_does_not_matter": "medium", "opened_at": null }
]
```

## Gate result (`npm run check`)
```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ · rls:audit ✓
invariant:audit ✓ — Violations: 0
tbc ✓ — docs · manifest (10) · artifacts · residual (2) · freshness all ✓
test ✓ — Test Files 390 passed | 1 skipped (391); Tests 2684 passed | 15 skipped (2699)
CHECK_EXIT=0
```
