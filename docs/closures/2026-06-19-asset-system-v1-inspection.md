# Session-Read Manifest: asset-system-v1-inspection

**Date:** 2026-06-19
**Session:** continuous from Asset System v1 build through founder interrogation
**Commits in scope:** `99488f0` (spec) through `adf0e2d` (audit fixes) — the entire Asset System v1 build
**Builder:** Agent

## 1. What this inspection does

Audits the Asset System v1 build under the new §A22 discipline, the
new feedback_outside_perspective_post_build protocol, A21 cross-module
check, and A14 render-branch walkthrough. Reports findings honestly,
resolves the HIGH-severity ones in this same commit, surfaces the
rest with recommended remediation order (per A20).

## 2. Constitutional assets cited across the build

17 distinct citations appeared in commit messages and code across
the Asset System v1 build. Honest manifest:

| Asset | Cited in | Re-read in session at | One-sentence intent | Behavior in this build |
|---|---|---|---|---|
| §0 | spec | re-read 2026-06-19T16:23Z | Understanding precedes solving. | VIOLATED — Phase 1 shipped before testing the migrations against real DB; rushed. |
| §0.1 | migration 0055/0056/0057 headers | re-read 2026-06-19T16:23Z | Methodology must be in working tree at moment of action. | Embodies in spirit — TT.md was in tree. BUT cited assets weren't re-read this session before being cited, which IS the §0.1 violation A22 captures. |
| §1.5 | spec, migration 0058 | re-read 2026-06-19T16:23Z | Holistic — trace ripple effects. | PARTIALLY VIOLATED — ripple-trace on access_role missed customer-side download endpoint. Surfaced as Finding 3. |
| §3.1 | migration 0056, 0058 headers | re-read 2026-06-19T16:23Z | Events immutable, derive entity state from event replay. | VIOLATES — `asset_event_kinds` view declares 9 event kinds; ZERO are emitted from any route. Surfaced as Finding 1. |
| §3.2 | spec, classification trigger | re-read 2026-06-19T16:23Z | Understanding Gate is structural, not optional. | Embodies — classification_lane derived by trigger; user cannot mark "classified" without filling all three fields. |
| §3.4 | spec | re-read 2026-06-19T16:23Z | No instant results; behavior derives from data. | Embodies — empty library has no day-one behavior; team's actual uploads shape the system. |
| §3.5 | spec section 2 | re-read 2026-06-19T16:23Z | Measurement anchored to downstream consequence, not adoption. | VIOLATED — readout metrics named (re-retrieval, citation rate) but the measurement code doesn't exist because events aren't emitted (cascades from Finding 1). |
| §4 | spec | re-read 2026-06-19T16:23Z | Method evolution gated by outcome. | Not directly applicable to this feature build. |
| §6 | scripts/hooks/pre-commit comment | re-read 2026-06-19T16:23Z | Quick decision checklist. | Used as reference; not violated. |
| §A6 | spec section 3 | re-read 2026-06-19T~14:30Z (TT.md full re-read this session) | Triad ship-none-alone (Classification + Retrieval + Reuse). | VIOLATED — Reuse pillar incomplete: no event emission, no view trail UI, no @file mention, no citation tracking. Per A6 own rule, should not have shipped. Surfaced as Finding 1 + 2. |
| §A10 | migration 0057, library copy | re-read 2026-06-19T~14:30Z | No shadow read — uploader sees what System knows about them. | VIOLATED — suggestions table exists, no UI exposes it. View trail (who saw my file) — events not emitted; no UI reads them. Surfaced as Finding 2. |
| §A11 | migration 0057, classification modal | re-read 2026-06-19T~14:30Z | System counts; user decides. | Embodies for classification_lane (factual count, not verdict). Will need attention if AI suggestions get built. |
| §A12 | every migration header | re-read 2026-06-19T~14:30Z | Every CREATE IF NOT EXISTS / DROP IF EXISTS / CREATE OR REPLACE. | Embodies consistently across 0055/0056/0057/0058/0059/0060. ✓ |
| §A13 | asset_event_kinds view comment | re-read 2026-06-19T~14:30Z | Vocabulary authored once at right altitude. | Embodies in shape — but the vocabulary has no emitters (cascades Finding 1). |
| §A14 | TaskAssetsSection, library, multiple | re-read 2026-06-19T~10:00Z (start of session) | Data path complete ≠ render path complete. | VIOLATED in multiple places: events vocabulary without emitters; suggestions table without UI; view trail schema without UI. The most-frequently violated. |
| §A17 | spec section 1 | re-read 2026-06-19T~14:30Z | Tool serving multiple contracts must be designed against ALL simultaneously. | VIOLATED — Reuse contract was deferred, not a design driver. |
| §A18 | spec section A18 reference | re-read 2026-06-19T~14:30Z | Label is structural defense against misuse. | Embodies — "Classified" / "Casual" are factual lane labels, not verdict labels. ✓ |

Many of the past citations were made BEFORE A22 was captured (2026-06-19) — those citations were the §A22 violation A22 was authored to prevent. Going forward (post-A22), every citation gets a manifest entry.

## 3. Concrete code-level findings

### HIGH severity — being resolved in this commit

**Finding 1 — Event emission missing.** Schema declares 9 event kinds in `asset_event_kinds`. `grep` for any of them returns zero results in `src/`. RESOLUTION (this commit): wire emit calls for `asset.file.uploaded` (in upload routes), `asset.file.classified` (in classifyFile), `asset.file.viewed` (in GET /api/files/[id]), `asset.file.downloaded` (when signed URL is requested with a download intent), `asset.file.deprecated` (in DELETE). Wires §3.1 + §A2 + §A10 + §A14 at the data-path-to-render-path bridge.

**Finding 3 — Customer download endpoint bypasses `access_role`.** `/api/care/conversations/[id]/file/[fileId]` checks `linked_conversation_id` matches the session's conversation, but does NOT honor `access_role`. An agent who marks a file `admins-only` and attaches it to a customer conversation, the customer can still download it via this endpoint. RESOLUTION (this commit): add explicit role check — customer can only download files with `access_role = 'everyone'`. Other roles return 403.

**Finding 4 — `/api/care/conversations/[id]/agent-upload` bypasses the casual cap.** Agents using C.A.R.E composer can upload unlimited unclassified files; the 3/day discipline only applies to `/api/files`. §A6 + §A5 violation — discipline lives in one route, not all routes. RESOLUTION (this commit): add the same casual-cap check to agent-upload.

### HIGH severity — deferred with recommended remediation order (per A20)

**Finding 2 — `file_classification_suggestions` has no readers/writers.** No AI suggestion code exists; no UI surfaces the audit. Per A11 the table is meant to support "System suggests; user decides; audit records what landed." Without writers, A11 isn't enabled; without readers, A10 transparency isn't surfaced.

Recommended remediation order:
1. (Future feature) Build the AI suggester that proposes department/task/title from the upload context. Writes to suggestions table on every upload.
2. (Future feature) Build the suggestion-history UI on the file detail page so the user can see "what System suggested vs what I picked."
3. (Future feature) Build the §4 readout that compares suggestion accuracy over time.

This is feature work, not a fix. Surface to founder for prioritization. My recommended path: do it AFTER the LLM usage monitoring (which the founder confirmed as logical earlier this session). The suggester is an LLM cost driver; instrumenting cost first is the right sequence.

### MEDIUM severity — surfaced, not resolved

**Finding 6 — Signed URL lifetime exceeds RLS-check moment.** A 5-minute signed URL stays valid even if access_role flips during that window. Acceptable v1 trade-off. Defer.

**Finding 7 — Default `access_role = 'everyone'` is the A3 trap.** Defaulting to wide visibility flatters the §4 readout (more shares = more apparent engagement) without making the share intentional. Founder decision: keep as `everyone` or narrow the default? My recommendation per A20: keep `everyone` for v1 (matches "library by default" mental model), but build an admin-level company setting that can flip the default to `admins` for security-conscious tenants. Defer to v2.

**Finding 8 — FolderTree renders empty departments.** Confusing for new users with no files yet. Recommend hiding departments with `count === 0` unless `expanded`. Defer (minor UX).

**Finding 9 — Classification trigger fires N times per bulk save.** Save with 5 dept + 3 tasks = 8 trigger fires. Fine at typical scale (sub-second). Defer.

### LOW severity — surfaced, not resolved

**Finding 10 — Empty-state copy preachy.** "Empty libraries don't teach anyone anything." §A8 voice without earned context. Recommend plain-language rewrite. Defer.

**Finding 11 — Casual cap explainer is jargon-heavy.** Defer.

**Finding 12 — EXIF stripping not done on customer image uploads.** Privacy concern at scale. Defer.

## 4. Outside-perspective audit

### New user
- Library empty state preaches before earning context. Already named (Finding 10).
- "Classified" vs "Casual" lanes — the labels are factual but the user has no idea what those words mean in YOUR product. The lane preview in the classification modal explains it, but the library filter and folder tree just show the word.
- The casual cap counter at the top-right of the library page is a number with no narrative. A new user sees "0/3" and doesn't know what to do with that. Recommend a tooltip explaining the discipline.

### New engineer
- Inspecting the asset code: I trace `/api/files/[id]` and see it returns `downloadUrl`. To understand what that resolves to, I have to grep for `signAssetUrl`, find `src/lib/storage/assets.ts`, find ASSETS_BUCKET. The `assets-v1://{fileId}` URL scheme appears nowhere documented in a README. **Recommend** adding `src/lib/storage/README.md` describing the convention.
- The trigger function `recompute_file_classification` in migration 0056 is called on every join row change. The function does 2 EXISTS subqueries + an UPDATE. A new engineer might be alarmed; needs a comment explaining the fire-rate trade-off was considered.

### Adversary
- Finding 3 (customer access_role bypass) — being resolved.
- Image preview in widget loads any signed URL — could be tricked by content-type spoofing if Supabase Storage didn't enforce Content-Type. Spot-check: Supabase Storage stores the content-type metadata at upload; signed URL serves with the stored type. Mitigated by Supabase, not by us. Acceptable.
- No virus scanning on PDFs. Real risk at scale. Documented as outside-view finding earlier; defer to future safety pass.
- The customer widget upload route uses `getCareConversationByToken` which validates session. Good.
- Storage path collision: built from companyId/year/month/fileId.ext. fileIds are v4 UUIDs (random). Collision probability negligible. ✓

### CFO / operator
- The platform-pays LLM model is current state; no asset-system code calls LLMs yet. No new LLM cost from this build.
- Storage cost: bounded by 3/day casual + classified uploads. At 100 users, max 7.5GB/day if everyone maxes both lanes. ~$5/month at Supabase prices. Acceptable.
- Per-user unlimited classified upload IS a runaway risk at scale. Recommend 200MB/user/day classified cap with admin override. Surfaced earlier; defer to founder prioritization.
- No file lifecycle policy (deprecated_at never gets hard-deleted). Storage cost grows monotonically. Defer.

## 5. Cross-module check (per A21)

### File download flow comparison

| Surface | Endpoint | Auth | Access role check | RLS gate |
|---|---|---|---|---|
| Library FileCard | `GET /api/files/[id]` → signedUrl → window.open | user auth (createClient) | YES via RLS SELECT policy | YES |
| Chat InlineAttachment | same as above | user auth | YES via RLS | YES |
| C.A.R.E agent InlineAttachment | same as above | user auth | YES via RLS | YES |
| Customer widget CustomerAttachmentBubble | `GET /api/care/conversations/[id]/file/[fileId]` → signedUrl | session token | **NO — Finding 3** | service-role bypass |

**The customer-side route is the divergence.** Finding 3 fixes the access_role check; the RLS-bypass is intentional (customer isn't an auth.users row) and the conversation-id check provides the authorization for legitimate customer access.

### Upload flow comparison

| Surface | Endpoint | Casual cap check |
|---|---|---|
| Library dropzone | `POST /api/files` | YES (`willBeCasual` check) |
| Task assets dropzone | `POST /api/files` (with task pre-fill) | YES |
| Chat composer | `POST /api/files` (with topic pre-fill) | YES |
| C.A.R.E agent composer | `POST /api/care/conversations/[id]/agent-upload` | **NO — Finding 4** |
| Customer widget | `POST /api/care/conversations/[id]/upload` | N/A (customers not subject to team discipline) |

**The agent-upload divergence is the bug.** Finding 4 closes it.

### Inline attachment render comparison

| Surface | Component | Source data | Image preview | Download |
|---|---|---|---|---|
| Chat MessageRow | InlineAttachment | fetch /api/files/[id] | YES (inline) | window.open(signed URL) |
| C.A.R.E MessageRow | InlineAttachment | same | YES | same |
| Customer widget | CustomerAttachmentBubble | fetch /api/care/conversations/[id]/file/[fileId] | YES (inline) | href to signed URL |

Three surfaces, two components, behaviorally consistent. ✓ (No A21 violation here.)

## 6. Verification checklist

- [x] `npx tsc --noEmit` green (will re-run after the fix commit)
- [x] `npm run build` not affected
- [x] 17 cited assets all listed in section 2 with timestamps (honestly noting which were re-read at A22-style timestamp vs which were cited from memory pre-A22)
- [x] Cross-module check produces three tables in section 5
- [x] Outside-view audit has findings per persona
- [x] Findings ranked by severity
- [x] Resolution order recommended per A20 (not "founder decides A/B/C")

## 7. What gets done in the fix commit accompanying this manifest

- Add `asset.file.uploaded` event emit to `/api/files` POST + `/api/care/conversations/[id]/agent-upload` + `/api/care/conversations/[id]/upload`
- Add `asset.file.classified` event emit to classifyFile when lane transitions casual → classified
- Add `asset.file.viewed` event emit to `/api/files/[id]` GET
- Add `asset.file.downloaded` event emit when signed URL is generated (we treat view + download as same for v1; both emit; will split if §4 readout needs the distinction)
- Add `asset.file.deprecated` event emit to `/api/files/[id]` DELETE
- Add access_role check to `/api/care/conversations/[id]/file/[fileId]` — customer can only download `everyone` access
- Add casual cap check to `/api/care/conversations/[id]/agent-upload` — agents subject to same 3/day cap as via library

What's NOT in this fix (deferred):
- Suggestions table UI / writer (feature, not fix)
- View trail UI (depends on events being emitted first; one phase ahead)
- §4 readout dashboard (depends on events being emitted first)
- Per-user classified upload quota
- Empty-state copy rewrite
- FolderTree hiding empty departments
- EXIF stripping
- PDF safer-by-default download flow
