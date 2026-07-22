# Closure — C.A.R.E extension: 4 SOON tools made live + download distribution + platform coverage (2026-07-22)

Follows the panel/adapters/CORS closure (`2026-07-22-care-extension-panel.md`). This records the founder-directed
milestone that took the extension from "2 live tools + 4 SOON" to **all 6 tools live, downloadable from the
website, across 11 platforms** — plus the first live-DOM adapter fix from the founder's load-test.

## What shipped (all on `main`, pushed; full `npm run check` gate green — 1176 tests)

| Element | Commit(s) | Verification |
|---|---|---|
| 4 tool server endpoints (copilot/formulate/coach/spawn) + shared `validateCoachAnalysis` + shared prompts | `f473a367` | 18 route tests |
| Panel wiring — endpoints, draft/intent input form, rich per-shape rendering, worker input forwarding | `40fdd0a4` | tsc/lint/tests |
| Spawn draft links back to the workspace (workflow-continuity) | `0e030222` | reasoned |
| Slack adapter (11th platform) | `fe6554a6` | routing test |
| WhatsApp label polish → then LIVE-FIX (`[data-pre-plain-text]`) | `b2465b16`, `6d878a43` | founder load-test + 2 extraction tests |
| Download-from-website: `/extension/download` page + `public/care-extension.zip` (jszip, deterministic, prebuild/predev) + Care nav link + `/care/demo` CTA | `c35b38b5`, `8605ad65`, `44035822` | tsc/lint/theme |
| Adapter-status table (load-test asset) | `dcd26da2` | — |
| Fixed self-introduced CORS-invariant test regression | `d1e710c4` | 7/7 |

## The 4 tools (text-in mirrors of the in-app C.A.R.E tools — SAME engines, no drift §3.4)
- **AI Co-Pilot** → `{reply, reasoning}` (`CO_PILOT_SYSTEM`) — drafts the next reply + names the move (§A18); the
  reasoning is rendered as an internal note **excluded from the Copy button** so it never reaches the customer.
- **Formulate C.A.R.E** → `{reply, reasoning}` (`FORMULATE_SYSTEM`) — shapes the agent's INTENT into a reply (§A8).
- **Ask Coach** → `{coach: CoachAnalysisResponse}` (`analyzeCoachV5` + shared validator) — grades a DRAFT vs the
  books. The 80-line validator was extracted to `validateAnalysis.ts` and adopted by the in-app route too (§A26).
- **Spawn task** → `{task}` | `{suppressed}` (`buildSpawn*` + `spawnTask`) — structures the conversation into a
  task DRAFT.

## Decisions made (and why)
1. **A3 applied per-tool.** Coach/Co-Pilot/Formulate act on the user's EXTERNAL conversation (same class as
   Summarize/Dissect) → NOT control-gated. **Spawn** reaches into the team's INTERNAL work → IS §3.4-gated
   (companyId → spawnTask; month-1 returns `{suppressed}`).
2. **Spawn returns a draft, does NOT persist** (§3.3 guide-don't-overtake). One-click create-and-persist from the
   extension is the governed internal-chain write — left for an explicit founder yes/no.
3. **Download package is a build artifact, not committed.** Regenerating it surfaced same-turn staleness; it's
   now gitignored and built fresh on `prebuild` (deploy) + `predev` (local), always matching source. `jszip`
   promoted to an explicit devDependency (was a fragile transitive-via-docx base for a build script).
4. **Adapters are fixed on live evidence, not speculation.** WhatsApp's exact-class selectors failed the live
   DOM; re-anchored on the `[data-pre-plain-text]` attribute (robust). The other 10 are NOT blind-rewritten — a
   wrong speculative selector matches the wrong content and won't fall through (regression risk). Each ⏳ in the
   README status table is confirmed or fixed as the founder tests it. **Lesson: attribute/role anchors survive
   redesigns; exact class names are the fragile kind.**

## Open — founder-gated
1. **Load-test** the 6 tools + 11 adapters (README 14-step checklist + per-platform status table). Reload the
   unpacked extension to pick up the WhatsApp fix. Report any adapter that reads empty → I re-anchor it.
2. **Spawn one-click persist** — yes/no on the governed internal-chain write.
3. **Meta Business Suite** (`business.facebook.com`) WhatsApp Business inbox — add or not.
4. **Seat model** (extensionAuth tenant-wide vs agent-only) and **CWS** submission ($5 + screenshots) still stand
   from the panel closure.
