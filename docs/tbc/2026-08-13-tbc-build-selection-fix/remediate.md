# REMEDIATE — F1 TBC gate selected the wrong build (lexicographic name)

## F1 — currentBuildDir picked the lexicographically-last NAME
Root cause: `currentBuildDir()` returned `readdirSync(TBC_DIR).sort()` → last. On the same day, a newer dir whose
name sorts EARLIER (`display-honesty` < `forced-client-update`) is skipped, so the gate validates the older dir and
a new build's record ships UNVALIDATED (it had real manifest/artifacts gaps).

Remediation:
1. `currentBuildDir()` now reads each dir's think.md `started_at` (ISO instant) and returns the most-recently-
   started build.
2. The selection is extracted PURE as `pickLatestBuildName(entries)` and unit-tested (5 cases: the exact
   name-sorts-earlier-but-newer regression, across-days ordering, the malformed-no-started_at fallback that can't
   hijack a real build, name-only fallback, empty).
3. Downstream verifiers + the `TBC_BUILD=` override are unchanged — they just receive the correct dir.

Boundary (A26): selection-only. All current dirs have a `started_at` (verified), so the sort is well-defined; a
malformed dir keys on its name and can only win if none has a timestamp.

Outcome: fixed. class: gate integrity (a verifier that validated the wrong artifact). severity: medium. The gate
now validates the actual newest build, so a build can't ship an unvalidated record via a same-day name skip.
