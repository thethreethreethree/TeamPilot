# Audit — Sales Coach recording/voice-memo upload artifact (2026-08-11)

Audit of the BUILT ARTIFACT shipped this session (commits `0a873a3c`→`2e9ca09f`): the direct-to-storage
recording upload, the real-audio-length duration fix, the append-only double-write guard, the two-phase
status, the favicon, and Jeff's product-knowledge sync. **I read the built files this session (Read tool),
not my memory of writing them** — every finding below cites a line I re-opened. Method: 4 parallel adversarial
pass-1 auditors on the actual files, then my authoritative pass-2 verification of each candidate against the
cited code.

## 1. Standard and scope — clauses audited against (quoted from the tree, this session)

- **CLAUDE.md §3.1:** *"Everything is an event. Events are append-only. Never update or delete — append."*
- **CLAUDE.md §3.4:** honesty — no error dressed as no-data, no fabricated result.
- **CLAUDE.md §3.5:** *"Hard metrics (objective, defensible): **meeting duration**…"*
- **ThinkerThinker A21:** *"Audits that look WITHIN modules but not ACROSS modules miss 'same name, different feature' composition failures."*
- **A26:** *"A reported bug is one instance of a class; the fix is incomplete until the class is swept to its codebase-wide boundary."*
- **A27:** *"A surface that PROMISES an invariant the write path does not ENFORCE is a false guarantee — enforce below the label."*
- **A29:** *"A recent bug-FIX is a high-yield sweep anchor… mine git history for fixes and sweep their siblings."*
- **A30:** *"A lesson recorded only in PROSE will return — a fix is not complete until the class is encoded in a GATE that fails without the author's cooperation."*
- **A31:** *"SCHEMA-COMPLETE IS NOT BUILT — the seam between the database and the surface… must be gated, not watched."*
- **A33/A36** (decline-the-gate; residual-is-highest-yield). **INV19** (getSession company/owner scope → content routes need an owner-or-manager check).

### Inspected (opened this session)
`upload-recording/route.ts` (both branches, in full), `upload-recording/sign/route.ts`, `retranscribe/route.ts`,
`label-transcript/route.ts`, `SessionRecordingUpload.tsx`, `[id]/page.tsx` (upload block), `after-pitch/page.tsx`
(durationLabel + upload placement + Session type), `sessions/page.tsx` (duration helper), `list/route.ts`,
`elevenlabs.ts` (`transcribeWithDiarization`), `salesCoach.ts` (`appendTranscriptSegment`, `getSession`, mapper),
`kpi/compute.ts` (`avgSessionDurationMin`), `kpi/{me,team,compute-cron}/route.ts`, `storage/assets.ts`
(`buildStoragePath`, `createSignedUploadTarget`, `getAssetObjectInfo`, `downloadAssetBytes` contract), migrations
`0210` and `0208`.

### NOT inspected (no clean bill claimed for these)
`rateLimit` internals (keying/durability), `isSalesCoachManager` body (called with `company_id: null` — argument
shape assumed intended), `fetchAllPaged`/`isMissingColumnError`/`createAdminClient` internals, the ElevenLabs
Scribe request-size behaviour, the CARE upload routes' full bodies beyond the `formData()` seam, the client UI
callers beyond the four listed, and every test file's assertion coverage beyond the ones I edited.

## 2. Two passes (A21)

- **Within-module:** each upload route's own correctness (auth order, validation, error handling, transcript
  writes) — pass 1 agents 1–3 + my re-reads.
- **Across-module (composition):** the duration value as it crosses transcription → column → getSession →
  three display/metric surfaces; the direct-to-storage pattern vs its siblings; the upload gate vs the DB
  constraint. This across-module pass produced the two highest-value findings (F1 storagePath, F2 unswept
  CARE upload siblings) — neither is visible from within a single module.

## 3. Findings

### F1 — storagePath (untrusted) fed to admin RLS-bypassing sinks without a company check — **MEDIUM** (FIXED this audit)
- **file+line:** `src/app/api/coach/sales-session/[id]/upload-recording/route.ts:128-188` (JSON finalize)
- **clause:** INV19 + `downloadAssetBytes` contract (`assets.ts:253-256`: *"never pass a storagePath derived from unvalidated caller input"*); the "safe-only-because-downstream" lens.
- **evidence (as-shipped, pre-fix):** `const storagePath = typeof body?.storagePath === "string" ? body.storagePath.trim() : "";` → `getAssetObjectInfo(storagePath)` → `.update({ audio_asset_url: \`${ASSETS_BUCKET}/${storagePath}\` })` → `downloadAssetBytes({ storagePath })`. The `.eq("company_id", companyId)` scopes which SESSION row updates, NOT the storagePath value. No `startsWith(companyId)` check.
- **class:** authorization gates the session REFERENCE while the data POINTER is a separate unvalidated caller input fed to an admin sink.
- **severity:** MEDIUM. Cross-company is UUID-path-guarded (not trivially exploitable) and same-company is bounded by getSession's owner-or-manager RLS (0084) — but the safety was INCIDENTAL, not enforced.
- **sweep:** `rg -n "downloadAssetBytes|getAssetObjectInfo|signAssetUrl" src/app | rg -v "assetUrlToStoragePath|buildStoragePath"` — every hit must derive storagePath server-side or check the company prefix.
- **GATE:** ✅ shipped — `if (!storagePath.startsWith(\`${companyId}/\`)) return 403` + test *"403 when storagePath is outside the caller's company"* (asserts `getAssetObjectInfo` NOT called). Fails without the guard.

### F2 — two unswept siblings of the direct-to-storage fix (CARE uploads still hit the ~4.5MB body cap) — **MEDIUM** (FLAG)
- **file+line:** `src/app/api/care/conversations/[id]/agent-upload/route.ts:~72` (25MB cap) and `care/conversations/[id]/upload/route.ts:~60` (10MB cap)
- **clause:** A29 (a fix leaves the class); the same body-cap class this session fixed for the recording.
- **evidence:** both do pure `req.formData()` with no signed-URL branch, but advertise 25MB / 10MB caps. A file between ~4.5MB and the cap (a high-res phone photo/PDF) dies at the Vercel body layer before the handler — the exact failure the recording bug had.
- **class:** large-file upload routed through the serverless function body (~4.5MB Vercel cap) instead of client→storage.
- **severity:** MEDIUM — real user-facing failures for attachments >4.5MB, silent to the app cap.
- **sweep:** `rg -n "req.formData\(\)" src/app/api` → cross-check each route's advertised cap vs 4.5MB.
- **GATE (proposed):** an invariant that flags a `formData()`-based upload route whose cap constant is >4.5MB and which lacks a signed-URL branch. **PROMISE** — CARE routes, out of this session's scope + a real port (reuse `createSignedUploadTarget`); flagged for founder greenlight, not fixed mid-test.

### F3 — After-Pitch drops the re-transcribe recovery affordance (`hasSavedRecording={false}`) — **MEDIUM** (FLAG)
- **file+line:** `src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx:~489`; Session type (~L86) has no `audioAssetUrl`.
- **clause:** §1.5.1 L2 (does it deliver the intended result) + the component's own recovery contract (`SessionRecordingUpload.tsx:42-46`).
- **evidence:** `<SessionRecordingUpload sessionId={id} onLabeled={…} hasSavedRecording={false} />` — hard-coded, vs `[id]/page.tsx:1038` `hasSavedRecording={!!session?.audioAssetUrl}`. The After-Pitch empty state IS the STT-outage recovery scenario (audio saved, transcript failed), yet the rep is told to re-find + re-upload instead of one-tap re-transcribe.
- **class:** UX/recovery affordance dropped on a ported surface (the "UI port drops parent guards" class).
- **severity:** MEDIUM. **GATE:** add `audioAssetUrl` to the After-Pitch Session type + its GET, pass the real value. **PROMISE** (needs a type+route change; low-risk, post-test).

### F4 — KPI `team` + `compute-cron` selects assert `audio_duration_seconds` exists (A34) — **LOW** (FLAG)
- **file+line:** `kpi/team/route.ts:84`, `kpi/compute-cron/route.ts:89` (no `isMissingColumnError` fallback), vs `team/route.ts:71` which DOES guard `sales_coach_monthly_deal_target`.
- **clause:** A34 (reads must degrade). **evidence:** these two selects fold `audio_duration_seconds` into an unguarded `fetchAllPaged` → a missing column throws → 500 / cron abort. `me` degrades to a clean 500; `list` degrades to `{degraded}`. Inconsistent.
- **class:** migration-coupled read without a named-column fallback, in a file that already guards a different column.
- **severity:** LOW (0210 is applied; bites only code-ahead-of-migration / rollback). **GATE:** wrap with `isMissingColumnError(err, "audio_duration_seconds")` → wall-clock. **PROMISE** (cheap, matches the sibling; batch it).

### F5 — label-transcript comment overstates the check-then-write as the structural gate — **LOW** (FLAG, A27)
- **file+line:** `label-transcript/route.ts:75-92`. **clause:** A27. **evidence:** the comment presents `getSessionTranscript(id).length > 0 → 409` as *the* structural gate; it is a non-atomic TOCTOU. **The actual enforcement is migration 0208's `unique(session_id, seq)` constraint** (confirmed present) — `appendTranscriptSegment` treats 23505 as an idempotent no-op, so a concurrent double-label cannot double the transcript. **No live data-corruption bug** (constraint backstops). **class:** label above the real (DB-constraint) enforcement. **severity:** LOW. **GATE:** the 0208 constraint IS the gate; **PROMISE** — correct the comment to credit it.

### F6 — raw storage error strings returned to the client (CWE-209) — **LOW** (FLAG)
- **file+line:** `upload-recording/route.ts:287` (`Couldn't store the recording: ${up.error}`), `sign/route.ts:137` (`error: target.error`). **clause:** CWE-209 lens. **evidence:** `up.error`/`target.error` are raw Supabase `error.message` (`assets.ts:228,333`), echoed to the client — inconsistent with the transcription branches which log-real + return generic. Authed + storage-config-not-secret. **class:** raw backend exception in the response body. **severity:** LOW. Sibling: `/api/files/upload-url:68` (same pattern, mirrored). **GATE:** the CWE-209 invariant scans `error.message` in routes, so it misses a helper's `.error` field — a real gate gap. **PROMISE** — generic message + `console.error(real)`; consider widening the invariant to `.error` fields.

### F7 — `uploadBlob` lacks the synchronous re-entrancy latch its sibling `label()` has — **LOW** (FLAG)
- **file+line:** `SessionRecordingUpload.tsx:74-128` (uploadBlob, only `phase` flag) vs `164-198` (label(), which latches with `labelingRef`). **clause:** the component's own §L169-171 rationale (button-disable is a render late). **evidence:** uploadBlob relies on `pending={phase === "uploading"}`; a second entry (reopen picker + reselect) mints a second signed upload + finalize = double STT/transcription spend. **class:** re-entrancy-latch asymmetry across sibling handlers on a PAID path. **severity:** LOW (trigger is a multi-step modal, not a fast double-tap). **GATE:** add `uploadingRef`. **PROMISE**.

### F8 — three hand-maintained copies of "prefer audio>0 else wall-clock" — **LOW** (FLAG, drift)
- **file+line:** `compute.ts:143`, `after-pitch/page.tsx:~110`, `sessions/page.tsx:~103` (comment says *"Kept in sync"*). **clause:** A31 (seam gated, not watched) + A30. **evidence:** three independent implementations of the same rule; a comment claims sync, no test asserts the three agree. Currently agree → drift risk, not a live bug. **class:** comment-only cross-artifact sync contract. **severity:** LOW. **GATE/PROMISE:** the post-test cleanup already logged — extract `conversationDurationSeconds()` + unit-test it. **PROMISE**.

### F9–F12 (LOW, FLAG)
- **F9 rounding divergence:** `sessions/page.tsx:~114` rounds to nearest minute (UP: "5m" for 4m30s) vs `after-pitch` exact "4m 30s" — same call, two labels. §3.5 cross-surface consistency. PROMISE (align on the shared helper of F8).
- **F10 metric proxy:** `compute.ts:135` gates `avgSessionDurationMin` on `endedAt !== null`, dropping an audio-populated session with null `ended_at` despite a known length. Low likelihood (trigger stamps ended_at). Fix `s.endedAt !== null || (s.audioDurationSeconds ?? 0) > 0`. PROMISE.
- **F11 silent best-effort write:** the three `audio_duration_seconds` updates (`upload-recording` ×2, `retranscribe`) never check their result — a failed update silently reverts every surface to wall-clock with no log. Add `console.error` on error. PROMISE.
- **F12 missing finite/>0 guard:** `compute.ts:145` wall-clock fallback omits the `>0`/`isFinite` guard the two client helpers apply — a negative/skewed wall-clock silently drags the average. PROMISE.

### F13 — outcome route: manager can write outcome/deal_value to another rep's session — **DESIGN LINE** (founder judgment)
- `outcome/route.ts:~51` gates on getSession only (no owner check), so a same-company manager can set another rep's outcome + deal_value (service-role, event-logged). Consistent with the manager-oversight model and distinct from the transcript routes tightened to owner-only — **not filed as a hole; flagged for your confirmation** that manager write-access to outcome is intended.

## 4. Class sweep (boundaries recorded as baselines)
1. **INV19 content-route gate** — swept all `sales-session/[id]/*` routes; every upload/transcript route is owner-or-manager gated; the only open line is F13 (outcome manager-write, by design). Boundary command in F1's sweep.
2. **Duration-from-wall-clock** — exactly THREE session-duration computations, all prefer audio (compute.ts, sessions, after-pitch); no 4th (other `Date.parse(endedAt)` hits are cue/window timing). Closed.
3. **Migration-coupled select (0210 column)** — 4 sites: `list`+`me` degrade, `team`+`cron` don't (F4). Boundary: `grep -rn "audio_duration_seconds" src/app`.
4. **Append-only double-write** — 3 callers of `appendTranscriptSegment` (finalize/segments/label-transcript); all single-entry by the 0208 unique constraint; label-transcript double-protected with the 409. Closed.
5. **Direct-to-storage body-cap** — 8 `formData()` routes; 2 real unswept siblings (F2). Boundary: `grep -rn "req.formData()" src/app/api`.

## 5. Gate the lesson (A30/A33)
- F1 → **GATE shipped** (prefix check + test). F4/F5/F6/F7/F8–F12 → **PROMISE** (specified fixes; batched for founder greenlight — no CRITICAL, and the client is mid-test). F2 → **PROMISE** + a proposed invariant (formData-cap>4.5MB detector); declining an immediate gate because a precise detector needs the cap-constant lookup (A33 — name the hole, don't ship a noisy gate).

## 6. Empty-findings note (§1.7.3)
No layer returned an empty flag list that I trusted silently. The CLEAN verdicts are stated with what was looked
for: prefer-audio logic MATCHES across all 3 surfaces (verified line-by-line); the `label()` double-tap latch is
CORRECT (synchronous ref before first await); the two-phase status is HONEST (stage flips only after upload
resolves); migration 0210 is additive/idempotent; all 3 KPI mappers select+map the column consistently;
`durationSeconds` uses the last word's END and handles empty/out-of-order words.

## 7. Honesty (A24)
Downgraded the two agent-rated MEDIUMs (label-transcript TOCTOU → LOW after confirming the 0208 constraint; the
storagePath from HIGH → MEDIUM after confirming UUID + owner-or-manager RLS limit exploitability) rather than
inflate. Did not omit the LOWs. F1 was a genuine defect in my own freshly-shipped code — filed and fixed.

## 8. Residual queue (A36 — ranked by confidence-it-does-not-matter, DESC)
```json
[
  { "id": "R1", "item": "isSalesCoachManager called with company_id: null in sign + upload-recording — is null the intended arg, or should it be the caller's company (could the manager check mis-fire cross-company)?", "why_skipped": "Did not open isSalesCoachManager's body; mirrored retranscribe's existing call. If it ignores company_id the null is harmless; if it uses it, a null could over- or under-grant.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-11T15:55:00Z", "outcome": "OPENED + verified against skillAccess.ts:20-24 — isSalesCoachManager returns `sales_coach_role === 'admin' || isAdminRole(role)` and NEVER reads company_id (that field is consumed only by the separate canManagerViewRepSkills, which these routes do not call). The null arg is harmless: manager-ness is role-based, and the tenant boundary is enforced by getSession's company-scoped RLS (0084) + the .eq('company_id', companyId) writes, not by this arg. No cross-company mis-grant. CLEAN — the high-confidence label was correct, but confirmed by reading, not assumed." },
  { "id": "R2", "item": "Whether any GET route returns another rep's audio_asset_url to a non-manager (the storagePath-obtain vector for F1's same-company reach).", "why_skipped": "getSession RLS is owner-or-manager per the sweep, which bounds it, but I did not enumerate every reader of audioAssetUrl.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-11T16:05:00Z", "outcome": "OPENED. Enumerated every audioAssetUrl reader: [id] GET / outcome / prep-qa return the mapped session (audioAssetUrl) behind getSession; recordings/route.ts gates non-self reads on isSalesCoachManager (:67); list route doesn't select it. Verified the coaching_sessions SELECT RLS against the migration chain: 0070 (company-wide) → 0083 (owner-or-admin) → 0084 (CURRENT: agent_id=auth.uid() OR same-company CEO/COO/admin/sales_coach_role=admin). So getSession is OWNER-OR-MANAGER, not company-wide. CONCLUSION: a non-manager rep CANNOT obtain another rep's storagePath → F1's same-company vector requires being a manager, who already has authorized access to that content → NOT a privilege escalation. F1's prefix fix is sufficient; no path-binding needed. SELF-CORRECTION (A24, verify-then-correct): I first wrote that the INV19 memory's 'company-scoped' label was STALE — then opened the memory and found it explicitly says 'company-scoped — per the 0084 RLS policy it returns a session to its owner OR any same-company manager', which is ACCURATE. The memory is NOT stale; 'company-scoped' is its shorthand for owner-or-manager and it cites 0084 correctly. The route comments reuse the same loose phrasing but the gates (owner-or-manager) are correct. No memory change made. LOW doc-nit only: the phrase 'not owner-scoped' in the route comments reads as 'any company member' at a glance when the precise scope is owner-or-manager." },
  { "id": "R3", "item": "ElevenLabs Scribe max input size / partial-result behaviour for a 25MB file at maxDuration=300 on the current Vercel plan.", "why_skipped": "External + plan-dependent; not code-verifiable here.", "confidence_it_does_not_matter": "medium", "opened_at": null, "outcome": null },
  { "id": "R4", "item": "rateLimit keying (per-IP vs per-user) + durability across serverless instances — whether the paid-compute throttle actually holds under scale.", "why_skipped": "Did not open rateLimit; assumed per prior provenance (2026-08-02 swept it clean).", "confidence_it_does_not_matter": "low", "opened_at": null, "outcome": null }
]
```
(A36 read-from-top: R1 is the entry I'm most sure is fine — and therefore the one to open first next pass, because the `company_id: null` argument is exactly the kind of cached-as-harmless call that hides a real mis-grant.)

## 9. Remediation plan
| # | Fix | Clause | Risk the fix introduces | Gate/Promise |
|---|---|---|---|---|
| F1 | storagePath `startsWith(companyId)` guard | INV19 | none — legit paths start with companyId (assets.ts:194); verified test | **GATE ✅ shipped** |
| F2 | port signed-URL upload to the 2 CARE routes | A29 | a real refactor; touches customer-facing upload | PROMISE (founder greenlight) |
| F3 | pass real `audioAssetUrl` to After-Pitch upload | §1.5.1 | adds a column to the After-Pitch GET | PROMISE |
| F4 | `isMissingColumnError` on team+cron selects | A34 | none (matches existing guard) | PROMISE |
| F5 | correct the label-transcript comment | A27 | none (docs) | PROMISE |
| F6 | generic client message + log raw | CWE-209 | none | PROMISE |
| F7 | `uploadingRef` latch on uploadBlob | re-entrancy | none | PROMISE |
| F8–F12 | extract tested `conversationDurationSeconds()` + guards | A30/§3.5 | redeploys 3 display surfaces | PROMISE |
| F13 | confirm manager-write to outcome is intended | INV19 | n/a | founder decision |

**No CRITICAL finding — nothing blocks.** F1 (the only security finding) is fixed + gated. The rest are
specified and batched for greenlight rather than deployed piecemeal into a live client test.
