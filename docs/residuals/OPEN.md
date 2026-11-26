# Open residuals

> The residual queue is a **work queue, not a disclaimer** (`A36`, BUILD-PROTOCOL.md §7).
> At the start of every subsequent build, read this file — per §1.1, residuals are
> assets, not admin. A line here is not closed until it is checked off with an outcome.

## Filed on TBC installation (2026-07-28)

Per BUILD-PROTOCOL.md §12.3, installing the standing build protocol creates these open
residuals. They are recorded here, not resolved, because each is a governed-document
change or a structural rebuild that is out of scope for the install itself.

- [x] 2026-07-28 · install-tbc-gates · RESOLVED (R1, founder-approved): the embedded pre-amendment constitution (TT lines 1–206) was replaced with a pointer to CLAUDE.md; DOC_MANIFEST.json regenerated for the new TT hash in the same commit. R1.2 subset-check confirmed zero unique content lost. Original finding: — ThinkerThinker.md embeds a **pre-amendment copy** of the constitution under the heading `# CLAUDE.md — Project Operating Constitution` (its lines 1–206), missing §0.1, §1.5.1, §1.5.2, §1.7, §7.
      why-unresolved: two divergent copies of a governing text is the `A16` class applied to the constitution itself. Fixing it edits ThinkerThinker.md (a governing doc) and changes its manifest hash — it must be done as its own governed change with the `A16`/R1.2 subset-check ("verify the embedded block is a strict subset of CLAUDE.md before deleting; STOP if the diff is not empty"), not folded into the install.
      next-action: replace ThinkerThinker.md lines 1–206 with a pointer — *"Constitution: see `CLAUDE.md`. This file is the asset library."* — regenerate DOC_MANIFEST.json in the same commit.
      R1.2 SUBSET-CHECK DONE (read-only, 2026-07-28): a normalized line-level comparison of ThinkerThinker.md lines 1–206 against CLAUDE.md found **0 substantive lines (len≥12) absent from CLAUDE.md** — every line of the embedded constitution is present in CLAUDE.md verbatim (exact or reflowed substring). The embedded copy is a STRICT VERBATIM SUBSET (older, fewer sections, zero unique content), so the runbook's precondition ("STOP if the diff is not empty") is satisfied — the pointer-replacement loses nothing and is safe to apply. NOTE: editing ThinkerThinker.md is still inside the founder-paused BUILD-SYSTEM-PREP runbook; only the safety precondition was verified here, not the edit. When applied, it changes ThinkerThinker.md's hash → regenerate DOC_MANIFEST.json in the same commit (verify-docs) and reference the change; ThinkerThinker.md is pinned eol=lf so the hash stays checkout-stable.

- [x] 2026-07-28 · install-tbc-gates · RESOLVED (R2, founder-approved): the Index by topic was rebuilt to A1–A39 (added Gate-discipline, Reachability, and System-honesty groupings covering A30–A39; broad tags extended to A39; "Rebuilt" note updated). Original finding: — ThinkerThinker.md **Index by topic** is stale — it covers to ~A29 while the library runs to A39, so A30/A33/A35/A36/A38 (the assets that govern this very protocol) are unreachable by topical lookup.
      why-unresolved: index rebuild is a separate content task; topical lookup is `grep`, not the index, until it is rebuilt.
      next-action: regenerate the index and add a gate that fails when the highest indexed asset lags the highest captured asset.

- [x] 2026-07-28 · install-tbc-gates · RESOLVED as NOT-A-DEFECT (R3, A15 — a flag honestly diagnosed may close without a fix): the misspelling "ThinkThinker" appears ONLY in text *describing* the drift (BUILD-SYSTEM-PREP.md, BUILD-PROTOCOL.md's own residual note, and this file). The operative doc THINK_BUILD_CHECK.md uses the correct "ThinkerThinker" — there is no live broken reference, and "fixing" the descriptions would make them nonsensical. Closed without a code change. Original finding: — "ThinkThinker.md" → "ThinkerThinker.md" naming drift appears in prose in THINK_BUILD_CHECK.md / BUILD-SYSTEM-PREP.md.
      why-unresolved: a literal `find` for the misspelled name fires the stop-condition; verify-docs.mjs already fails on an unresolvable manifest path (R3 closed for the manifest, open for prose references).
      next-action: fix the string in the source prompts. Verified zero code impact (the misspelling appears only in docs).

## Filed by the post-install gate audit (2026-07-28)

Proactive audit of the now-mandatory gates (they block `npm run check` team-wide, so a
false positive is costly — A33: a gate that cries wolf is one people learn to skip, and the
real leak rides in behind six fake ones). Both findings are CONFIRMED by test, not theorized.

- [x] 2026-07-28 · gate-audit · F2 — RESOLVED in build docs/tbc/2026-07-28-regex-fix-f2-citation/ (CITATION_RE now requires the section sign for both forms, matching the commit-msg hook; A4/A100 prose no longer flagged; install bootstrap regression-checked green). Original finding below. — the citation regex in scripts/tbc/lib.mjs (CITATION_RE) treats BARE `A<1-3 digits>` as a constitutional citation, so `A4` (paper size), `A100` (GPU), `A3` (figure ref), `A1` (grade/cert) all get flagged as needing a manifest entry.
      why-unresolved: changing the detection semantics of the mandatory protocol is a founder-level design call, not a self-authorized rewrite of the founder's gate. CONFIRMED: `extractCitations("render to A4 paper")` returns `["A4"]`.
      next-action (RECOMMENDED, precedent-backed per A28): align the asset-citation form to require the section sign — match the repo's OWN established `scripts/hooks/commit-msg` regex, which uses `§A[0-9]+` (sign required). That precedent already decides it: the commit-msg hook does NOT treat bare `A4` as a citation, so the TBC gate should not either. This narrows the gate to the established boundary; the unconditional minimum-set check (which is keyed on declared IDs, not extraction) is unaffected, so A19/A22/A30/A38 stay enforced. Any such fix is itself a TBC-governed build.

- [x] 2026-07-28 · gate-audit · F3 — RESOLVED in build docs/tbc/2026-07-28-tighten-gates-f3-f4/ (founder chose "tighten now"): single ambiguous words now require a VERDICT_CONTEXT token within ~60 chars; multi-word verdicts still always count. "verified users"/"a passing mention"/"turned green" no longer flagged; real verdicts still caught. Original finding below. — the assurance-word regex (ASSURANCE in scripts/tbc/verify-artifacts.mjs) fires on ordinary prose: "a passing mention", "turned green", "identity-verified users" all match, and go red if not within ~1200 chars of a fenced command + exit code.
      why-unresolved: narrowing the word list risks MISSING real "verified"/"passing" claims (a false negative is worse here), and the near-fence window already mitigates most cases. The honest instrument per gate-honesty policy is the allowlist, not a fuzzier regex.
      next-action (RECOMMENDED): leave the regex as-is; when a legitimate prose use trips it, add the specific `docs/tbc/<dir>/<file>.md` to ALLOWLIST.json under the `artifacts` key WITH ITS REASON (the loader already rejects reasonless entries). Only tighten the regex if the false-positive rate proves high in practice — the gate-honesty rule's "fix the gate or delete it" bar.

- [x] 2026-07-28 · gate-audit · F4 — RESOLVED in build docs/tbc/2026-07-28-tighten-gates-f3-f4/ (founder chose option 1): new gate scripts/tbc/verify-freshness.mjs requires a build dir when the diff touches src/scripts/migrations, unless a TBC-Exempt: trailer is present; wired into `npm run tbc` (CI) + scripts/hooks/commit-msg (commit time). Detection-tested: code-without-dir → red, dir/exempt → pass. Original finding below. — F4 (SHARPEST — goes to whether the protocol achieves its purpose) — `currentBuildDir()` returns the lexically-greatest EXISTING dir under docs/tbc/. Now that the install dir (2026-07-28-install-tbc-gates) is permanently committed, every future `npm run check` finds a valid latest dir and passes `tbc` — INCLUDING a new build/commit that created NO artifacts of its own. The "every substantive build needs its own docs/tbc/<date>-slug>/" mandate is therefore NOT mechanically enforced: it relies on the developer voluntarily creating a new dir, which is the exact discretionary-invocation failure (A38) the whole protocol exists to eliminate.
      why-unresolved: closing it is a founder-level design addition (changes what the mandatory protocol enforces), not a self-authorized rewrite. CONFIRMED by test: parking the only build dir turns tbc red; with ANY valid dir present, tbc stays green regardless of whether the current change created one.
      partial mitigation already in place: the commit-msg citation path DOES bite — a commit that cites a section/asset with no matching manifest entry in the latest dir goes red. So a build that cites its governing clauses is partially caught; a build that cites nothing and skips the dir is not.
      next-action (RECOMMENDED): add a freshness/association check to verify-manifest — when the staged/committed diff touches non-doc code, require a build dir whose think.md started_at is within the session AND/OR that the commit message names its build dir (TBC_BUILD) and that dir is complete. This is the amendment's own "did it take?" test (its section 7.5): without it, TBC can silently degrade into the install dir standing in for every future build. Surfaced, not self-applied — but this is the one I'd prioritize.
      DESIGN VALIDATED 2026-07-28 (A32 — designed before recommending). Proposed logic: `ENFORCED=/^(src|scripts|migrations)\//`; require the diff to also add/modify a dated build dir (`/^docs\/tbc\/\d{4}-\d{2}-\d{2}-[^/]+\//`) UNLESS the commit carries a `TBC-Exempt: <reason>` trailer. Tested against 6 scenarios, all correct: src-change-no-dir → FAIL; src+build-dir → PASS; docs-only → PASS; src+TBC-Exempt → PASS; migration-no-dir → FAIL; scripts+build-dir → PASS. So it enforces the mandate on code changes WITHOUT false-positiving trivial/doc commits. NOT applied — enacting it changes the everyday commit flow for the whole team (a "could break the flow" decision), which is a founder call; ready to apply as its own TBC-governed build on approval. OPTION 2 (leave F4 as a documented honest limit, matching the commit-msg hook's "friction not enforcement" framing) is the lower-friction alternative.

## Filed by Build B (doc reconciliation, 2026-07-28)

- [x] 2026-07-28 · build-B · F5 — RESOLVED in build docs/tbc/2026-07-28-verify-manifest-f5/: verify-manifest's line_range check is now ADVISORY (stale range → note, not fail); the HARD guarantee is that the id must appear somewhere in the named source_file (catches a wrong file / invented citation). A governing-doc edit no longer reds the build. Detection-tested (install dir's post-R1 stale ranges pass with notes; a fabricated id fails). All five install-audit findings now disposed. Original finding below. — the manifest's `line_range` mechanism couples every build's think.md to the EXACT line numbers of CLAUDE.md / ThinkerThinker.md. Any governing-doc edit shifts those lines, so verify-manifest fails on the CURRENT build dir until its ranges are hand-re-pointed. Hit twice this session (CLAUDE.md 2.1 insert; TT constitution removal — the latter shifted assets ~191 lines).
      why-unresolved: a design decision on the gate, not a bug to silently patch. The current line-range check is what catches a "plausible range written without opening the file", so it has real value; the cost is the re-point friction on governing-doc edits.
      next-action (RECOMMENDED): make verify-manifest ANCHOR on heading text rather than absolute lines — resolve each id to the line where its `## A<n>` / `### <section>` heading actually lives, and verify the id appears there, instead of trusting a hand-written range. That keeps the "did you open the file" guarantee while making it immune to line shifts. Alternatively, treat the range as advisory (locate the id, warn if the range is stale) so an edit does not RED the build. Either is its own TBC-governed build; surfaced, not self-applied.

## Filed by the login outage diagnosis (2026-11-11)

See `docs/SUPABASE-QUOTA-OUTAGE-2026-11-11.md`.

- [x] 2026-11-11 · health-backend-probe · `npm run check` passes with the new health probe, the 0271 migration, and both new test files
      why-unresolved: Node is not installed on the machine this was built on; no gate was run, not even typecheck.
      next-action: run `npm run check` on a machine with Node 24; fix anything it reports before committing.
- [ ] 2026-11-11 · health-backend-probe · migration 0271 applied, and `/api/health` on production shows `backend.quota.fileStorage.level` other than "unknown" — 0271 APPLIED; system_storage_usage() answers on production (0.77 GB after the 2026-11-21 cleanup). Still open: the deployed /api/health reading it (needs the push)
      why-unresolved: the project is suspended (402), so `db:verify`/`db:apply` cannot run until service is restored.
      next-action: after the founder restores the plan: `npm run db:verify` then `npm run db:apply`; curl production health.
      2026-11-26: production /api/health (commit 93d52ea) reports backend.quota.fileStorage {level: "warn", pctUsed: 71.4,
      quotaSource: "default-free-plan"} — the probe is live and reading; overall status "degraded" comes from this warn.
      Open only in that the quota source is the free-plan default, not the project's actual plan limit.
- [ ] 2026-11-11 · health-backend-probe · a person is alerted when `/api/health` is 503 or "degraded"
      why-unresolved: production has Sentry and email off; no monitor watches health. The endpoint is honest but unwatched.
      next-action: founder sets up an uptime monitor (non-200 + keyword "degraded") and/or adds NEXT_PUBLIC_SENTRY_DSN.
- [ ] 2026-11-11 · health-backend-probe · recording retention is bounded by the storage quota, not only by a per-rep count
      why-unresolved: KEEP_PER_REP=20 × up to 250 MB/file (0241) × reps has no relation to the plan's quota; saved recordings are never purged. A product decision (what to keep) for the founder.
      next-action: measure actual bucket sizes once restored; propose a quota-aware rule (e.g. refuse new uploads at critical, or shorten retention) as a founder picker.
- [ ] 2026-11-11 · health-backend-probe · the TBC build directory for this change exists before it is committed
      why-unresolved: verify-freshness requires docs/tbc/<date>-<slug>/ for src/migrations changes; not created because the change is uncommitted and unverified.
      next-action: create docs/tbc/2026-11-11-health-backend-probe/ (think/build/check) at commit time.

## Filed by RSS Phase 0, steps 1-4 (2026-11-15, docs/tbc/2026-11-15-rss-p0)

- [x] 2026-11-15 · rss-p0 · `npm run check` exits 0 with 0272, access.ts, set-manager and the Team page change
      why-unresolved: no Node on the build machine; nothing was executed
      next-action: run `npm run check` and append the output to the build's check.md
- [ ] 2026-11-15 · rss-p0 · migration 0272 is applied, and an admin has set managers for a real team (plan step 4 "Looked at") — 0272 APPLIED 2026-11-21 (production ledger at 0298); still open: managers set on the Team page for a real team
      why-unresolved: Supabase project suspended (storage quota)
      next-action: after restore, `npm run db:verify` then `npm run db:apply`; set managers on the Team page
- [x] 2026-11-15 · rss-p0 · an executed SQL test shows an authenticated user cannot change their own manager_id and the service role can — DONE 2026-11-21: sql-harness CLAIM 5 (also pins 0297 accept-only-via-function and 0298 anon reads 0); run on PGlite 16.4 ✓, and fails with the right message under each of 3 mutants (profiles triggers off, team_invitations triggers off, anon revoked on rss_tree_allows)
      why-unresolved: needs the SQL harness (Node + Postgres)
      next-action: add the case to scripts/sql-harness.mjs or port the scaffold's PGlite RLS suite
- [x] 2026-11-15 · rss-p0 · is_sales_coach_manager() (0252) treats CFO as a manager, as admin_roles() and the TS authority do — DONE 2026-11-20: it did NOT (old literal without CFO); 0290 makes it call admin_roles() (0265 founder ruling) and skip removed people; INVARIANT 39 found 9 more function copies + the invite policy, fixed verbatim in 0291; executed as signed-in users on PG 16.4
      why-unresolved: changing it widens access on live policies; Phase 0 step 8 replaces those policies
      next-action: confirm every policy using it is moved to rss_can_view_rep in step 8, or fix it there
- [ ] 2026-11-15 · rss-p0 · decide how Phase 2 stats get segment end times (none are stored today)
      why-unresolved: founder decision, due before Phase 2
      next-action: picker at the start of Phase 2
- [x] 2026-11-15 · rss-p0 · a manager re-score writes an audit_log row (plan Phase 0 step 5) — DONE (Phase 8): pitch-score/route.ts:208-217 records `score.rescore` with pitchId, score, reason, earlierOverrides when the old score is archived first
      why-unresolved: audit_log is a Phase 8 table; the archive row records who/when/why meanwhile
      next-action: add the write in the pitch-score route when Phase 8 creates audit_log
- [x] 2026-11-15 · rss-p0 · managers can re-score again (refused with 503 until 0272 exists, because the old score cannot be archived first) — DONE 2026-11-21: production has public.pitch_score_archive (read-only check; ledger at 0298)
      why-unresolved: Supabase suspended; 0272 not applied
      next-action: apply 0272
- [x] 2026-11-15 · rss-p0 · streaming AI calls and speech-to-text audio seconds are recorded in ai_usage, and every engine passes its engine/session label — DONE 2026-11-20: streams metered (DeepSeek stream_options.include_usage, Anthropic message_start/delta → llmStream → recordAiUsage; the non-stream fallback too); STT audio seconds via recordSttUsage at all 5 transcribeWithDiarization callers; engine is REQUIRED on claude.ts call(), runBrainCall and runBrainStream (a new engine without a name does not compile), and the 14 direct llmCall/llmStream sites are labelled. Not yet seen against a live provider
      why-unresolved: providers return no usage on streams; STT is outside llmCall; only pitch scoring is fully labelled
      next-action: capture usage from the stream's final event per provider; record audio seconds in the STT batch path; thread `engine` through each runBrainCall/claude.ts caller
- [ ] 2026-11-15 · rss-p0 · prices are entered for every provider/model in use, so the AI cost page shows no "price missing"
      why-unresolved: no price is seeded by design; needs the founder to enter them from the providers' pricing pages
      next-action: /dashboard/admin/ai-cost → Prices, after 0272 is applied
- [x] 2026-11-15 · rss-p0 · BLOCKING before any company's reps all have managers: the ten manager routes that use the service role apply the reporting tree (patterns, patterns/event, pitch-score/override, pitch-score/disputes, pitch-score/leaderboard, pitch-recordings/comment, pitch-recordings/share, coach-assessment/dashboard, gamification/calibration), with an invariant-audit gate
      why-unresolved: scope of the step 8 pass
      next-action: a shared check calling rss_tree_allows through the caller's client; add it to each route; add the gate
- [x] 2026-11-15 · rss-p0 · the remaining rep-scoped select policies use rss_tree_allows (agent_baseline, agent_point_ledger, growth_record, kpi_snapshot, door_knocks, door_knock_undos, gamification_calibration, rep_day_target, rep_daily_sales_goal, rep_pattern_summaries, pitches, pitch_analyses, pitch_transcripts)
      why-unresolved: scope of the step 8 pass; until then they show the company, as today
      next-action: one migration recreating each from its latest definition with the tree term
- [ ] 2026-11-15 · rss-p0 · sign-in lockout is enforced where it cannot be skipped (Supabase CAPTCHA or the Team-plan password-verification hook)
      why-unresolved: D4 undecided; the server route only covers our own login pages
      next-action: decide D4 and the mechanism together
- [x] 2026-11-15 · rss-p0 · the invite page's sign-in (src/app/invite/[code]/page.tsx) also goes through /api/auth/sign-in
      why-unresolved: the plan named the two login pages; the invite flow signs in right after account creation
      next-action: switch it to signInViaServer if its attempts should be recorded
- [x] 2026-11-15 · rss-p0 · (closure note) the three items above were closed on 2026-11-15: INVARIANT 36 + treeAccess in the ten routes, migration 0274 for the thirteen policies, and the invite page now signs in through /api/auth/sign-in
      why-unresolved: —
      next-action: run npm run check with them

## Filed by RSS Phases 1 and 3 (2026-11-15, docs/tbc/2026-11-15-rss-p1-p3)

- [x] 2026-11-15 · rss-p1-p3 · `npm run check` exits 0 with 0275/0276, sessionContext, stage chips and keyword trackers
      why-unresolved: no Node on the build machine
      next-action: run it; apply 0272-0276 in order after Supabase is restored
- [x] 2026-11-15 · rss-p1 · decide whether phone/video sessions must have an outcome before processing (plan F25.9 vs the 2026-08-29 skippable ruling)
      why-unresolved: founder decision
      next-action: picker
- [x] 2026-11-15 · rss-p1 · an in-app notice when an uploaded call finishes processing — DONE 2026-11-20: migration 0289 ('call_ready'), notifyCallReady at the end of generateSessionArtifacts (uploaded phone/video only, once per call), bell sentence + link
      why-unresolved: needs a manager_notifications type (0242 CHECK) and the bell's enum mirror
      next-action: one migration extending the CHECK + NotificationBell text
- [x] 2026-11-15 · rss-p2 · decide how stats get segment end times (none stored)
      why-unresolved: founder decision; blocks Phase 2 (stats, player, lanes)
      next-action: picker
- [ ] 2026-11-15 · rss-p3 · the scorer reads rubric_config per channel (with is_active, not active) and supports N/A per element, with a byte-for-byte door regression test
      why-unresolved: scoring-engine change, not testable on this machine
      next-action: build on a machine with Node; then the D6 caveat goes away for a channel that has its own rubric
- [x] 2026-11-15 · rss (closure note) · the two decisions above were made 2026-11-15: outcome stays skippable everywhere; end times are stored for new recorded calls and estimated for older ones (0277 + RemoteCallPanel)
      why-unresolved: —
      next-action: —
- [x] 2026-11-15 · rss-p2 · comment @mentions and visibility (F9.8) on recording comments — DONE 2026-11-20: 0293 (visibility everyone/named/only_me + recording_comment_mentions; read rule = rss_comment_base_visible AND visibility — narrows, never widens), 0294 ('comment_mention'), route checks each mention with the same SQL rule and refuses by name, composer picker on the Recordings tab; signed-in matrix on PG 16.4: CEO(mentioned) everyone+named, author all, out-of-tree manager (mentioned) nothing, rep everyone only
      why-unresolved: needs a recording_comments change and the Recordings tab UI
      next-action: migration for mentions[] + visibility, route + picker
- [x] 2026-11-15 · rss-p2 · live (non-uploaded) calls store real end times — DONE 2026-11-20: include_timestamps=true on the live socket; the timestamps event (own branch, never a turn) gives endedAt = spokenAt + measured word span (liveTiming.ts; the docs do not state the words' reference point, so only the span is used); /segments + /finalize accept it. A line flushed before its timestamps arrive keeps the estimate. NOT yet seen on a real call
      why-unresolved: the realtime transcription path does not yet pass word timings through; those lines are estimated
      next-action: read the realtime commit events' word timings in useLiveCoaching and send endedAt to /segments and /finalize
- [ ] 2026-11-15 · rss-p4+ · Phases 4-9 of docs/rss (coaching loop, find & reuse, follow-through, training, protection, reach)
      why-unresolved: not started
      next-action: Phase 4 written 2026-11-20 (docs/tbc/2026-11-20-rss-p4; migrations 0278, 0279). Phase 5 written 2026-11-20 (docs/tbc/2026-11-20-rss-p5; migration 0280) minus talk-ratio/element/disputed filters, global search, downloads. Phase 6 written 2026-11-20 (docs/tbc/2026-11-20-rss-p6; migration 0281). Phase 7 written 2026-11-20 (docs/tbc/2026-11-20-rss-p7; migrations 0282, 0283). Phase 8 written 2026-11-20 (docs/tbc/2026-11-20-rss-p8; migrations 0284, 0285; AMD-014). Phase 9 written 2026-11-20 (docs/tbc/2026-11-20-rss-p9; migration 0286). All nine phases are written; what remains is the open items below and applying 0271-0286

## Filed by RSS Phase 7 and the first executed gate (2026-11-20, docs/tbc/2026-11-20-rss-p7)

- [x] 2026-11-20 · rss-p7 · (closure note) the three "`npm run check` not run" items above (health-backend-probe, rss-p0, rss-p1-p3) are closed: every step ran on Node 24 with exit 0, migration:audit and sql:harness SKIPPED (no Postgres) with a PGlite replay of all 281 migrations standing in for the first — outputs in the p7 check.md
      why-unresolved: —
      next-action: —
- [ ] 2026-11-20 · rss-p7 · (D18 DECIDED 2026-11-23: Remote Sales → Training stays) the manager training screen (TrainingManager) is mounted, and the Phase 7 "Looked at" is done (a manager turns a real call into a scenario and assigns it; the rep sees it with a due date) — MOUNTED 2026-11-22 (62a1d297): Remote Sales → Training shows TrainingManager to managers and AssignedPractice to reps; reachability exemption removed. Still open: the "Looked at" on a real call after the push
      why-unresolved: D18 open (Bootcamp or the Sales Coach Training tab); the plan does not invent an answer
      next-action: when D18 is answered, mount it there and remove its reachability-audit ALLOWLIST entry
- [x] 2026-11-20 · rss-p7 · an executed allowed-and-refused test for each 0282 select policy (rep's own; manager under the tree; another company refused) — DONE 2026-11-20: sql-harness CLAIM 4 (training_assignments as five people); executed on PG 16.4, mutation-tested
      why-unresolved: the PGlite replay ran as superuser
      next-action: add the cases to scripts/sql-harness.mjs (the 0272 manager_id case above belongs there too)
- [x] 2026-11-20 · rss-p7 · migrations 0271-0295 applied to production — DONE 2026-11-21: 0271-0298 applied, verify:live passed (docs/tbc/2026-11-20-rss-p9/check.md)
      why-unresolved: Supabase suspended
      next-action: after restore, `npm run db:verify` then `npm run db:apply`

## Filed by RSS Phase 8 (2026-11-20, docs/tbc/2026-11-20-rss-p8)

- [x] 2026-11-20 · rss-p8 · erasure of a customer's data from the product (F33.6)
      why-unresolved: —
      next-action: — (AMD-014 ratified by founder picker; 0285 + /api/coach/remote/erasure + Settings → Protection; executed on PG 16.4)
- [ ] 2026-11-20 · rss-p8 · the Phase 8 "Looked at" on a real device: an erasure request for a phone number removes that customer's sessions, and the audit log shows who asked
      why-unresolved: Supabase suspended; 0284/0285 not applied
      next-action: after db:apply, erase a test customer on a phone-width screen
- [x] 2026-11-20 · rss-p8 · 0284's read rules executed as signed-in users (audit_log: admin yes, manager no, other company no; recording_trims: the rep and their chain) — DONE 2026-11-20: sql-harness CLAIM 4 (audit_log, erasure_requests, recording_trims, retention, trimmed transcript); executed on PG 16.4, mutation-tested
      why-unresolved: the PGlite replay runs as superuser
      next-action: with the 0282 cases, in scripts/sql-harness.mjs

## Filed by RSS Phase 9 (2026-11-20, docs/tbc/2026-11-20-rss-p9)

- [ ] 2026-11-20 · rss-p9 · BLOCKING SETUP: RSS_WEBHOOK_SIGNING_SECRET set in Vercel (app project); then a test webhook from Settings → Protection reaches a real receiver and verify() accepts it (the Phase 9 "Looked at")
      why-unresolved: external config; nothing is sent until it is set (cron 503, screen says so)
      next-action: `openssl rand -hex 32` → Vercel env; redeploy; Send a test
- [ ] 2026-11-20 · rss-p9 · BLOCKING SETUP: Google / Microsoft providers configured in Supabase and verified per docs/AUTH-REDIRECTS.md "OAuth providers"; then NEXT_PUBLIC_AUTH_PROVIDERS set
      why-unresolved: provider apps and secrets live outside the repo; buttons stay hidden until then
      next-action: follow the table and the 5 verification steps in docs/AUTH-REDIRECTS.md
- [x] 2026-11-20 · rss-p9 · a manager named in the team CSV for an invitee is applied when they accept — DONE 2026-11-20: migration 0288 (team_invitations.manager_id + accept trigger, admin's invitations only, never blocks joining); import passes it; executed through accept_invitation on PG 16.4. Still manual: a manager who is being invited in the same file
      why-unresolved: needs team_invitations.manager_id and a change to the accept path
      next-action: migration + accept route; until then the import tells the admin to set it after they join
- [x] 2026-11-20 · rss-p9 · webhook hostnames that resolve to private addresses are refused at send time — DONE 2026-11-20: resolvesPrivate in sendSigned, before every send; webhooks.test.ts
      why-unresolved: literal private IPs and local names are refused; DNS resolution is not checked
      next-action: resolve the host in sendSigned and refuse private results
- [x] 2026-11-20 · rss-p9 · findAuthUserByEmail fails loud on a listing error instead of answering "no account" — DONE 2026-11-20: throws on a failed page (missing env stays a deliberate soft-fail); createInvitation and both add-member paths answer 503 'couldn't check'; test pins page-2 failure
      why-unresolved: pre-existing (`if (error || !data) break`); its callers would need to handle a throw
      next-action: throw, and handle it in POST /api/team (createInvitation) and add-member
- [x] 2026-11-20 · rss-p9 · the Team page says when the reporting tree is OFF and who is keeping it off — DONE 2026-11-20: migration 0287 (rss_tree_blockers; rss_tree_active redefined on it), /api/team/managers returns the verdict, Team page names them; executed on PG 16.4
      why-unresolved: rss_tree_active (0273) needs every 'staff' profile to have a manager; one unmanaged person (even a CEO marked as a Sales Coach rep) silently keeps managers on company-wide view
      next-action: on the Team page, list the staff with no manager under "Reporting lines are not in force until these people have a manager"
- [x] 2026-11-20 · roles · a REMOVED person keeps admin-derived access in SQL helpers that do not check profiles.status (seen: fin_effective_role gives a removed CEO 'cfo'; the 0291 copies keep their original status handling) — DONE 2026-11-20: 0292 adds status <> 'removed' to the 8 caller-based helpers + the invite policy (verbatim otherwise); signed-in: removed CEO → fin null, others unchanged
      why-unresolved: pre-existing; 0291 changed only the role literal (0265 discipline). Narrowing finance and chat authority per function is its own change
      next-action: add `and p.status <> 'removed'` to each admin-derived helper (0291's list), with a signed-in test per helper; the app already refuses removed people a session
- [x] 2026-11-20 · review · a failed erasure leaves an erasure_requests row with no completion (a retry adds another) — DONE 2026-11-21: GET /api/coach/remote/erasure lists unfinished requests (no completion, not finished by a later retry for the same customer, older than the 6-min grace over the route's 5-min budget; never the hash); Settings → Protection shows them with "search again and erase to finish"; 9 tests
      why-unresolved: low; nothing is lost, the record just shows requests that look abandoned
      next-action: show requests without a completion on Settings → Protection as "not finished — run again"
- [ ] 2026-11-20 · review · two overlapping webhook sends of one delivery can both go out
      why-unresolved: low; attempts de-duplicate, receivers de-duplicate on the delivery id (documented)
      next-action: claim a delivery with an insert-first lock row before sending, if receivers report duplicates
- [x] 2026-11-20 · review · a trim maps audio time to lines via spoken_at − started_at; a recording that started late could trim the wrong lines — DONE 2026-11-21: measured on production (uploads exact by construction; live chunk 0 lands 17.5–18.7 s after start on 6/7, 74.1 s on 1 → a ~56 s late recorder). 0300 audio_started_at (recorder start on spoken_at's browser clock, sent with chunk 0, set once, service role only) is the base for every reader (audioBaseIso + SQL coalesce); PGlite: the late-recorder trim that left "my card is 4111" visible now hides it; rep write refused. Applied to production. Still to see live: a real live call after the push (runbook 0300 row)
      why-unresolved: unverified on real uploads; the same offset is used by every RSS time chip
      next-action: on a real uploaded call, trim a known phrase and confirm the right line disappears (runbook check 3)
- [x] 2026-11-21 · review · any company member can mark a pending invitation accepted (or set accepted_by) — 0008's update policy is `company_id = auth_company_id()` only — DONE 2026-11-21: 0297 refuses any accepted_* write from authenticated/anon (only accept_invitation, definer, writes them); revocation unchanged; signed-in replay C/H refused, D/G pass
      why-unresolved: pre-existing (0008). Since 0296 it moves nobody (the manager trigger requires the accepting user to be the caller with the invited email), but the invitation then reads as accepted and its code stops working
      next-action: narrow the update policy to admins + revoke columns, and route acceptance only through accept_invitation (definer); signed-in test that a member's direct accept is refused
- [x] 2026-11-21 · review · purge candidates paged by created_at alone could repeat or skip a row across a page boundary — DONE 2026-11-21: `id` tie-break in the order (recording-purge-cron/route.ts)
      why-unresolved: unconfirmed by the reviewer
      next-action: —

- [x] 2026-11-21 · release · A16 / A21 audits not run for the RSS release — DONE 2026-11-21: A16 — Ask Coach now reads each call's stored scorecard (readPitchScore, caller's client) and may not silently contradict it; follow-through's outcome already compares against the rep's own (one source, session.outcome). A21 — Ask Coach is one engine for both routes; uploaded calls were never auto-scored (fixed: label-transcript scores like finalize). Was: whether every AI surface on a remote recording consumes the others' findings (A16), and a cross-module parity inventory of remote recordings vs in-person Sales Coach sessions (A21)
      why-unresolved: recorded honestly in docs/closures/2026-11-21-rss-release.md rather than claimed
      next-action: enumerate the AI reads on a recording (review, coaching, scoring) and check each takes the others' output; list shared concepts across remote/in-person and verify parity
- [ ] 2026-11-21 · A21 · calls uploaded BEFORE the label-transcript scoring fix have no score and show "Scoring" until scored
      why-unresolved: a one-time backlog; scoring spends one LLM call per recording, so it is run, not migrated
      next-action: after deploy, a manager opens the scoring backfill (GET /api/coach/sales-session/pitch-score/backfill shows the count first, POST drains in batches) and runs it to remaining = 0
      measured 2026-11-21 (production, read-only, ended sales calls): remote 13 ended / 13 unscored / 3 with rep speech; in person 356 / 304 / 111 → the drain scores ~114 (one LLM call each); the rest have no rep speech and are refused, not billed
      the 13 remote sessions are early tests, not stuck calls: 12 live video sessions 2026-06-26 → 08-13 with no audio and 0-4 lines, one 9 s upload (2026-09-27) with 1 unlabelled line. No real phone/video call has run through production yet — the first is after the push, and it is the one to use for the Phase "Looked at" checks
- [x] 2026-11-21 · A21 · transcript recovery and the dissect backfill cron regenerate a call's artifacts but do not score it — DECIDED 2026-11-23 (founder, picker): keep scoring manual, make the backlog visible. Built: the backfill is per module (?module=remote_sales = phone/video; default = in person, no context = in person); Remote Sales → Coaching shows its own panel, Sales Coach's counts in-person only; a non-manager sees nothing instead of "could not be read". Production counts on the two filters: 13 remote / 356 in person (matches the 2026-11-21 measurement) (attribute-unlabelled now scores — 2026-11-21; trim needs none: a trimmed call is already scored and re-scoring is D3's manager action)
      why-unresolved: scoreSession takes the caller's client by design ("whatever that client can see is what gets scored", scoreSession.ts:40); recovery and the cron have no user. Scored calls are unaffected (skipIfScored); an unscored call reached only by these paths waits for the drain
      next-action: decide whether the drain becomes a cron (needs a system-identity client and its own tenant guard) — scoreSession is deliberately caller-scoped, so this is a design change, not a call to add
- [x] 2026-11-21 · storage · 466 recordings (405.7 MB) nothing referenced — invisible to screens, retention and §3.1.1 erasure — DONE 2026-11-21 (founder: delete + sweeper): 0299 rule, full-schema reference scan clean, dry run = measured set, removed 466 (Storage-confirmed), 7 audit rows; storage 1.196 → 0.77 GB; all live pointers intact; nightly sweeper + INVARIANT 40 (docs/STORAGE-ORPHANS-2026-11-21.md)
      why-unresolved: —
      next-action: —
- [ ] 2026-11-21 · storage · the nightly unreferenced-upload sweeper runs on Vercel and its first report is read
      why-unresolved: the cron ships with the next push; until then only the one-time cleanup has run
      next-action: after the push, the cron log at 04:00 (or GET with ?dryRun=1 and the CRON_SECRET) shows candidates 0 or a small, audited number
- [x] 2026-11-21 · review · pitch-score evidence times are measured from the FIRST line spoken, not from the recording's start (generatePitchScore.ts:95-100) — DONE 2026-11-21: the prompt's [m:ss] are now from audioBaseIso(started_at, audio_started_at) (scoreSession passes it), matching what the prompt already told the model; first line only when a session has no start. Applies to scores made after the push; earlier scores keep their first-line base (cut-over = the deploy date)
      why-unresolved: found in the 0300 sweep of every spoken_at→position reader; changing it changes what stored pitch_score_elements.timestamp_s means for every score, so it is its own change, not part of 0300
      next-action: base the offsets on audioBaseIso(started_at, audio_started_at); re-score is not needed for new calls, and old scores keep their meaning (document the cut-over date)

- [ ] 2026-11-21 · storage · SETUP: tell /api/health the Supabase plan's real limits (SUPABASE_STORAGE_QUOTA_BYTES / SUPABASE_DB_QUOTA_BYTES in Vercel)
      why-unresolved: unset → health assumes the Free plan (1 GB files). Storage is 0.77 GB after the cleanup = 77% → status "degraded" (warn ≥ 70%). If the plan was upgraded after 2026-11-11 that is a false warning; if it is still Free, it is a real one (~230 MB from the limit that suspended the project, and the nightly sweeper removes only orphans, not normal growth). Nothing in the app shows "degraded" (VersionWatcher reads only build.commit) and no monitor watches it, so this is quiet either way.
      next-action: Supabase dashboard → plan. Upgraded: set both variables in Vercel to the plan's limits in bytes (.env.example has the format). Still Free: decide retention before the limit (Settings → Protection → keep last N per rep).
- [x] 2026-11-20 · rss-p5 · R2-filters: spec filters (talk ratio, rubric element, disputed), global search and recording downloads not built — DONE 2026-11-22: rubric element + grade, talk share and disputed filters (c193254b); manager downloads, audited, refused past an active trim (2a46e8f4); sales calls in the app-wide search via runCallSearch, a failed call search flagged (this commit)
      why-unresolved: —
      next-action: —

## Filed 2026-11-22 (prospect audio, call comments, Remote Sales Macro Mode — docs/tbc/2026-11-20-rss-p9/check.md addenda)

- [ ] 2026-11-22 · call-audio · a real remote live call in desktop Chrome with the call's tab shared: the recording holds both voices and the transcript shows "Prospect" lines from the call audio
      why-unresolved: built and tested in code (eab8523c, 0302 applied); browsers' share-picker behaviour cannot be exercised in tests
      next-action: after the push, run one live video call with "Share tab audio" ticked; check the saved audio and the Prospect lines; try once WITHOUT ticking it and confirm the rep is told only their side is recorded
- [ ] 2026-11-22 · macro-mode · the Macro Mode "Looked at": on a real remote call, Highlights shows the brief / key points / next steps, a follow-up draft is written, Coaching shows the score and review, the Next Meeting checklist saves into the prospect's to-dos, and Today plans a real day
      why-unresolved: built (bb0ec011, 9364350a; 0303 applied); the AI reads have not run on a real call — no real remote call has run in production yet
      next-action: after the push, turn Macro Mode on (Remote Sales → Calls), make or upload one call, walk the three tabs, add the prospect, review the checklist, tick a to-do Done
- [ ] 2026-11-22 · macro-mode · send follow-ups / pipeline changes to the company's CRM (Salesforce, HubSpot), and calendar reminders for checklist items
      why-unresolved: the team's spec puts its own CRM first and integration second; reminders today are task due dates
      next-action: when a pilot company names its CRM, build that one connector first

- [x] 2026-11-22 · vocabulary · custom vocabulary for transcription (Gong F8.9) — product, plan and competitor names — DONE 2026-11-22: verified live (batch scribe_v1/v2 accept repeated `keyterms` form fields → 200, a JSON list → 400 invalid_keyword; realtime repeated `keyterms=` echoed in session_started), then built opt-in per company (0306, Protection → Transcription vocabulary, ≤100 terms, 20% cost stated)
      why-unresolved: ElevenLabs documents `keyterms` (batch: list of strings, ≤1000 terms, ≤50 chars, ≤5 words; realtime:
      a `keyterms` array query param) at a 20% transcription surcharge (+ a 20 s minimum when >100 terms). Not documented:
      which models accept it (our batch runs scribe_v1; docs show scribe_v2), and how the list is encoded on the wire.
      Building on a guess would ship an unverified dependency (§1.5.3), and it adds cost per call.
      next-action: one live request each (batch scribe_v1 with repeated `keyterms` form fields; realtime with repeated
      `keyterms=` query params) to confirm acceptance and the session_started echo; then an opt-in per-company list
      (empty = off = no surcharge), cost shown beside it.
- [x] 2026-11-22 · D10 · the reps' own weekly progress email still sends (D10 covered only the managers' email) — DECIDED same day (founder, picker): KEEP the reps' weekly email
      why-unresolved: not part of the question the founder answered; deciding it for them would be overtaking
      next-action: ask as a picker when convenient — keep the reps' weekly email, or in-app only for everyone
- [x] 2026-11-22 · D5 · the scoring backlog count (pitch-score/backfill) counts by rep lines, not the 100-word floor — DONE same day: the count reads each rep line's text and applies the scorer's own repWordCount + SCORING_FLOOR; test added
      why-unresolved: words can't be counted in that query cheaply; the scorer refuses short calls before any AI cost, labelled "too short"
      next-action: count words in the backfill read, or label the offer "some may be too short to score"
- [x] 2026-11-23 · D14 · a company that set "keep the last N per rep" cannot go back to the standard 90 days from the screen — DONE same day: 0308 (keep_last_per_rep nullable; latest row with no count = the default), PUT { useDefault: true }, "Use the standard 90 days" button; applied to production (is_nullable = YES)
      why-unresolved: company_recording_settings stores a count per row (0284) and the latest row wins; "back to the default" needs a row that means "default" (a nullable count or a kind column) — a migration
      next-action: when a company asks, add the migration (keep_last_per_rep nullable = default) and a "Use the standard 90 days" button; ruleFor already treats a missing count as the default
- [x] 2026-11-23 · finance · 15 finance pages show "not set up" (FinanceNotSetUp) when their load THROWS — DONE same day (founder, picker: "Fix it now"): none of the 15 checked for an empty Chart of Accounts, so "not set up" only ever meant "failed"; each now shows FinanceLoadFailed ("Couldn't load …, refresh"), the dead `ready` state removed; a scan test keeps any page from wiring FinanceNotSetUp to a failed load again — a network error or a non-JSON 500 — not only when the feature isn't installed (`load().catch(() => setReady(false))`: forecast, cards, anomalies, schedules, unit-economics, controls, opening-balances, inventory, payroll, cost-per-outcome, collections, assets, segments, contractors, reports)
      why-unresolved: found in the 2026-11-23 failed-read sweep of the Remote Sales build; the finance module is outside it, and each page's "not set up" condition should be confirmed before changing 15 screens
      next-action: give each page a separate "couldn't load — refresh" state for a thrown load, keeping FinanceNotSetUp for the real not-installed answer; one shared helper so the 15 cannot drift
- [ ] 2026-11-23 · privacy · the privacy page says customer data isn't used to train AI, naming only Anthropic (src/app/privacy/page.tsx:305); DeepSeek is also a provider (src/lib/llm/index.ts, with fallback) and isn't covered by that wording — founder decided 2026-11-23: leave it for now
      why-unresolved: a customer-facing statement; the options were to verify DeepSeek's API data terms and name both, or keep customer data on Anthropic only
      next-action: when revisited, read DeepSeek's current API data-use terms first; then either name both providers accurately or route customer data to Anthropic only

## Filed by multi-factor sign-in (2026-11-23, docs/tbc/2026-11-23-mfa)

- [ ] 2026-11-23 · mfa · BLOCKING SETUP: TOTP multi-factor must be enabled in the Supabase project (Auth → Multi-Factor → TOTP); then one real enrolment from Settings → Sign-in codes, a sign-out, and a sign-in that asks for the code
      also (0315): while held at the code screen, try a finance action from another tab — it must be refused ("Enter the code…").
      why-unresolved: dashboard config outside the repo; the public settings endpoint does not report it
      next-action: after the push, enrol a test account in Settings; if it is off, enrolment says "Couldn't start setup…" (the provider's reason is in the server log)
- [x] 2026-11-23 · mfa · 128 SECURITY DEFINER functions callable by authenticated are outside the database rule (0309 covers tables and storage)
      resolved 2026-11-23 (docs/tbc/2026-11-23-mfa-functions, 0315): a PostgREST pre-request hook refuses /rpc/* for a held session; live API shows x-rss-guard: 1; live invariant 33.
      why-unresolved: each must be read to see whether it reads or writes customer data
      next-action: add `if not public.rss_mfa_ok() then raise exception` to the data-bearing ones; a live invariant over the list
- [ ] 2026-11-23 · mfa · the mobile app and Chrome extension have no code step, so they refuse an account with codes on
      why-unresolved: each client needs its own MFA screen
      next-action: add the code step to each client's sign-in (challengeAndVerify), then drop the Settings warning
- [ ] 2026-11-23 · mfa · company-wide "require sign-in codes" setting (admins)
      why-unresolved: per-person codes first
      next-action: append-only company setting; the middleware sends people without an authenticator to Settings to set one up


## Filed by Ask Coach across the pipeline (2026-11-23, docs/tbc/2026-11-23-ask-pipeline)

- [x] 2026-11-23 · ask-pipeline · pipeline questions are not saved as a chat thread (Ask Coach over calls is)
      why-unresolved: one-shot first
      next-action: reuse ask_coach_chats with a pipeline scope column, append-only turns
      closed 2026-11-23 by decision: founder picker "Follow-ups, not stored" — the page keeps the thread and sends it back; nothing saved — docs/tbc/2026-11-23-pipeline-followups.
- [x] 2026-11-23 · ask-pipeline · no component test renders the Ask box (citation buttons; reset when switching "Whose pipeline")
      why-unresolved: the remote-sales screens have no component-test harness yet
      next-action: add a testing-library render for RemotePipeline's AskPipeline with a mocked fetch
      done 2026-11-23: RemotePipeline.ask.render.test.tsx (citation opens the prospect on its tab; mutation-checked) — see the correction entry below.

## Filed by the team call calendar (2026-11-23, docs/tbc/2026-11-23-team-calendar)

- [x] 2026-11-23 · calendar · booked calls show a date only (a prospect's next call has no time)
      why-unresolved: next_call_date is a date column
      next-action: an optional next-call time on the prospect event, shown on the calendar and in the .ics reminder
      done 2026-11-23: 0325 (applied) — time on the card, row, calendar, Ask box and .ics — docs/tbc/2026-11-23-next-call-time.
- [x] 2026-11-23 · calendar · calendar week read is capped at 500 calls
      why-unresolved: far above any team's week today
      next-action: if a team nears it, page the read and say "showing the first 500"
      done 2026-11-23: paged — every call of the week is read — docs/tbc/2026-11-23-calendar-paging.

## Filed by training by deal stage (2026-11-23, docs/tbc/2026-11-23-stage-training)

- [ ] 2026-11-23 · stage-training · stage names are free text; a scenario's stage tag matches only the same name (ignoring case and spacing)
      why-unresolved: a company stage list is a pipeline change of its own
      next-action: an optional company stage list offered in the prospect's stage box and the tag box
      part done 2026-11-23: the prospect's stage box now suggests the stage names in use (one spelling each) — docs/tbc/2026-11-23-stage-suggestions. A company list stays open.
- [x] 2026-11-23 · client reads · 11 client reads map a failed fetch to null (`r.ok ? r.json() : null`) — some may show "nothing" on a failure
      resolved 2026-11-23 (docs/tbc/2026-11-23-null-reads): 7 data reads fixed (plus 6 more found in src/app), the null form is now a gate with 7 listed label reads.
      why-unresolved: each must be read to tell a label read from a data read
      next-action: read each; extend noFailedReadAsEmpty to the null form with an allowlist for label reads
- [x] 2026-11-23 · stage-training · "rep needs" not yet used — the stage's scenarios are not ranked by the rep's weakest rubric items
      why-unresolved: stage first
      next-action: order the list by the rep's lowest-scoring focus areas from pitch_scores_by_channel
      done 2026-11-23: 0326 (applied) — scenarios tagged with rubric items; ranked by the rep's recent misses — docs/tbc/2026-11-23-rep-needs.

## Filed by editable transcripts (2026-11-23, docs/tbc/2026-11-23-transcript-edits)

- [x] 2026-11-23 · transcript-edits · transcript corrections do not redo the AI summary, review and follow-through (trackers and talk stats are redone)
      why-unresolved: five paid AI calls per edit
      next-action: a "Refresh AI notes with corrections" button that runs generateSessionArtifacts once after a batch of edits
      done 2026-11-23: the button exists (same rights as editing, audited, rate-limited) — docs/tbc/2026-11-23-refresh-notes.
- [ ] 2026-11-23 · transcript-edits · a corrected line keeps its times; per-line speaker changes are not offered
      why-unresolved: re-timing needs audio alignment; speaker edits are a separate kind
      next-action: add a speaker choice to the line editor, recorded the same way (new version + edit row)
      part done 2026-11-23: speaker changes per line (0328, applied) — docs/tbc/2026-11-23-speaker-edit. Re-timing stays open.

## Filed by vulnerability disclosure (2026-11-23, docs/tbc/2026-11-23-security-disclosure)

- [x] 2026-11-23 · security-disclosure · security reports have no alert — a new one waits until a founder opens Security reports
      why-unresolved: no founder alert channel outside the Sales Coach bell; email sending is C.A.R.E-only
      next-action: send the founders an email (or a bell entry in the vendor shell) when security_reports gets a row
      done 2026-11-23: in-app (D10) — an amber count of waiting reports on the founders' "Security reports" sidebar item — docs/tbc/2026-11-23-security-alert.
- [ ] 2026-11-23 · security-disclosure · AFTER PUSH: open https://elostate.com/.well-known/security.txt and https://elostate.com/security; send one test report and see it in Security reports
      why-unresolved: not deployed until pushed
      next-action: founder push, then the three checks
- [ ] 2026-11-23 · security-disclosure · founders' decisions: safe-harbour wording for good-faith researchers; how to remove a reporter's name/contact on request (reports are append-only)
      why-unresolved: legal wording and an erasure path for non-customers are the founders' to decide
      next-action: decide; then add the wording to /security and, if wanted, a redaction event

## Filed by lead source on prospects (2026-11-23, docs/tbc/2026-11-23-lead-source)

- [ ] 2026-11-23 · lead-source · AFTER PUSH: add a prospect with a source on the live site; it shows on the card and under Pipeline → Sources
      why-unresolved: not deployed until pushed
      next-action: founder push, then the check

## Filed by keep transcripts only (2026-11-23, docs/tbc/2026-11-23-transcript-only)

- [ ] 2026-11-23 · transcript-only · the first night a company turns on "Keep transcripts only", read the purge cron's response (purged, transcriptChecks, transcriptCheckErrors) and open one affected call: transcript present, audio gone
      why-unresolved: no company has it on yet
      next-action: check after the first opt-in
- [ ] 2026-11-23 · transcript-only · transcripts-only check is one query per call (bounded by the batch of 500)
      why-unresolved: small at today's volume
      next-action: replace with one grouped read if a company's daily calls approach the batch
      measured 2026-11-23 (production, read-only): 0 companies use "keep transcripts only"; the most calls with audio any company recorded in one day in 90 days: 6. The trigger (approaching 500) is far off; left as is — the one-at-a-time head count is the fail-closed design.

## Filed by deal risk and forecast (2026-11-23, docs/tbc/2026-11-23-deal-risk)

- [ ] 2026-11-23 · deal-risk · thresholds unmeasured (21 days quiet, 14 for a new prospect, two reasons = at risk, five closed deals before a forecast)
      why-unresolved: no closed-deal history yet
      next-action: once ~30 deals have closed, compare how often "at risk" deals were lost vs the rest; adjust only on that evidence (§4)
- [x] 2026-11-23 · deal-risk · the Ask box doesn't see each deal's risk reasons; no close-date field, so no forecast by month
      resolved (part 1, 2026-11-23): the Ask box now sees each deal's risk reasons — docs/tbc/2026-11-23-deal-risk/remediate.md addendum. The close-date part stays open.
      why-unresolved: next small change / a pipeline field of its own
      next-action: add risk reasons to buildPipelineContext; an optional expected-close event kind
      done 2026-11-23: expected close date (0320, applied) and Pipeline → Forecast by month; the Ask box already sees risk reasons (ask-pipeline build) and now the close date — docs/tbc/2026-11-23-close-date.

## Filed by the null-form sweep (2026-11-23, docs/tbc/2026-11-23-null-reads)

- [x] 2026-11-23 · client reads · other spellings of "failed read → nothing" (e.g. `if (!r.ok) return null`, `.catch(() => [])`) are not matched by the guard
      why-unresolved: each spelling needs its own safe pattern
      next-action: grep each spelling, read in context, add to noFailedReadAsEmpty with counted allowances
      done 2026-11-23: ~40 sites read in context; fixed the team-password dialogs and the call page (review/summary/why); else-form guard added — docs/tbc/2026-11-23-failed-read-sweep-3.

## Filed by the Ask Coach prompt library (2026-11-23, docs/tbc/2026-11-23-prompt-library)

- [ ] 2026-11-23 · prompt-library · run each library prompt on one real call and one real pipeline; rewrite any that produce a vague answer; then a team's own saved prompts
      why-unresolved: needs real data and paid AI calls; custom prompts are their own build
      next-action: after the first real remote calls are scored

## Filed by team usage (2026-11-23, docs/tbc/2026-11-23-team-usage)

- [ ] 2026-11-23 · usage · sign-ins via Google/Microsoft or the mobile app aren't counted; Tasks / C.A.R.E / Finance use isn't in the view; email lookup is one call per person
      why-unresolved: only /api/auth/sign-in writes login_attempts; first version covers the coaching records
      next-action: record a sign-in event on every session creation path; add module columns; batch the lookup past ~100 people
      part done 2026-11-23: sign-ins now count every method (auth.sessions + the web form, merged; 0327 applied) and the per-person lookup is gone — docs/tbc/2026-11-23-sign-ins. Open: a signed-out mobile/social session leaves no record; module columns.
      measured 2026-11-23 (production events, all time, counts only): task 37, care 83 (11 with a person), chat 357, no finance events; last 30 days only coach/doorlog/chat. Module columns would show near-zero; left until those modules carry real team use. The view stays the coaching usage view (Gong's counterpart covers Gong's own features).

## Filed by deal sentiment (2026-11-23, docs/tbc/2026-11-23-deal-sentiment)

- [ ] 2026-11-23 · deal-sentiment · production has 0 calls linked to prospects, so deal sentiment (and last-call dates, briefs in the Ask box) stay empty until reps use "Add to pipeline" on their calls
      cause found and fixed 2026-11-23 (docs/tbc/2026-11-23-call-pipeline-link): the control existed only in Macro Mode and could only create a new prospect; now on every remote call view with existing prospects offered.
      why-unresolved: a workflow step
      next-action: consider prompting "Add to pipeline" at the end of a remote call

## Filed by redaction on every writer (2026-11-23, docs/tbc/2026-11-23-redaction-all-writers)

- [x] 2026-11-23 · redaction · numbers spoken as words ("four one one one …") are not removed from transcripts
      why-unresolved: D15 covers digit runs only
      next-action: a word-to-digit pass before redactNumbers, tested on real transcripts
      done 2026-11-23: redactSpokenNumbers inside transcriptTextForStorage; run over all 2,963 production lines (0 changed after a counting exception) — docs/tbc/2026-11-23-spoken-number-redaction.

## Filed by call notes + erasure coverage (2026-11-23, docs/tbc/2026-11-23-call-notes-erasure)

- [x] 2026-11-23 · erasure · FOUNDER DECISION: practice scenarios built "from this call" (training_scenarios.source_session_id) may describe the customer; erasure doesn't touch them (they are immutable by design). Retire them on erasure, or leave them as manager-written training material?
      why-unresolved: a product/legal judgment
      next-action: decide; if "retire", add a retire of scenarios whose source_session_id is erased (as a 0316 extension)
      decided + done 2026-11-23: founder "Retire them" → 0317 (applied); see docs/tbc/2026-11-23-call-notes-erasure remediate addendum.
- [x] 2026-11-23 · erasure · a rep's daily brain dump (remote_day_plans) may name a customer but has no call key, so erasure can't find it
      why-unresolved: no session to match on
      next-action: match erasure's identifier against day-plan text, show matches to the admin with the calls
      done 2026-11-23: 0322 (applied) — erasure finds day plans (rep + day shown, never the words) and replaces only the identifier — docs/tbc/2026-11-23-erasure-day-plans.

## Filed by message adoption (2026-11-23, docs/tbc/2026-11-23-message-adoption)

- [x] 2026-11-23 · adoption · adoption goals per tracker (a target share, shown against the actual)
      done 2026-11-23: 0318 (applied) — see docs/tbc/2026-11-23-message-adoption remediate addendum.
      why-unresolved: measure first
      next-action: an append-only goal row per tracker; the Adoption panel shows the gap

## Filed by Market (2026-11-23, docs/tbc/2026-11-23-market)

- [x] 2026-11-23 · market · topic labels fragment ("Price" vs "pricing concerns"); no Market view in Sales Coach yet
      part done 2026-11-23: Sales Coach → Analytics now shows Market (in-person calls) to managers; topic grouping stays open.
      why-unresolved: needs a grouping pass; Remote Sales first
      next-action: group similar topics; mount MarketView module="sales_coach" on Sales Coach analytics
      done 2026-11-23: topics that differ only in wording are grouped (word order, small words, word endings) and the wordings are shown — docs/tbc/2026-11-23-market-topic-groups. Grouping by meaning stays open (below).

## Filed by Market topic groups (2026-11-23, docs/tbc/2026-11-23-market-topic-groups)

- [x] 2026-11-23 · market · topics with the same meaning in different words ("pricing" / "monthly price" / "monthly bill amount") are separate rows
      why-unresolved: needs a decision on how to judge sameness — a synonym list, an AI grouping pass, or topic groups a manager names
      next-action: ask the founder which; then build it with the merged wordings visible, as now
      done 2026-11-23: founder chose "AI suggests, manager OKs" — built (0319, applied): docs/tbc/2026-11-23-market-topic-suggestions.

## Filed by topic-group suggestions (2026-11-23, docs/tbc/2026-11-23-market-topic-suggestions)

- [ ] 2026-11-23 · market · FOUNDER CHECK: run "Suggest groups" once on Market with real topics and judge the AI's groups
      why-unresolved: only a manager's click in the product runs it
      next-action: Remote Sales → Market → Topic groups → Suggest groups; accept one, confirm Topics recounts
- [ ] 2026-11-23 · market · legal erasure does not reach topic-group members (company topics on 2+ calls, not tied to a call)
      why-unresolved: needs a rule for matching an erased customer's words to group labels
      next-action: decide whether erasure should drop a member that appears only in erased calls
- [x] 2026-11-23 · market · a manager can edit an AI suggestion but not build a topic group from scratch
      why-unresolved: the founder's choice was AI-suggests-manager-OKs
      next-action: a "Make a group" picker over the topics on 2+ calls, same save route (source "manager")
      done 2026-11-23: "Make a group" and "Edit" on Market → Topic groups — docs/tbc/2026-11-23-topic-group-builder.

## Filed by coaching export (2026-11-23, docs/tbc/2026-11-23-coaching-export)

- [x] 2026-11-23 · coaching · monthly coaching email to managers (the export exists; the subscription doesn't)
      closed 2026-11-23 — not built, by decision: D10 (founder 2026-11-22) makes manager alerts in-app only and switched the managers' weekly email off; a monthly managers' email would contradict it. Reopen only if D10 changes.
      why-unresolved: a scheduled email is its own build
      next-action: a monthly cron beside the weekly digest, sending each manager their coaching CSV numbers

## Correction (2026-11-23, found while testing WeeklyRoutine)

- [x] 2026-11-23 · tests · CORRECTION: earlier entries today said the remote-sales screens have "no component-test harness yet". That was wrong — `@testing-library/react` with `// @vitest-environment jsdom` is already used (RemoteSalesShell.render.test.tsx, MacroCallView.render.test.tsx, and now WeeklyRoutine.render.test.tsx). The Ask box, the pipeline calendar, stage practice, call notes and the transcript editor are simply untested on screen.
      why-unresolved: render tests not yet written for those components
      next-action: add render tests for AskPipeline (citations open the prospect on its tab), RemoteCalendar, StagePractice, CallNotes and the SessionTranscript editor
      mostly done 2026-11-23: render tests for the Ask box (closed-deal citation opens on its tab; mutation-checked), RemoteCalendar, CallNotes, CallPipelineLink, MarketView, AdoptionBoard and the transcript editor. StagePractice (inside RemotePipeline) still untested on screen. — done 2026-11-23 (RemotePipeline.stagePractice.render.test.tsx: the rep starts it and lands in the role-play; no button for someone who can't start it). This correction is closed.
- [x] 2026-11-23 · coaching · a self-coaching routine for reps (their practice due, calls without a review, feedback answered)
      why-unresolved: the manager routine came first (docs/tbc/2026-11-23-coaching-routine)
      next-action: the same pattern on Remote Sales → Today for reps
      done 2026-11-23: "Your coaching this week" on Remote Sales → Today (practice due, feedback answered, calls without a note) — docs/tbc/2026-11-23-rep-routine.

## Filed by the rep routine (2026-11-23, docs/tbc/2026-11-23-rep-routine)

- [x] 2026-11-23 · coaching · an answered feedback request stays a to-do for 7 days even after the rep has read it
      why-unresolved: no "read" record exists for feedback
      next-action: record when the rep opens an answered call's feedback, and count only unread answers
      done 2026-11-23: 0321 (applied) — the call page records the rep seeing an answer; the checklist counts only unseen answers — docs/tbc/2026-11-23-feedback-seen.

## Filed by close dates (2026-11-23, docs/tbc/2026-11-23-close-date)

- [x] 2026-11-23 · forecast · forecast by month only — no quarter view, no what-if (move a deal's date and see the months change)
      why-unresolved: months first
      next-action: a quarter toggle summing the month rows; a what-if that changes dates on screen only, never stored
      part done 2026-11-23: Months / Quarters switch — docs/tbc/2026-11-23-forecast-quarters. The what-if stays open.
      done 2026-11-23: "What if?" on screen only — docs/tbc/2026-11-23-forecast-what-if.

## Filed by erasure of day plans (2026-11-23, docs/tbc/2026-11-23-erasure-day-plans)

- [x] 2026-11-23 · erasure · a pipeline prospect never linked to a call keeps its name/organization after the customer is erased
      why-unresolved: 0316 reaches prospects only through linked calls
      next-action: match the identifier against remote_prospects_current name/organization in the erasure search; list and blank them like day plans
      done 2026-11-23: 0323 (applied) — docs/tbc/2026-11-23-erasure-prospects.
- [x] 2026-11-23 · erasure · a day plan that names the customer differently ("Betty" for client "Betty Ross") isn't found
      why-unresolved: a first name alone would match other customers
      next-action: say in the panel that a shorter name can be searched separately
      done 2026-11-23: the panel says so when searching by client name — docs/tbc/2026-11-23-erasure-polish.

## Filed by refresh notes (2026-11-23, docs/tbc/2026-11-23-refresh-notes)

- [x] 2026-11-23 · transcript-edits · the call page doesn't say when its AI notes are older than the latest correction
      why-unresolved: needs the notes' build time compared with the latest edit
      next-action: show "notes predate the corrections" and the refresh button only then
      done 2026-11-23: docs/tbc/2026-11-23-stale-notes.

## Filed by rep needs (2026-11-23, docs/tbc/2026-11-23-rep-needs)

- [ ] 2026-11-23 · stage-training · MANAGER STEP: tag practice scenarios with the rubric items they train (Training → "Trains:" → "+ Rubric item"); until then the ranking has nothing to rank by
      why-unresolved: a manager's judgement of what each scenario trains
      next-action: tag the existing scenarios once; check a prospect card shows "Trains … — missed on N of the last M"

## Filed by car controls (2026-11-23, docs/tbc/2026-11-23-car-controls)

- [ ] 2026-11-23 · playback · FOUNDER CHECK: play a recorded call on a phone, lock it, and use the lock-screen (or car) controls — play/pause and ±15 s should work, titled "Recorded call"
      why-unresolved: needs a real device
      next-action: one try on iPhone Safari and one on Android Chrome

## Filed by pipeline changes (2026-11-23, docs/tbc/2026-11-23-pipeline-changes)

- [x] 2026-11-23 · forecast · no pipeline value trend over weeks and no stage funnel
      why-unresolved: changes first
      next-action: replay the same events into open value per week (a small chart) and counts per stage (a funnel)
      done 2026-11-23: docs/tbc/2026-11-23-pipeline-trend.

## Filed by the company-departure question (2026-11-23)

- [ ] 2026-11-23 · retention · FOUNDER: review and ratify (or deny) AMD-015 — deleting a company's data after its contract ends (docs/amendments/AMD-015-PROPOSED-company-departure-deletion.md); decide the grace period (30 or 90 days) and the two defaults it lists
      why-unresolved: a constitutional amendment (§7) — only the founder ratifies
      next-action: once ratified, build: contract-end date in the vendor back office, the export, the scheduled deletion job and its record, and the privacy-page wording

## Filed by the General Sales Interface PDF (2026-11-24, docs/tbc/2026-11-24-macro-simple)

- [x] 2026-11-24 · coaching · FOUNDER APPROVAL: the published research behind the coaching wording (the PDF's "Harvard research") — the agent brings studies and exact quotes; nothing is shown in the product until approved
      why-unresolved: founder picker "I'll find & you approve"
      next-action: review the proposed citations and wording rules; on approval, apply the rules to the coaching prompt and add the line on the Coaching tab
      done 2026-11-24: approved "Rules + cite 3 studies" — docs/tbc/2026-11-24-coaching-research.

- [ ] 2026-11-24 · crm · CUSTOMER SETUP: "Send to CRM" (docs/tbc/2026-11-24-crm-send) works once a company admin adds a webhook in Remote Sales → Protection → Webhooks subscribed to "A call is sent to your CRM", wired into their CRM (its own automation or a connector such as Zapier)
      why-unresolved: external config each customer owns (§1.5.3); until then reps see a plain 409 telling them who sets it up
      next-action: include it in onboarding for any company using Macro Mode; build a native Salesforce/HubSpot connector only if customers ask
- [ ] 2026-11-24 · trackers · FOUNDER CHECK: add one smart tracker ("Same idea, any words") with 2–3 example sentences and look at the calls it marks — are the matches right? (docs/tbc/2026-11-24-smart-trackers R1)
      why-unresolved: AI match quality can only be judged on real calls
      next-action: if matches are loose, tighten SMART_SYSTEM's "when unsure, leave it out" rule with the founder's examples
- [ ] 2026-11-25 · macro · FOUNDER CHECK: with Macro Mode on (as a manager), Remote Sales should show only Today · Pipeline · Calls, open on Today the first time each day, show the pipeline as a table, and show a call's three tabs beside the player (docs/tbc/2026-11-24-macro-pdf-correction R1)
      why-unresolved: render tests only; not yet seen in a signed-in browser
      next-action: say what still differs from the PDF and it gets fixed
- [ ] 2026-11-25 · patterns · repeated misses on phone/video calls don't become patterns: runDetection reads door-rubric scores only (docs/tbc/2026-11-24-score-own-rubric R1)
      why-unresolved: patterns were designed on the door rubric
      next-action: extend detection to each rubric's own items once phone/video calls are being scored
- [x] 2026-11-25 · patterns · CORRECTION to the entry above ("repeated misses on phone/video calls don't become patterns"): that is a recorded decision, not a gap — Pattern Interrupt is Sales Coach, in-person only (2026-11-22, d4fc60d1; readPatterns.ts says so). Nothing to build.
- [x] 2026-11-25 · rss-p3 · (the 2026-11-15 item "the scorer reads rubric_config per channel … and supports N/A per element") DONE: per-channel rubrics since D6 (rubricRegistry, 2026-11-22); N/A per element by a manager's correction, 0331 (docs/tbc/2026-11-24-rubric-item-na).
- [ ] 2026-11-25 · webhooks · VERIFIED MISSING: production /api/health (commit 7f02329) reports capabilities.webhooks = false — RSS_WEBHOOK_SIGNING_SECRET is not set in Vercel. Until it is, every webhook (session.scored, session.closed, deal.closed, call.to_crm) is queued and not sent, and "Send to CRM" tells the rep it isn't switched on (docs/tbc/2026-11-24-crm-send-fail-loud). Same check also shows email = false.
      why-unresolved: founder-owned config (the item at line 176)
      next-action: set RSS_WEBHOOK_SIGNING_SECRET (a long random string) in Vercel → redeploy → /api/health shows webhooks: true
- [ ] 2026-11-25 · privacy · RE-ASKED with new evidence: production /api/health shows anthropic = false — every AI read runs on DeepSeek, which the privacy page doesn't name, while it names Anthropic (src/app/privacy/page.tsx:305). Founder picker 2026-11-25: "Leave it for now" (same as 2026-11-23).
      why-unresolved: founder decision
      next-action: when revisited — name DeepSeek and drop any no-training claim we can't stand behind, or set ANTHROPIC_API_KEY so the page is true
- [x] 2026-11-26 · stable-paging · paged reads (fetchAllPaged / .range) ordered by a NON-unique key can repeat or skip rows between pages
      why-unresolved: found in today's code and fixed (hides, coverage, tracker preview); older reads still order by started_at, seq, created_at or nothing: kpi/team, kpi/me, kpi/compute-cron, coaching-metrics sessions, my-points, salesElo, schedule/*, admin/coach-readout, team-activity, pitch-score/backfill, dissectBackfill, teamTrainingBrief, finance, data/care, data/doorlog.
      next-action: add a unique tiebreaker (.order("id")) to each, then an invariant in scripts/invariant-audit.mjs that refuses a paged read whose last order key isn't unique.
      2026-11-26: resolved — every paged read orders by a unique key last; Invariant 42 (scripts/invariant-audit.mjs) refuses a new one. docs/tbc/2026-11-26-paging-invariant.
- [ ] 2026-11-26 · call-events-access · 233 events about ONE company's calls are stamped with FOUR other companies' company_id (production, counts only)
      why-unresolved: kinds coach.session_status_changed (56), after_pitch_summary_generated (41), session_summary/pivot (25 each), dissect (22), intel (22), outcome (15), moments (14), dissect_attempted (13); created 2026-08-09..17, every one at exactly 16:00 — seed-like. Until 0348 the other companies' members could read those AI reads through events' company rule; since 0348 they can't (the call isn't theirs). The rows themselves are still mis-stamped.
      next-action: find what wrote them (a demo/seed script cloning events across demo companies?) and fix it; decide whether the 233 rows are demo data that can be left, or need a founder-approved correction (events are append-only).
      note [INFERRED]: no seed script writes these kinds; the actor of every row is the call's own rep, and record_event() stamps the actor's company at write time — so the likelier cause is that account moving between companies during 9–17 Aug (e.g. testing pilot codes). If so, any account that changes company leaves its earlier events readable by the old company; 0348 now closes that for call events.
      2026-11-26: forward fix — 0349 stamps every new call / score event with the call's own company (a writer from another company is refused). Only the 233 existing rows remain, a founder decision.
      2026-11-26: 0350 — legal erasure now deletes a call's events by subject wherever they were filed, so the 233 rows can't outlive a customer's erasure.
- [x] 2026-11-26 · erasure · score notes (pitch:<id> events: a rep's dispute, a manager's answer) are not erased by rss_erase_sessions, before or after 0350, and can quote the customer (independent review of 181b459f..19d07354; docs/tbc/2026-11-26-review3-fixes R1)
      why-unresolved: founder decision — 0285 excluded notes a person retyped. Picker failed three times on 2026-11-26 ("Stream closed").
      next-action: recommended — erasure blanks the typed text of those events and keeps that the dispute happened, who wrote it and the score (the callback-task rule); alternatives: leave them, or delete those events.
      DECIDED 2026-11-26 (founder picker): "Blank the text". DONE in 0366 — dispute and answer notes and score-correction reasons become "[erased]"; the record, author, time and score stay (docs/tbc/2026-11-26-erasure-score-notes).
- [ ] 2026-11-26 · call-categories · F10.10 / F10.9: phone/video calls have no category to filter by
      why-unresolved: founder decision. Picker failed three times on 2026-11-26.
      next-action: recommended — the rep picks one at close from a fixed list the company admin sets (no AI guess); alternatives: AI suggests and the rep confirms, or not now.
      DECIDED 2026-11-26 (founder picker): "Rep picks at close" from an admin-set list. To build.
- [ ] 2026-11-26 · vocabulary-past-calls · F8.9: a company's "heard as" corrections (0354) fix NEW transcript lines only; Gong also re-applies them to past calls
      why-unresolved: founder decision (cost). Re-applying writes a new transcript version for each past call whose lines change (as trim does with copy_transcript_version), and each such call's AI reads (summary, moments, intel, brief) then re-run on the new version — one paid AI pass per changed call. Production today: 0 vocabularies.
      next-action: recommended — re-apply on request per vocabulary change, showing first how many calls would change and that their AI reads re-run; alternatives: re-apply text only and keep the old AI reads (they'd quote the old words), or leave past calls as they are.
      DECIDED 2026-11-26 (founder picker): "On request, with a count". To build.
- [x] 2026-11-26 · brief-templates-auto · should brief templates also run automatically after every call (a paid AI pass per call per template)?
      DECIDED 2026-11-26 (founder picker): "On click only". Nothing to build; the current behavior stands.

- [x] 2026-11-27 · erasure-recording-comments · comments typed on a call's recording (recording_comments.body and its revisions) can quote the customer and aren't blanked by legal erasure (independent review of 7c81ab49..9a7428b6)
      DECIDED 2026-11-27 (founder picker): "Leave them" — erasure keeps 0285's rule for comments: transcripts, AI reads and score notes are erased; comments a person typed stay as typed.

## Filed by the revenue stack and Engage builds (2026-11-27)

The Gong-competitive build (docs/ELOSTATE-REVENUE-BUILD-PLAN, docs/ELOSTATE-ENGAGE-PLATFORM-BUILD-PLAN). Each item below is
a capability that is built as far as this server allows and waits on a setting only the founder can add (§1.5.3). The
product says so where it matters, never silently.

- [ ] 2026-11-27 · engage-e1 · Flow email steps are sent by the rep from their own mail app; EloState sends no email.
      why-unresolved: `POSTMARK_SERVER_TOKEN` and `CARE_EMAIL_HOST_DOMAIN` are unset in production (`emailConfigured()`), and an opt-out footer needs legal wording not drafted here.
      next-action: set both in Vercel, supply the opt-out wording, then build automatic email steps behind `emailConfigured()`.
- [ ] 2026-11-27 · engage-e1 · Call steps dial from the rep's phone (`tel:`); there's no in-app dialer or recording of those calls.
      why-unresolved: needs a Twilio account, numbers and per-region recording consent (plan E4).
      next-action: founder decides on Twilio; then numbers, the dialer and per-region recording rules.
- [ ] 2026-11-27 · engage-e4 · MCP and API keys are company-wide; there are no keys that act as one person.
      why-unresolved: acting as a person needs a JWT secret (`SUPABASE_JWT_SECRET`) this server doesn't have (plan E8).
      next-action: add the secret in Vercel; then personal MCP keys that sign a short-lived user token so RLS applies.
- [ ] 2026-11-27 · revenue-p3a / p4 / engage-e5 · Warnings are live only (no 30/90-day drivers history), and agents have no date triggers (close date approaching).
      why-unresolved: both need a scheduled job, and `CRON_SECRET` is unset in Vercel.
      next-action: set `CRON_SECRET`; add a daily warnings snapshot and a date-trigger sweep.
      prerequisite found 2026-11-27: the nightly job runs as the service role, but `listProspects` (the reader dealRisk
      needs) relies on the caller's RLS in about ten reads (tasks, accounts, deal contacts, rss_deal_signals, the stage
      list, the playbook). It must first take a company and pin every one of those reads to it; otherwise a sweep would
      read across companies. Build that pinned reader together with the job, and verify both once the secret is set.
      update 2026-11-27 (181e4ee3): the pinned reader is built and tested — `listProspects(admin, undefined, { companyId })`
      pins every table read. What remains is the job itself (snapshot table, close-date trigger, cron route), once
      `CRON_SECRET` is set so it can be verified end to end.
- [ ] 2026-11-27 · revenue-r2 · No CRM sync (Salesforce / HubSpot / Dynamics).
      why-unresolved: no client CRM is on record to sync with (plan R2).
      next-action: when a paying client names their CRM, build its connector first.
