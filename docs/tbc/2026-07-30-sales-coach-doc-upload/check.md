# CHECK — Sales Coach doc upload + objection injection audit

Audited the built files from the outside-view stance.

## Within-module pass (four layers)

- **1 structure:** extraction is one pure module with an explicit format allowlist (A33); the route + UI
  reuse the existing manager-gate + editor-save flow (A28); objection injection is one pure bounded
  function fed into two existing prompt paths. No schema change.
- **2 effectivity:** extractText test 11/11; objectionGuidance test 4/4; PDF proven on a real file:

```
=== live PDF smoke test (unpdf on a real repo PDF) ===
PDF chars extracted: 7248
sample: "B U I L D A U D I T · 1 0 0 % H O N E S T\n7-Day Build Audit\nEvery initiative you directed "
```

  Full `npm run check` output + exit code in closure.md.
- **3 composition:** upload FILLS the draft, leaving the manager in the existing review→Save flow
  (continuity, not a dead end); unsupported formats leave a clear next action (export + re-upload). The
  objection block flows into the SAME prompts the methodology already feeds.
- **4 surface:** an unobtrusive "Upload a file" control on each editor with the supported formats in its
  title; a toast confirms the load + warns on truncation.

## Cross-module pass

- The uploaded text enters the SAME prompts client-authored methodology already enters — no new
  prompt-injection trust boundary (the content is the client's own, self-tenant).
- The extract route never persists — it only returns text; persistence stays in the existing
  manager-gated /corpus|/product endpoints, so no new write authority was created.

## Class sweep (A26)

class: methodology truncation silently dropping objection rules. sweep: `grep -rn "slice(0, [0-9]" src/lib/coach/v5/liveCue.ts src/app/api/coach/sales-session/roleplay/route.ts` → the two truncation sites (live-cue 600, roleplay 4000) BOTH now receive the un-truncated objection block; both injection points covered. The prep/dissect paths inject the full corpus already (not truncated), so they are unaffected.

class: one format's parser failure taking down the others. sweep: each format is a separate switch arm; a throw becomes a typed error the route maps to a 4xx/500 — no bleed. Zip formats bounded by MAX_EXTRACTED_CHARS (zip-bomb guard) + the route's 15MB input cap.

## Findings

No findings. Additive; manager-gated; tsc-clean; unit-pinned + a live PDF proof. (remediate.md omitted.)

## Inspected / not-inspected

- **Inspected:** the extractor (all arms + rejections), the route (auth/size/error mapping), the UI wiring
  into both editors, the objection injection into both prompt paths, corpus?.content reaching reviewSystem.
- **NOT inspected (→ residual):** live end-to-end upload through a browser against a deployed build;
  extraction fidelity of every real-world .docx/.pdf variant (letter-spaced PDFs extract with spacing
  artifacts); the live-cue token-cost delta from the added objection block.
