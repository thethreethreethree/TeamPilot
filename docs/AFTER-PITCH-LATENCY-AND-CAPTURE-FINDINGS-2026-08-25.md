# After-Pitch Feedback: Corrupted-Audio + Latency Findings & Remediation — 2026-08-25

Consolidated record of the DoorLog / Macro-Mode pitch-pipeline investigation this session: the founder-reported
"ElevenLabs invalid_audio / corrupted" error and the "~11-minute average after-pitch feedback + session drops."
All fixes below are shipped and live on elostate.com. The three items in section 5 (**Open**) need an input only the
founder can supply.

> **Honesty note (recorded because it matters):** the corrupted-audio issue was first *misdiagnosed*. I assumed an
> iOS mp4 "bad concat" and shipped two commits for it **before inspecting a single real recording**. When I finally
> pulled the actual bytes, the hypothesis was refuted — 0 recordings were bad concats. The real cause was empty
> captures. The lesson (verify the real artifact before shipping a fix, especially when the ground truth is one
> query away) is recorded in the reasoning store. The mp4 commits are safe but inert; kept as defense-in-depth.

---

## 1. The corrupted-audio root cause (from the real data, not assumption)

Inspected the actual stored recordings + capture telemetry (`scripts/diag-inspect-pitch-audio.mjs`,
`diag-pitch-audio-forensic.mjs`, `diag-doorlog-capture-events.mjs`, `diag-corrupted-audio-pitches.mjs`):

| Symptom | Real cause (evidence) |
|---|---|
| 7 pitches "invalid_audio / corrupted" (one company) | **5-byte empty-webm stubs** (`head 1c53bb6b`, no valid container header) on the single-blob fallback path. The iOS recording captured ~nothing; a 5-byte stub is non-zero, so it passed the worker's `length===0` guard and was sent to STT → ElevenLabs rejects an unplayable file as "corrupted." |
| No warning to the rep, no telemetry | The client's `sawData` flag is true for **any** data event — a 5-byte trailer counts — so the capture *looked* successful. 0 `doorlog.capture_failed` events were recorded for these. |
| 1 pitch "No audio captured" despite 4.4 MB of chunks | Chunks numbered **1..11 with no seq-0** (header chunk); `orderedChunkSeqs` requires a contiguous run from 0, so the whole recording was dropped (a missing header chunk is genuinely unstitchable). |
| 2 pitches "corrupted"-adjacent failures | **"No brain row for company … / company not found"** — a missing config row, unrelated to audio. |

**Underlying platform pattern:** both affected reps are on **iOS**, ride the single-blob fallback (`chunksUploaded=0`),
and fail **intermittently** (one rep: 4 complete / 3 empty). The known iOS-Safari cause — a MediaRecorder that
yields no audio while an AudioContext consumes the same mic stream — is still occurring despite the earlier
cloned-track mitigation (`55fd7837`), so the iOS root is **not yet closed** (see section 5).

## 2. The "~11-minute average" root cause (from the data)

`scripts/diag-pitch-latency.mjs` + `diag-pitch-cron-health.mjs` over 58 pitches:

- **The pipeline is fast: median ~30s** (p50 0.4m, p90 0.6m). "11 min average" is **not** systemic slowness.
- The average is inflated by a **failing/outlier tail**:
  - **24% of pitches failed**, and each failure churned the **retry backoff** (was `30s·2ⁿ` ≈ **15 min** for 5
    attempts). 4 of 14 failures were **permanent config errors retried 5× despite being unfixable**.
  - A few **extreme queue-wait outliers** (72–245 min, `attempts=0` → never churned, just waited) — the single
    biggest average-inflator. These are **cron-execution gaps** (pitches sat due-but-unclaimed for hours).
  - A small **~5-min "lease-wait" cluster**: the enqueue kick had only 60s, so a long recording's STT+LLM chain
    was killed mid-run and the pitch waited out its claim lease before the cron re-claimed it.

## 3. Fixes shipped this session (all live)

| Commit | Fix |
|---|---|
| `4c208231` | **Server honesty guard** — a recording with no valid container header fails as honest "No audio captured (empty or unplayable)", never sent to STT. No more misleading "corrupted." |
| `8d760f46` | **Client detection-hole** — `isCaptureViable` (durable chunks OR blob ≥ 1 KB) gates the save; an empty stub no longer becomes a doomed pitch — the rep is warned to re-record and `capturedBytes` telemetry is recorded. Not a length gate (respects "no minimum length"). |
| `72cbe705` | **Fast-terminal permanent failures** — bad audio content / missing config terminate immediately (conservative: 5xx/timeout stays transient). **Retry base 30s→7s** (≈3.5 min cumulative vs 15 min). |
| `59005957` | **Enqueue kick budget 60s→300s** — long pitches finish inline instead of waiting out the lease. |
| `caf48063` | **Claim lease 300s→360s** — closes the boundary double-claim the maxDuration bump would otherwise open (lease must exceed the processing budget); drift-guarded by a test. |

Net effect: failing pitches now fail in seconds instead of churning ~15 min; the average should collapse toward the
~30s median as new pitches flow. (Re-run `diag-pitch-latency.mjs` after real traffic to confirm.)

## 4. Session drops

Capture-reliability (reconnect-survival + incremental chunk uploads) was already shipped in prior work; `8d760f46`
adds the missing piece — a dropped/empty capture is now caught at source and the rep warned, instead of silently
producing a dead pitch. The remaining driver is the iOS silent-capture root in section 5.

## 5. Open — each blocked on an input only the founder can supply

1. **Vercel cron logs** for `/api/coach/sales-session/pitch-processing-cron` — the hours-long outliers are
   cron-execution gaps (biggest average-inflator). Need: is the every-minute schedule firing? Any 401/503/timeouts?
   `diag-pitch-cron-health.mjs` confirms nothing is stuck *right now*, but the historical outliers persist.
2. **A real iOS device** — to reproduce the intermittent silent capture and confirm the AudioContext/MediaRecorder
   root. The `capturedBytes` telemetry shipped in `8d760f46` now records the device signal that was previously
   invisible. (Chosen sequence: detection-hole first — done — then the root, with a device.)
3. **Company `c3e7f389` "no brain row"** — a missing brain-config row for that account; a data/setup decision.

## 6. Diagnostic scripts (committed, read-only, reusable)

`diag-pitch-latency.mjs`, `diag-pitch-cron-health.mjs`, `diag-capture-failure-pattern.mjs`,
`diag-corrupted-audio-pitches.mjs`, `diag-inspect-pitch-audio.mjs`, `diag-pitch-audio-forensic.mjs`,
`diag-doorlog-capture-events.mjs` — plus the founder-approved (dry-run-first) `requeue-corrupted-audio-pitches.mjs`
and `revert-empty-pitch-requeue.mjs`. Run any with `node scripts/<name>.mjs`.
