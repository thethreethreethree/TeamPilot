# BUILD — capture preview

Two changes: the panel affordance (extension, non-enforced path) and its detection test (src, enforced path).

### capture-preview affordance
- **write-path:** `extension-sales/content.js` — `setSelection()` selinfo branch.
- **read-path:** rendered into the closed shadow root's `#sc-selinfo` on every capture (auto-capture on open +
  the Capture button + adapter/manual paths all route through `setSelection`).
- **what:** when the captured text is non-empty, the selinfo line now shows `N characters captured [ (trimmed
  to fit) ] — "<first ~90 chars, whitespace-collapsed>…"` instead of the bare count. Empty capture still reads
  "No conversation captured yet". Written via `textContent` (page text cannot inject markup). `currentSelection`
  (the payload) is unchanged — the preview is a read-only projection of it, bounded to 90 chars with an ellipsis.
- **why:** a broad Tier-2 selector can return plausible non-empty garbage; a bare count looks identical to a
  correct grab, so the rep would coach on the wrong content (§3.4 for input; A39 boundary). The preview makes a
  wrong grab self-evident → the rep re-highlights manually (the always-correct path). No live-selector
  verification needed — the human is the check.

### detection test for the preview
- **write-path:** `src/lib/coach/extension/__tests__/salesExtensionClientWiring.test.ts` — new `it(...)` beside
  the existing truncation guard.
- **read-path:** `npm run test` (vitest) reads `content.js` as source text and asserts the preview substrings.
- **what:** asserts `slice(0, 90)` and a `characters captured … preview` render are present in the panel
  source. Source-substring form matches the file's existing guards (the panel is runtime-unverifiable — shadow
  DOM / no browser in the sandbox).
- **why (A30):** encode the class in a gate that fails on recurrence, not prose. This test fails on the
  pre-fix count-only string, so a future revert to "count only" is caught mechanically.
