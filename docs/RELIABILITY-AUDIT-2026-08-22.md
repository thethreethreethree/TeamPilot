# Reliability Audit — Field Capture / Save / Analyze Pipeline (2026-08-22)

**Why this exists.** After the founder-urgent "Your last pitch didn't save on our end" bug (fixed, commits
`506a93d0` / `e62e345a`), we swept the whole capture → save → persist → transcribe → analyze pipeline for the
same *class*: places where a rep's data can be **silently lost** or a **failure dressed as success / empty**.
Three independent auditors covered the client surfaces, the server routes, and the transcription/analysis
durability. The sharpest findings were then **re-verified against the live code** (an audit finding is a
suspect, not a fact).

**Scope note:** this is the data-loss / honesty class ONLY. Tenant/IDOR/auth/security were out of scope
(covered by prior audits). No code was changed for this report.

**Bottom line:** the pipeline is *mostly* well-hardened (see "What's already solid"). The real holes cluster
around one theme — **a capture or processing failure that ends up looking like a normal, complete, or empty
result to the rep.** That is exactly the founder's "captured nothing but looks fine / didn't save" complaint,
so the HIGH findings below are the ones that matter most.

Severity legend: **HIGH** = silent data loss or a falsehood shown to the rep · **MED** = degraded honesty /
recoverable loss · **LOW** = cosmetic / low blast-radius. **[verified]** = re-read against code this session;
**[reported]** = auditor evidence, not yet re-verified by me.

> **STATUS (2026-08-22): ALL HIGH findings closed + deployed.** H1 `d9160efe` (empty-audio honesty) · H2
> `6453218b` (crash/timeout loop terminalises) · H3 `0455ffca` (lost write never dressed as complete) · H4
> `664f54da` (transient Dissect self-heals). Bundle A (H1-H3) + Bundle C's HIGH (H4) done. Remaining: MED
> (M1-M4) + LOW (L1-L2).

---

## HIGH

### H1 — Empty / silent / zero-byte audio is marked `complete` with a fabricated analysis, never flagged  **[verified]**
**Where:** [worker.ts:66-99](src/lib/coach/doorlog/worker.ts#L66-L99), `elevenlabs.ts:428-429` (`transcribeSpeech` returns `(text ?? "").trim()` → `""` for silence), `analyze.ts:45-83`.

**What happens:** The worker only guards a *missing* audio path (`worker.ts:67`). There is **no empty-transcript
check** between transcription and analysis. A silent/near-silent recording transcribes to `""`, is written with
`wordCount: 0`, advances to `analyzing`, and `analyzePitch` runs on empty text — the analysis schema forces a
non-empty `summary` + `scores`, so it returns a schema-valid *hollow* object, and the pitch reaches `complete`.
A **zero-byte / truncated** blob slips the `!dl.bytes` guard too, because an empty `Buffer` is truthy in JS.
Because the empty transcript is persisted, a later retry *skips* STT (`worker.ts:59-66`) — the emptiness is
locked in permanently.

**Failure scenario:** Rep records with a muted mic / phone in pocket / mid-upload truncation. They see a green,
**"complete"** pitch card with a made-up summary and made-up 0-100 scores. There is no "no speech detected"
state. This is the headline trust-killer.

**Fix direction:** After transcription, if `text.trim()` is empty (or below a word floor) → set a distinct
terminal state (`failed` "No speech was detected in this recording", or a dedicated `no_audio` status) instead
of analyzing. Also treat `dl.bytes.length === 0` as captured-nothing. The live-session path already has this
instinct (zero-agent-turns recovery); the pitch path has no equivalent.

### H2 — A pitch can stay non-terminal forever: `attempts` only advances on a thrown error, and there is no stale-pitch sweep  **[verified]**
**Where:** [worker.ts:114-115](src/lib/coach/doorlog/worker.ts#L114-L115) (`attempts` incremented only inside `catch`), `doorlog.ts:261-271` (`claimPitchForProcessing` pushes `run_after` +5 min), `door-log/route.ts:44` (`maxDuration = 60`), `vercel.json` (no pitch equivalent of `auto-close-stale-cron`).

**What happens:** A failure that does **not throw a catchable JS error** — a serverless **timeout / OOM / hard
kill** mid-STT or mid-LLM — never runs the `catch`, so `attempts` never increments and no terminal state is
set. After the 5-min lease the cron re-claims the same pitch and repeats. Nothing ages a stuck pitch out to
`failed`.

**Failure scenario:** A "poison" recording (very long, or one that hangs the STT fetch until the platform kill)
is retried every ~5 minutes indefinitely; the UI shows **"processing…"** forever (PitchPerformance / PitchDetail),
never surfaced as failed.

**Fix direction:** Add a stale-pitch sweep cron (mirror `auto-close-stale-cron`): any pitch non-terminal with
`updated_at` older than N minutes → mark `failed` honestly. Or increment `attempts` at **lease** time
(`claimPitchForProcessing`) so a crash still consumes an attempt and the record eventually goes terminal.

### H3 — Worker derived-table writes swallow their errors → blank analysis dressed as "complete" / "still processing"  **[reported]**
**Where:** `doorlog.ts:280-313` (`writePitchTranscript`, `writePitchAnalysis`, `setPitchStatus` — none check the Supabase `error`), `PitchDetail.tsx:76-79`, `PitchPerformance.tsx:101-112`.

**What happens:** If `writePitchAnalysis` fails transiently but `setPitchStatus("complete")` succeeds, the pitch
is `complete` with **no analysis row**. PitchDetail only special-cases `failed`, so a `complete`-with-no-analysis
renders **"Still processing — the analysis will appear here shortly." forever.** Textbook error-dressed-as-no-data.

**Fix direction:** Have these helpers return/throw on `error` so the worker's `catch` treats them as retryable
(→ honest terminal `failed`). At minimum, gate `setPitchStatus("complete")` on a verified analysis row existing.

### H4 — Meeting Dissect caches a *transient* failure as permanent "no signal", with no backfill cron to self-heal  **[reported]**
**Where:** `generateMeetingDissect.ts:33-59` and `:104-121`, `meeting-session/[id]/dissect/route.ts:57-73`.

**What happens:** Every non-success outcome — control-gate `suppressed`, empty LLM text (token starvation), JSON
parse failure, thrown exception — funnels into the same `EMPTY_MEETING_DISSECT`, and a durable
`meeting.dissect_attempted` marker is written for *all* of them to make future runs back off. The route then
returns the empty state **without re-running** on later views. Unlike the sales side, there is **no meeting
backfill cron**, so nothing ever regenerates it; recovery is only via `?force=1`.

**Failure scenario:** A real meeting with decisions/actions is dissected once during a token-starvation blip →
`dissect_attempted` persisted → every later view shows the honest-looking empty state **forever**; the captured
content is silently lost. (Worse than the pitch bug — the pitch path has a cron backstop; this does not.)

**Fix direction:** Only write the backoff marker for a genuine *LLM-ran-and-found-nothing* result. For
empty-text / throw / suppressed, return a retryable status (no marker) so the next view retries — mirroring how
sales `/finalize` keys idempotency off the *success* marker and lets a failed run retry.

---

## MED

### M1 — A DoorLog *upload* failure is mislabeled "recorded no audio" (edge of the just-shipped fix)  **[verified]**
**Where:** `DoorLog.tsx` `sendPitch` knock-fallback + the `save()` `audioDropped` notice.

**What happens:** The capture-loss fix routes *any* no-usable-audio outcome (null blob **or** a failed
sign/upload) to a knock and shows "…recorded no audio, so there's nothing to review." But when a *real* 45s
recording exists and only the **upload** failed (weak-signal doorstep), that copy is a **misattribution** — the
phone recorded fine; we failed to save it — and the blob is discarded (`setRecorded(null)`) with no retry.

**Fix direction:** Distinguish "no blob captured" from "blob existed, upload failed." For the latter, tell the
truth ("couldn't save your recording — try again") and hold/retry the blob instead of clearing it. (Note: this
is a residual I flagged in the fix's own closure; the audit confirms it independently.)

### M2 — The last pitch's fire-and-forget save has no keepalive/beacon → lost silently if the rep leaves  **[reported]**
**Where:** `DoorLog.tsx` `save` (fires `void sendPitch(...)` then advances to idle immediately), `postDoorLog` fetch (no `keepalive`), no `pagehide`/`visibilitychange`/unmount flush.

**What happens:** "Zero waiting" returns to idle instantly while the multi-MB upload + POST are still in flight,
blob only in memory. If the rep navigates away / backgrounds / closes the PWA before it completes, the promise
is abandoned and the recording (and, in a smaller window, the pitch POST) is lost — silently, because the
component is gone so the error banner never renders. The live path solved this with chunked uploads + a
`pagehide` `sendBeacon`; DoorLog has neither.

**Fix direction:** `keepalive:true` on the door-log POST for small bodies, and/or a `pagehide` beacon for an
in-flight save, and/or chunked audio upload like the live path.

### M3 — `PitchBody.storagePath` accepts `""` → a doomed server-side pitch + a wasted worker claim  **[verified]**
**Where:** `door-log/route.ts:39` (`z.string().max(400)`, no `.min(1)`), `:75` (`body.storagePath && …` short-circuits on `""`, skipping the scope check), `:97-117`, `worker.ts:67-69`.

**What happens:** A degraded client that sends `kind:"pitch"` with `storagePath:""` (instead of omitting it)
validates, skips the company-scope guard, creates a pitch with `audioPath:""`, and fires the worker on empty
input → the worker marks it terminally `failed`. Bounded (the knock/KPI row survives), but it mints a broken
pitch record for what was really a client contract violation. (Also flagged as deferred defense-in-depth in the
capture-loss fix's closure.)

**Fix direction:** `storagePath: z.string().min(1).max(400)` and drop the `body.storagePath &&` short-circuit so
the scope check is unconditional for `kind:"pitch"`.

### M4 — Meeting Stop shows an unconditional "recording is saving…" over swallowed persist failures  **[reported]**
**Where:** `useMeetingCoaching.ts:297` (`void persistRecording(...).catch(() => {})`), `stop()` `:421-429` (no transcript flush), `MeetingCoachingPanel.tsx:91-93`.

**What happens:** The panel unconditionally says "the recording is saving now… its review will be ready," but the
only clean-Stop persist is `.catch(() => {})`-swallowed and the live committed turns are discarded on stop.
Recovery leans entirely on best-effort chunk uploads + a stitch cron; if both fail on the same bad network, the
facilitator is told a review is coming when nothing durable was saved. (Lower confidence — the chunk redundancy
usually covers it; the defect is the *unconditional* optimistic copy.)

**Fix direction:** Surface a real state from the persist/chunk results instead of an unconditional "saving now";
consider a client transcript flush for the meeting hook like the sales hook already does.

---

## LOW

### L1 — `getKpiForDay` swallows a DB error into `[]` → the KPI strip silently shows 0  **[reported]**
**Where:** `doorlog.ts:103-115` (`return data ?? []`, never inspects `error`). A transient read error renders the
day's strip as `0/0/0/0` (wrong number, not an error state). Read-only, non-durable. Fix: classify `error`, let
the GET return a 5xx/`stale` flag rather than a fabricated zero (the neighbors already use `fetchAllPaged`).

### L2 — Pitch analysis labels duration with client wall-clock, not real audio length  **[reported]**
**Where:** `analyze.ts:51-59`, `worker.ts:92-98`. The diarized session path derives real length from word
timestamps ("real length instead of session wall-clock"); the pitch path feeds the client `durationMs`
(MediaRecorder wall-clock) into the analysis prompt. Lower blast radius (colors a prompt note, not a displayed
metric), but the same wall-clock-vs-real class the team already learned. Fix: compute real duration from Scribe
timestamps, or stop passing the unverified wall-clock into the prompt.

---

## What's already solid (verified clean — not defects)

- **DoorLog write + `after()` fire-and-forget** is backstopped: `pitches.run_after` (`default now()`) + the
  per-minute pitch-processing cron sweeps all non-terminal statuses; `createKnock`/`createPitch` are awaited,
  null-checked, and idempotent (return existing id on dedupe — no over-dedupe drop, no double-write).
- **Double paid-STT/LLM is prevented** by `claimPitchForProcessing` (atomic conditional lease); the loser spends
  nothing.
- **Terminal failure IS honest for *thrown* errors:** 5 attempts → `failed` with a human message, shown as a red
  "processing failed" card, distinct from empty history.
- **`maxDuration` is present on every LLM/STT route + cron** (pitch cron 300, finalize 300, etc.). The 60s
  door-log kick is backstopped by the per-minute cron.
- **Backfill cron cursor/window is safe** (bounded scan, honest `scanBounded` flag, set-diff against success
  markers, existence checks — no double-process or silent skip).
- **Live-session capture is the hardened reference:** 15s chunk uploads with idempotent retry, incremental
  `/segments` flush + `pagehide`/`visibilitychange` `sendBeacon`, `keepalive` finalize, reconnect that keeps the
  recorder alive, `auto-close-stale-cron` + `stitchSessionAudio` recovery, and an honest "not recording" banner.
- **`SessionRecordingUpload`, `useDoorRecorder`, `/finalize`, `/segments`, `/audio-chunk`, `/save-recording`,
  meeting `create`/`end`/`cue`, `generateAndStoreAfterPitch`** — all checked, all honest (errors surfaced, not
  swallowed into success/empty).

---

## Suggested fix order (for when you direct it)

1. **Bundle A (HIGH, sales pipeline):** H1 + H2 + H3 — the "empty/failed capture looks complete or processes
   forever" cluster. Highest trust impact; directly the founder complaint.
2. **Bundle B (MED, DoorLog residuals):** M1 + M2 + M3 — the honesty edges of the just-shipped fix.
3. **Bundle C (HIGH-meeting):** H4 + M4 — meeting Dissect self-heal + honest Stop.
4. **Bundle D (LOW):** L1 + L2.

Each bundle would ship as its own verified + tested + deployed commit, with a picker before any behavior change.
