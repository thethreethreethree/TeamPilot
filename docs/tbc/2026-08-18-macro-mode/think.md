---
tbc_version: 1
trigger: feature
started_at: 2026-08-18T12:00:00Z
doc_hashes:
  CLAUDE.md: 3325eedc1e905b2798d196dae087664e3da7031a66005b1f89379b6da959a9e3
  ThinkerThinker.md: 19d6ff103082c1f29ee98653b84cce2a26308352511756f6e104a8db36df84c9
manifest_entries: 11
hypotheses: 1
status: PHASE-1 (think) done + decision-independent logic pre-built (uncommitted); schema/RLS/UI blocked on Q2 + Q4
---

# THINK — Macro Mode (Door Log + Report Card)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (3325eedc…) + ThinkerThinker.md (19d6ff10…) in-tree; hashes equal DOC_MANIFEST.json.
Build source of record: `BUILDPROMPTdoorlogreportcard.md` (founder-provided) + two spec images + the
founder's framing ("a toggle on/off **Macro Mode** on the Sales Coach dashboard, web + mobile").

## 2. Why (from the founder brief spec 1.2)
Door-to-door reps need pitch **recording** (a fast, one-handed, outdoor task) separated from **feedback**
(a slow, reflective, indoor task). Today they share one surface, so the fast task waits on the slow one and
reps abandon the tool. Macro Mode splits them into two tabs and moves all feedback processing to the
background. The centre of gravity is the **macro pattern summary** — recurring patterns *across* a rep's
pitches over time, not per-pitch critique ("nobody checks feedback after every pitch — they do it on a
macro level").

## 3. What it is
A toggle-able **mode of the Sales Coach** (not a new product). When on, the rep gets:
- **Tab 1 · Door Log** — a strict 4-state machine `IDLE → RECORDING → OUTCOME → NAMING → IDLE`; KPI strip;
  two thumb-zone actions (`No Answer`, `Record Pitch`); sound-bar while recording; 4 outcome tags; pre-filled
  name. **Hard rule: Stop → next door in ≤2 taps, zero waiting.** Upload/STT/analysis are fire-and-forget.
- **Tab 2 · Report Card** — dense: AI macro-pattern hero (working / hurting + trend vs. previous period,
  over Day/Week/Month/All-Time), trend chart, pitch list, per-pitch detail.

## 4. Phase 0 map — corrections to the build prompt's spec-3 assumptions (the earned understanding)
The prompt was written against a generic schema; the repo's real conventions **shrink** the build (most of the
infrastructure already exists and gets reused):

| Prompt assumed | Repo reality (verified Phase 0) → decision |
|---|---|
| `org_id` tenancy | **`company_id`** (0001_init) — used on every table, policy, index, storage path |
| new `pitch_jobs` generic queue | **No generic queue exists.** Pattern = `status` column + Vercel cron-sweeper + `after()` (mirror `backfill-dissects-cron` / `recording-purge-cron` / `kpi/compute-cron`). **Drop `pitch_jobs`; add `pitch-processing-cron`** — exactly what spec 3.3 prescribes when a pattern exists. 5 tables, not 6. |
| define a pitch rubric | **Exists**: `src/lib/coach/v5/salesReview*`, `salesScore`, `afterPitch*`, `salesElo`. **Q9 = reuse it** (a second "good pitch" definition is a defect). |
| write an ElevenLabs STT step | **Wrapper exists**: `src/lib/care/voice/elevenlabs.ts` + coach `persistRecording.ts`. Reuse. |
| `llmCall`/`llmStream` (TBD) | `src/lib/llm/index.ts` (`LlmCallArgs`), DeepSeek→Anthropic cascade. |
| routes at `/doors` | Convention = `dashboard/sales-coach/**`. Use `dashboard/sales-coach/doors` + `.../report-card`. |
| new `pitch-audio` bucket | Reuse the existing coaching-recording bucket + signed-upload + purge-cron (client→storage signed URL, never through a route handler). |
| migration number | **`0215` confirmed next** (latest = `0214`). |
| toggle mechanism (absent) | Macro Mode hooks into `src/lib/auth/moduleAccess.ts` / `src/lib/coach/v5/skillAccess.ts` — a Sales-Coach feature toggle, not the account-level module hard-lock. |

### 4a. Precise reuse targets (Phase 0, verified — no new infrastructure)
- **STT** — `src/lib/care/voice/elevenlabs.ts`: `transcribeSpeech(args)` (basic) / `transcribeWithDiarization(args)`
  (speaker-separated). Reuse; do NOT write a new STT wrapper. (`mintRealtimeSttToken` is for live realtime —
  not needed here; pitches are recorded-then-transcribed.)
- **Storage** — `src/lib/storage/assets.ts`: `ASSETS_BUCKET` + `createSignedUploadUrl(...)`. Reuse the existing
  recording bucket + signed-upload helper (25 MB cap) + the established flow (client → signed URL → storage →
  POST `{ storagePath }`). Do NOT create a new `pitch-audio` bucket; fit the pitch audio path into `ASSETS_BUCKET`.
- **LLM** — `src/lib/llm/index.ts`: `llmCall(args: LlmCallArgs)` / `llmStream(args)`.
- **Cron pattern** — mirror `src/app/api/coach/sales-session/backfill-dissects-cron` / `recording-purge-cron`
  (CRON_SECRET-gated, registered in `vercel.json`, status/needs-based sweep).
- **Rubric** — `src/lib/coach/v5/salesReviewPrompt.ts` + `salesScore.ts` (per-pitch scoring already defined).
- **`updated_at` trigger** — convention is a per-table `touch_<table>_updated_at()` fn + `before update` trigger
  (e.g. `bump_company_updated_at`, `touch_care_tenant_config_updated_at`). Only `pitches` carries `updated_at`.
- **RLS helpers** — `auth_company_id()` (the tenancy helper, 379 uses) + `is_vendor_super_admin()`. Tenant
  scope = `<table>.company_id = auth_company_id()`; owner scope = `rep_id = auth.uid()`.
- **Q4-ready policy shapes** (write once Q4 is answered):
  - *rep-only:* `rep_id = auth.uid() and company_id = auth_company_id()`.
  - *rep+manager (mirror 0084):* `rep_id = auth.uid() OR exists(select 1 from profiles p where p.id=auth.uid()
    and p.company_id = pitches.company_id and (p.role in ('CEO','COO','admin') or p.sales_coach_role='admin'))`.
  - *child tables* (`pitch_transcripts`/`pitch_analyses`): readable iff the parent `pitches` row is readable
    (nested `exists`); **written only by the service-role** worker (bypasses RLS).

## 5. Four-layer evaluation (§1.5.1)
1. **Build structure** — reuse the coach's STT / rubric / storage / cron / LLM chokepoint; add only the 0215
   schema, one cron, two prompts, two UIs, one toggle. No parallel infrastructure.
2. **Operational effectivity** — the DoD is behavioural: door→outcome→named→next in ≤4 taps, zero blocking
   waits, on throttled 3G; killing the network loses no knocks; a failed pitch surfaces in Report Card, never
   the Door Log.
3. **Synergetic composition** — Macro Mode composes with the existing Sales Coach (shared rubric/session
   model) and the toggle mechanism; must not break the current coach surface when off.
4. **UI/design** — Door Log = minimal, thumb-zone, 44×44 targets, sunlight contrast, tokens only. Report Card
   = dense/insight-first. The friction budget lives entirely in the Door Log.

## 6. Interconnections traced (§1.5)
- Reusing the coach rubric means per-pitch analysis and the Live Coach stay one definition of quality.
- The macro rollup is a NEW artifact (`rep_pattern_summaries`) — must correlate outcome distribution with
  behaviour, and read the previous period's summary for the trend.
- Storage + STT + signed-upload reuse means the RLS + purge discipline already audited applies here.
- The toggle must gate visibility without confining the account (distinct from module hard-lock).

## 7. OPEN QUESTIONS — answer or defer IN WRITING before the phases they block (spec-7 of the prompt)
🔴 = hard blocker (schema/RLS/legal). Nothing past this file is written until 🔴 are answered.

| # | Question | Blocks | Status |
|---|---|---|---|
| **Q2** 🔴 | **Recording consent** — two-party-consent states. Is there a disclosure/consent step, or a legal decision? No covert-recording UX by default. | ship + Door Log flow | **OPEN — founder** |
| **Q4** 🔴 | **Who sees a rep's pitches / audio / Report Card** — rep-only / manager / org? | every RLS policy | **OPEN — founder** |
| T1 | **Macro Mode toggle**: replace vs. alongside the current coach dashboard? per-rep or per-company? who flips it? | toggle design, routes | **OPEN — founder** |
| T2 | **"Mobile app"**: responsive/PWA of this app, or a separate native app? | scope | **OPEN — founder** |
| Q1 | `No Answer` + `Non-Decision Maker` get their own KPI tiles? | KPI header/view | OPEN — lean: 4 named tiles + tap-to-expand for the 2 |
| Q3 | Audio retention — keep or delete after analysis? | storage policy, playback | OPEN — tie to existing purge-cron retention |
| Q5 | What defines a "sales day" — device tz / org tz / cutoff? | `local_date`, rollups | OPEN — lean: device tz, captured client-side |
| Q6 | Naming mandatory or skippable? | NAMING screen | OPEN — pre-fill makes Save one tap either way |
| Q7 | Offline capture in v1? | offline queue | OPEN — recommend YES (No-Answer must work offline) |
| Q8 | Capture address/GPS per door? | schema, privacy | OPEN — not requested; "Go Back" weaker without it |
| Q10 | Is "Report Card" the final name? | routes, copy | OPEN — client neutral |

## 7a. Decision-independent logic PRE-BUILT while Q2/Q4 pending (uncommitted, `src/lib/coach/doorlog/`)
Built + tested the 5 of 7 spec-5 targets that depend on NO open question (18 tests, typecheck clean):
- `stateMachine.ts` (spec 5.1) · `outcomes.ts` (spec 5.2) · `retryBackoff.ts` (spec 5.4) · `salesDay.ts` (spec 5.5,
  Intl-based, avoids the UTC-day bug) · `analysisSchema.ts` (spec 5.7, malformed LLM JSON → null → retry).
- NOT built (would guess a blocked decision): spec 5.3 offline queue (Q7 scope), spec 5.6 RLS (Q4 model).
- Also drafted (scratchpad, not applied): the full `0215` migration with BOTH Q4 policy variants.

## 8. Hypothesis (§1.5.2)
H1: because STT, rubric, storage, signed-upload, cron-background, and the LLM chokepoint already exist, the
net-new surface is small and composes cleanly — the risk concentrates in (a) the Door Log latency/offline
guarantees and (b) the macro-rollup prompt actually finding cross-pitch patterns (not per-pitch summaries).
Both are covered by the spec-5 test plan (state machine, offline idempotency, rollup boundaries, RLS, LLM contract).

## 9. Manager-visibility TODO (Q4-gated)
Per prompt spec 3.2: until Q4 is answered, implement **rep-only** access; leave the manager/org policy as an
explicit TODO here. Do NOT guess a permission model for someone else's audio recordings.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-18T12:00:20Z", "source_file": "CLAUDE.md", "line_range": "1-40", "why_it_governs": "Understanding precedes solving — map the repo before designing the feature.", "how_this_build_will_embody_it": "Phase 0 mapped real conventions + corrected the prompt's spec-3 assumptions before any code." },
  { "id": "§0.1", "read_at": "2026-08-18T12:00:35Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Build prompt + hashes verified in-tree; no amendment." },
  { "id": "§1.5.1", "read_at": "2026-08-18T12:00:50Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer feature evaluation.", "how_this_build_will_embody_it": "Section 5 evaluates structure→effectivity→composition→UI." },
  { "id": "§1.5.2", "read_at": "2026-08-18T12:01:05Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-search; proactive question surfacing.", "how_this_build_will_embody_it": "All 10+ open questions surfaced in spec-7 before they block." },
  { "id": "§1.5", "read_at": "2026-08-18T12:01:20Z", "source_file": "CLAUDE.md", "line_range": "78-100", "why_it_governs": "Holistic interconnection tracing.", "how_this_build_will_embody_it": "Section 6 traces rubric/storage/toggle ripple." },
  { "id": "§3.4", "read_at": "2026-08-18T12:01:35Z", "source_file": "CLAUDE.md", "line_range": "330-345", "why_it_governs": "Honesty — a failed pitch must not be dressed as no-data.", "how_this_build_will_embody_it": "Failures surface in Report Card, never the Door Log; malformed LLM JSON is a retry, not a silent write." },
  { "id": "§6", "read_at": "2026-08-18T12:01:50Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Decision checklist — real vs incidental constraints, holistic.", "how_this_build_will_embody_it": "Q2/Q4 treated as real constraints (blockers), not worked around." },
  { "id": "A19", "read_at": "2026-08-18T12:02:05Z", "source_file": "ThinkerThinker.md", "line_range": "453-475", "why_it_governs": "Consult in-tree code before designing.", "how_this_build_will_embody_it": "Read llm/index, care/voice/elevenlabs, coach/v5 rubric, moduleAccess, cron routes." },
  { "id": "A22", "read_at": "2026-08-18T12:02:20Z", "source_file": "ThinkerThinker.md", "line_range": "592-605", "why_it_governs": "Citations require in-session reading.", "how_this_build_will_embody_it": "Every asset cited here was opened this session." },
  { "id": "A30", "read_at": "2026-08-18T12:02:35Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Encode each lesson as a structural gate (a guard/test that fails if the class recurs), not just prose that a future reader can ignore.", "how_this_build_will_embody_it": "The test plan + RLS test + LLM-contract test are the structural guards; the schema/RLS bugs were caught by the repo's own gates." },
  { "id": "A38", "read_at": "2026-08-18T12:02:50Z", "source_file": "ThinkerThinker.md", "line_range": "999-1006", "why_it_governs": "'Verified' is a claim about a command actually run — paste the canonical command's output + exit code, never assert green from memory.", "how_this_build_will_embody_it": "check.md/closure.md paste the gate + rls:audit + verify:live results; the DB state is verified by db:apply's own verify:live run." }
]
```
