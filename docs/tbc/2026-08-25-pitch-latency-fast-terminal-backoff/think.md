---
started_at: 2026-08-25T11:45:00+08:00
---

# THINK — cut after-pitch latency: fast-terminal permanent failures + shorter retry backoff

## The problem, measured from data (founder: "~11 min average", 2026-08-25)
`scripts/diag-pitch-latency.mjs` over 58 pitches: the MEDIAN completes in ~30s (p50 0.4m, p90 0.6m). The AVERAGE is
inflated by a failing/outlier tail — 14 of 58 (24%) FAILED, complete-avg 6.6m (max 191m), failed-avg 71m (p90 218m).
Cause is the retry backoff: `backoffMs = 30s·2^n` → 60,120,240,480s ≈ **15 min cumulative** for a full 5-attempt
fail. Failed-error classes: 7 corrupted/empty-audio, 3 no-audio, **4 brain/company-config** — none self-heal on
retry, yet all churned 5× before terminalising. So "11-min average" = "a quarter of pitches fail and each churns
~15 min", NOT "the pipeline is slow." (The capture-empty tail is already addressed by 4c208231 + 8d760f46.)

## The fix (founder-approved this turn; §1.5.1 layer 2 — make the result actually arrive fast)
1. **Fast-terminal permanent failures.** New pure `isPermanentFailure(message)` in retryBackoff.ts: bad audio content
   (400 invalid_audio / invalid_content / "File is corrupted") OR missing config ("no brain row" / "company … not
   found"). The worker's catch terminalises immediately on a permanent error instead of the backoff loop. CONSERVATIVE:
   a 5xx/timeout/network error is NOT permanent (kept transient → still retries), so a genuinely recoverable pitch is
   never killed early.
2. **Shorter transient backoff.** DEFAULT_BASE_MS 30s → 7s → 14,28,56,112s ≈ 3.5min cumulative (vs 15min), so a real
   transient hiccup recovers in seconds. MAX_PITCH_ATTEMPTS stays 5 (a genuine provider blip still gets its retries).

Expected effect: the 4 config-fail pitches drop from ~15min churn to immediate terminal; the whole average collapses
toward the ~30s median. Grounded in best-practice (never retry an unfixable error; short initial backoff for a
user-facing async result) AND the local data (the failures ARE the average, and 4/14 are permanent config errors).

## A26 class boundary (swept)
Class = "a failure that cannot self-heal but is retried on the transient backoff path." Sole retry-driver is the pitch
`worker.ts` catch (all thrown errors → backoff-until-MAX). `isPermanentFailure` is the single verdict it now consults;
the empty/no-speech cases already fast-terminal via explicit guards (my earlier fixes). No other worker has this loop.

## Ripple (holistic — §6 item 5)
- Pure classifier + a base-constant change + one branch in the catch; no schema/route/API/migration/config change.
- The backoff-base change affects only TRANSIENT retries (permanent ones no longer reach it). The 1h cap is untouched
  (never hit with 5 attempts at base 7s). Existing retryBackoff test updated for the new base.
- No behavior change for a pitch that succeeds first try (the happy ~30s path is unchanged).

## Honest limit
This kills the retry-churn tail. It does NOT address the hours-long OUTLIERS (complete max 191m / failed 218m) that
point to pitch-processing-cron execution GAPS — that needs the Vercel cron logs (unavailable headlessly) and is
flagged, not fixed here. Nor the iOS capture root (separate, device-gated).

## Session-read manifest (A22 — every citation carries a THIS-build read_at ≥ started_at 11:45:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-25T11:53:10+08:00",
    "why_it_governs": "Understanding earned from data before solving.",
    "how_this_build_will_embody_it": "The fix is built on the measured latency distribution (median fast, average = failure churn), not the raw 'it's slow' framing." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-35", "read_at": "2026-08-25T11:53:12+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Cited axioms re-read fresh this build." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-93", "read_at": "2026-08-25T11:53:14+08:00",
    "why_it_governs": "Layer 2 operational effectivity — the after-pitch result must actually arrive in a usable time, not 15 min later.",
    "how_this_build_will_embody_it": "Fast-terminal + shorter backoff make the result arrive near the ~30s median instead of the churn tail." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-149", "read_at": "2026-08-25T11:53:16+08:00",
    "why_it_governs": "The task was one reported symptom (slow feedback); the rule requires THINKing about the failure class behind it and searching the whole retry path, not patching the one symptom.",
    "how_this_build_will_embody_it": "Diagnosed the retry-churn CLASS from data, then swept the worker's single retry-decision path and put the verdict there." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-437", "read_at": "2026-08-25T11:53:18+08:00",
    "why_it_governs": "Quick-decision checklist (understand-why, sweep, ripple).",
    "how_this_build_will_embody_it": "Ran it: measured the cause, swept the retry class, traced ripple (transient-only base change)." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-457", "read_at": "2026-08-25T11:53:20+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this build." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-596", "read_at": "2026-08-25T11:53:22+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a fresh read_at; the trailer lists them." },
  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-693", "read_at": "2026-08-25T11:53:24+08:00",
    "why_it_governs": "Sweep the class to its boundary.",
    "how_this_build_will_embody_it": "Confirmed the worker catch is the sole retry-driver; the classifier is the one verdict it consults." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-772", "read_at": "2026-08-25T11:53:26+08:00",
    "why_it_governs": "Encode the lesson in a gate.",
    "how_this_build_will_embody_it": "Tests pin isPermanentFailure (permanent TRUE / transient FALSE, both branches) + the new backoff schedule + the worker terminal-vs-backoff branch." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1003", "read_at": "2026-08-25T11:53:28+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the full `npm run check` output + EXIT code." }
]
```
