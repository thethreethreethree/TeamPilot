---
tbc_version: 1
trigger: fix
started_at: 2026-08-12T02:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 16
hypotheses: 2
---

# THINK — uploaded-recording sessions never generate a summary ("new sessions have no summary page")

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes verified. Governing methodology for
this fix: §2 (diagnose before patching), §1.5.1 Layer 3 (a feature that completes technically but breaks the
downstream workflow is incomplete), §1.2 (retrospective identification from the record).

## 2. The report (founder, 2026-08-12)
"On the old session you can see the summary page. But on the new sessions, we can't see the summary page
anymore. Fix it where, when users go to sessions they can see the summary page. Just for the SESSIONS
module/system."

## 3. Diagnosis (§2 — NOT a forward guess; traced through the code + git record)
The Sales Coach post-call artifacts (Conversation **summary**, dissect, pivot, moments, intel) that power the
Conversation-summary surface, the After-Pitch "What happened", and the Sessions-list "Summary" badge are
generated ONLY by `runAndStore*` engines, which are invoked from exactly TWO server routes:
- **/finalize** — called from ONE place: `useLiveCoaching.ts:737`, on Stop of a **LIVE** coaching session.
- **/summarize** POST — a manual tool button (SessionCoachTools).

The recent feature `0a873a3c` (2026-08-11, "mobile recording + voice-memo upload on every session") added a
SECOND way to create a session's transcript: **upload a recording** → `/upload-recording` (transcribe +
diarize) → `/label-transcript` (append the labeled transcript after the "which voice is you?" tap). Tracing
that path: `/upload-recording` and `/label-transcript` append the transcript but **never call finalize or any
`runAndStore*`** — `label-transcript`'s own comment even says generation "writes via /finalize + /segments
(NOT this route)". So an uploaded-recording session ends up with a transcript and NO summary/dissect/pivot/
moments/intel.

Therefore:
- **"Old sessions" = LIVE sessions** → `/finalize` ran on Stop → artifacts generated → summary shows.
- **"New sessions" = UPLOADED-recording sessions** (the new feature the founder is now using) → only
  `/label-transcript` ran → no generation → `GET /summarize` returns null → the Conversation-summary section
  (`summary || moments || pivot || intel`) renders nothing and the Sessions "Summary" badge is false.

This is a §1.5.1 **Layer-3 gap in feature 0a873a3c**: the upload feature is technically complete (the
transcript is appended, the surface returns 200) but breaks the workflow it lives inside — the summary the user
expects downstream never gets generated. (The Standard-mode After-Pitch "Your read" DOES show for uploaded
sessions, because that page auto-generates its OWN narrative from the transcript — which is why the gap
presents specifically as "the summary page is missing", not "everything is blank".)

## 4. Record check (§1.2) — is the omission intentional?
No. `/finalize` exists precisely to generate these artifacts server-side and reliably ("admins must reliably
receive the complete Dissect for every session"). The uploaded path is a newer transcript source that simply
was not wired to the same generation — an omission, not a design choice to withhold summaries from uploads.

## 5. The fix (mirror the existing mechanism — A16/A28, don't invent one)
Extract `/finalize`'s five-engine generation block into a shared `generateSessionArtifacts()` (A16
drift-guard — the 40s-timeout change had to touch finalize AND summarize precisely because such blocks were
duplicated), and call it from `/label-transcript` after the labeled transcript is appended — so an uploaded
session generates the IDENTICAL artifact set a live session gets. Run it via `after()` (post-response,
server-side) so the label response returns immediately (no 40s spinner — the founder already flagged
"never look frozen", `e1f9716b`); the engines use the admin client + explicit companyId/actorId, so they don't
need the request scope. `maxDuration = 60` keeps the function alive for the after() work (and satisfies the
"every LLM route exports maxDuration" invariant now that this route does LLM work).

## 6. Hypotheses (§1.5.2)
- **H1 — does the finalize refactor change live-session behavior?** No: the extracted helper is the same block
  verbatim (same engines, same timeouts, same fallbacks, same return destructuring). The finalize route tests
  (owner gate, generation) stay green. CONFIRMED (finalize test 4/4 + label 8/8 → 12 total).
- **H2 — can the new generation double-fire or run ungated?** No: `/label-transcript` 409s if a transcript
  already exists, so generation only fires on the FIRST successful label (natural once-guard); it is gated on
  `appended > 0` AND a non-null `companyId` (never runs without company context — the §3.4/§A21 control gate).
  CONFIRMED by the two added tests (409 → not called; null company → not called).

## 7. Scope (founder: "just for the SESSIONS module/system")
Only Sales Coach session routes + one sales-coach lib helper are touched. No C.A.R.E / finance / other module
is affected.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-12T02:00:30Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understanding precedes solving — trace WHY the summary is missing before changing anything.", "how_this_build_will_embody_it": "Section 3 traces the two generation entry points + the uploaded path's missing wiring from the code + git record, not a guess." },
  { "id": "§0.1", "read_at": "2026-08-12T02:00:30Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Governing-doc hashes verified in-tree." },
  { "id": "§1.2", "read_at": "2026-08-12T02:01:00Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Retrospective identification — map 'old vs new' to the actual record (live vs uploaded, feature 0a873a3c).", "how_this_build_will_embody_it": "git log + the finalize/label-transcript sources located the exact regression source." },
  { "id": "§2", "read_at": "2026-08-12T02:01:05Z", "source_file": "CLAUDE.md", "line_range": "208-230", "why_it_governs": "Diagnose before patching — do NOT propose a fix until the root cause is stated from the record.", "how_this_build_will_embody_it": "Section 3 states the root cause (uploaded path never wired to generation) before any change; no speculative patch." },
  { "id": "§1.5.1", "read_at": "2026-08-12T02:01:20Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer framework — Layer 3: a feature that returns 200 but breaks the downstream workflow (no summary) is incomplete.", "how_this_build_will_embody_it": "The fix completes the uploaded-recording workflow so the summary the user expects is produced; holistic check confirms no live-flow regression." },
  { "id": "§1.5.2", "read_at": "2026-08-12T02:01:35Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Proactive audit — THINK about failure modes (double-fire, ungated, after()-scope) before wiring.", "how_this_build_will_embody_it": "Hypotheses H1/H2 formed + confirmed; after() scope verified against the engines' admin-client usage." },
  { "id": "§3.4", "read_at": "2026-08-12T02:01:50Z", "source_file": "CLAUDE.md", "line_range": "282-292", "why_it_governs": "Honesty — a session silently missing its summary is a workflow lie; generation must be gated (no ungated run).", "how_this_build_will_embody_it": "Generation is gated on companyId (control gate) + best-effort with per-engine fallbacks; the transcript still saves even if generation hiccups." },
  { "id": "§5", "read_at": "2026-08-12T02:02:10Z", "source_file": "CLAUDE.md", "line_range": "334-360", "why_it_governs": "Standing principles — don't gold-plate under build pressure; a large unrequested LLM-cost backfill of old sessions is scope the founder must choose.", "how_this_build_will_embody_it": "The forward-fix ships; backfilling existing orphaned sessions is surfaced as a founder cost decision, not bundled." },
  { "id": "§6", "read_at": "2026-08-12T02:02:05Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Decision checklist — record-check + holistic + WHY before acting.", "how_this_build_will_embody_it": "Sections 3–5 run the checklist; the change is traced holistically to both entry points." },
  { "id": "A16", "read_at": "2026-08-12T02:00:45Z", "source_file": "ThinkerThinker.md", "line_range": "381-390", "why_it_governs": "Define shared behavior ONCE — don't copy-paste the generation block into a second route.", "how_this_build_will_embody_it": "Extracted generateSessionArtifacts; finalize + label-transcript both call it, so they can't drift." },
  { "id": "A19", "read_at": "2026-08-12T02:00:50Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Methodology consulted from the working tree this session.", "how_this_build_will_embody_it": "Read finalize + label-transcript + the runAndStore* engines in-tree before changing them." },
  { "id": "A21", "read_at": "2026-08-12T02:02:55Z", "source_file": "ThinkerThinker.md", "line_range": "528-545", "why_it_governs": "Audit ACROSS routes, not just within one — the same-feature (transcript→generation) contract must hold across BOTH transcript sources.", "how_this_build_will_embody_it": "Swept every transcript-append route for the generation trigger; the uploaded path was the cross-route gap." },
  { "id": "A22", "read_at": "2026-08-12T02:02:20Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "This manifest reflects this build's reads; minimum set present." },
  { "id": "A26", "read_at": "2026-08-12T02:02:35Z", "source_file": "ThinkerThinker.md", "line_range": "66-72", "why_it_governs": "A found bug is one instance of a class — sweep the class.", "how_this_build_will_embody_it": "Checked ALL transcript-append entry points (finalize/label-transcript/segments/upload-recording/retranscribe) for the generation trigger; only label-transcript (uploaded path) lacked it." },
  { "id": "A30", "read_at": "2026-08-12T02:02:50Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate the lesson in a test.", "how_this_build_will_embody_it": "Added tests asserting label-transcript triggers generation with the right args + does NOT generate when nothing appended / no company." },
  { "id": "A38", "read_at": "2026-08-12T02:03:05Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = the canonical command + its output.", "how_this_build_will_embody_it": "check.md pastes the vitest + npm run check runs with exit codes." }
]
```
