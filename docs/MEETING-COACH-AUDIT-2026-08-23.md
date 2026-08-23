# Meeting Coach (Team-Sync) — System Audit, 2026-08-23

**Why this exists.** Founder directive: "audit the Team Coach system… make sure the Meeting Coach is sound and
there are no UI and Backend bugs." A 4-agent parallel audit (backend routes + data layer, security + RLS, UI/UX,
end-to-end integration + capture) plus live behavioral probes swept the whole surface: Prep-up (collect →
agenda-aware live coach → agenda-scored review), the meeting-session routes, the recorder/capture, RLS, and the UI.
Every agent finding is a **suspect**; each was re-verified against the code before any fix (A26).

**Verdict.** The core is **sound**. No HIGH security issue (no reachable cross-tenant read/write, no live XSS/RCE).
The bugs that mattered clustered in two places — an **audio-loss seam on clean Stop** and the **Prep-up UI + data
layer** (silent data loss / dead-ends / error-as-no-data). All HIGH + the impactful MED are **fixed, deployed, and
verified**; the remainder are defense-in-depth or multi-company-latent, flagged below.

Severity: **HIGH** = data loss or a falsehood shown to the user · **MED** = degraded honesty / recoverable ·
**LOW** = cosmetic / latent.

---

## Verified SOUND (checked, no defect)

- **Auth + tenant isolation.** Every mutation route: `getUser` + company context; cue/end/dissect enforce
  `session.agentId === user.id` (owner, INV19) + a `mode==='sales'` mis-route guard. Service-role writes pin
  `company_id` (INV15).
- **RLS — behaviorally probed against prod.** `meeting_preps` + `meeting_prep_documents` have RLS enabled; an
  `anon` role sees **0 rows** (of a real row present); policies scope to `created_by`/parent-owner + `company_id`
  on writes. No `USING(true)` leak.
- **Validation** (zod on every body), **CWE-209** (no raw error leaks), **maxDuration** (on exactly the LLM/STT
  routes), **the document upload** (signed target scoped + owner-gated before signing; storage RLS confines writes
  to the caller's company), and the **LLM prompt-injection fence** (`CONVERSATION_IS_DATA` on the transcript +
  agenda + OCR doc-context) — all present + correct.
- **Mode routing / the `coaching_cues.mode` CHECK landmine** — behaviorally confirmed: the prod CHECK is
  `('suggestion','guide_response')`; the cue route maps `directive → guide_response` at a single chokepoint, so a
  meeting cue can't violate it. The cross-domain leak gate + the imbalance-suppression gate are correct.
- **H4 dissect self-heal** — a transient dissect failure writes no backoff marker (retries); only a genuine empty
  backs off. **Never-Stop capture** — the stale-close cron stitches an `active` session's chunks.

---

## HIGH — fixed

- **A1 (integration) — clean-Stop audio loss → permanently unreviewable + false "review ready".** A clean Stop
  whose full-blob persist failed left `audio_asset_url` NULL with the live 15s chunks in storage; the only stitch
  trigger is the stale cron (`status='active'`), but `/end` set `'ended'` → nothing assembled the chunks → the
  review 409-looped forever, while the UI said "recording saved." **Fixed** (`66ee5ea5`): the dissect route
  **stitches-on-demand** when audio is null (self-healing); honest 409 only if truly no chunks.
- **A2 (UI) — false "review ready" + dead-end after a session that never recorded.** A mic-denied / connect-error
  / instant-stop session offered a Review link that 409-looped forever + copy claiming the recording saved.
  **Fixed** (`9ee0f089`): only offer the review + stamp `/end` when the session actually went live; else return to
  setup.
- **A3 (UI) — Prep-up data silently lost on a quick "Start".** Goal/topics autosaved on a 700ms debounce that
  Start dropped on unmount → the meeting bound an EMPTY prep, silently defeating the whole agenda feature.
  **Fixed** (`9ee0f089`): Start flushes a final save before handing off; a save failure blocks Start + surfaces.

## MED — fixed

- **A4 — prep→session link silent no-op** (`markMeetingPrepStarted` returned true on a 0-row update) → agenda-less
  meeting reported as "prep loaded." **Fixed** (`66ee5ea5`): row-count check → false on no-op; create route logs +
  returns the real result.
- **A5 — coverage silently never accumulated** (36-char UUID topic ids the LLM had to echo verbatim) + the dissect
  discarded live coverage. **Fixed** (`66ee5ea5`): short topic ids + the dissect ORs-in live coverage.
- **A6 — error-as-no-data** (`getMeetingPrep` → false 404, `listPrepDocuments`/brain reads swallowed errors) +
  autosave failures swallowed. **Fixed** (`66ee5ea5` + `9ee0f089`): user-facing reads throw → honest 500; brain
  reads log-and-degrade; autosave errors surfaced.
- **A7 — light-theme legibility** (accents `text-*-300/400` washed out on white; Prep-up rows white-on-white;
  file input keyboard-unreachable; duplicate heading). **Fixed** (`9ee0f089`): `text-{c}-700 dark:text-{c}-300`,
  theme tokens, `sr-only` focusable input, heading rename.

## LOW — fixed
Review Retry gated to retryable errors + a "Back to Meeting Coach" escape; a real tap target on remove-topic
(`9ee0f089`).

---

## Deferred (flagged — single-company-safe today)

- **D1 — ✅ RESOLVED (`260aa536`, deploy-verified; founder chose "make the huddle agenda-aware").** The huddle
  brain now consumes `context.agenda`: `HuddleStrategy` forwards it, the huddle prompt gained an agenda block +
  the `uncovered_topic` trigger + a `covered` output (tuned tight — the agenda adds one reason to speak: a
  must-cover point missed at the end; a prep-less huddle renders no block, no regression). Verified the dissect
  route already loads the agenda for huddles (kind-agnostic, sales-excluded) + ORs-in live coverage, so D1 feeds
  the same coverage the dissect consumes — the inconsistency is closed, not merely reshaped. +5 tests. TBC
  `docs/tbc/2026-08-23-meeting-coach-d1-d2-audit-remediation/`.
- **D2 — ✅ RESOLVED (`260aa536`, deploy-verified).** The prep-doc route now routes both shapes through the
  `validateUploadCandidate` chokepoint (a spoofed `image/svg+xml` is blocked though `classifyKind` alone would
  pass it) + re-checks the REAL size via `getAssetObjectInfo` at confirm (413 over-cap / 400 phantom before
  buffering) — so the app-layer cap fails LOUD regardless of the live bucket `file_size_limit` (AMD-011
  belt-and-suspenders). `extractImageText` refuses an image-bomb via a `sharp` header read before Tesseract
  decodes it. A26 class swept: the doc route was the only in-class instance (door-log sign excluded — server-const
  `pitch.webm`; care/upload/sign + files/upload-url + upload-recording/sign already validate). +7 tests.
- **D3 — coverage whole-JSONB lost-update race.** `setMeetingPrepTopicsCovered`/`updateMeetingPrep` overwrite the
  whole topics array with no concurrency control; latent because the hook fires one cue at a time. *Additive
  coverage set / optimistic concurrency if concurrency is introduced.*
- **D4 — multi-company LOWs.** cue/dissect load prep by `session_id` without a `session.companyId===companyId`
  assertion; `meeting_prep_documents.company_id` isn't constrained to the parent prep's; `persistOnly` finalize
  doesn't check the stamp row-count. All safe under single-company; harden at the multi-company milestone.
- **D5 — UI polish.** ✅ ALL FOUR CLEAR ITEMS FIXED + deployed: orphan draft prep on every `/prep` visit
  (`67d522f4` — server reuses the caller's truly-empty draft); forced-cue raw HTTP status → plain message
  (`3b17cf51`); empty-prep Start nudge (`581b1ca6` — passive, Start still enabled); pending-audio copy names the
  terminal "not recorded" case (`3f23af7d`). REMAINING = one deeper UX-design call for the founder only: a HARD
  auto-terminal state after N retries (auto-detect "not recorded" + hide Try-again) — the passive copy fix ships
  the honest interim.

---

## Commits
UI fixes `9ee0f089` · backend/wiring fixes `66ee5ea5` · **D1 + D2 remediation `260aa536`** · **D5 (all clear items):
forced-cue copy `3b17cf51`, orphan-draft reuse `67d522f4`, empty-prep nudge `581b1ca6`, pending-audio copy
`3f23af7d`** (all deploy-verified). Prior related this session: capture instrumentation + iOS fix
(`a9402dcb`/`75ad8c2d`/`55fd7837`), reliability audit (H1–H4/M/L), Prep-up + go-live. (A SEPARATE mobile Sales
Coach UX audit this session shipped F1–F5 + class-completions — see its own commits `0affa4c3`/`a56124e1`/`5f8497a2`.)

## How to confirm at go-live
Run `docs/MEETINGCOACH-DEVICE-VALIDATION.md` on real hardware (Prep-up → agenda-aware cues → agenda-scored review;
+ the iOS pitch-capture check). **D1, D2, and all of D5's clear items are done + deployed.** Remaining follow-up
backlog (single-company-safe today): **D3** (latent coverage race — needs a migration/concurrency guard), **D4**
(multi-company milestone), and one **D5 UX-design call** (a hard auto-terminal state on the pending-audio review).
