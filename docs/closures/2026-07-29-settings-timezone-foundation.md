# Session-Reads closure — Settings Slice 3: Timezone foundation (2026-07-29)

Full session-read manifest (12 entries, this-session read_at) in
`docs/tbc/2026-07-29-x3-settings-timezone-foundation/think.md`, validated by verify-manifest.mjs.
Clauses re-read this session: CLAUDE.md §0, §0.1, §1.5.1, §1.5.2, §6; ThinkerThinker.md
A19, A22, A26, A28, A31, A30, A38.

Founder chose "wire consumption first" for timezone. This slice ships the shared pure formatter
(`src/lib/datetime/format.ts` — `formatInTimeZone` + `resolveTimeZone`, 8 assertions) and its first real
consumer (the Settings "Last saved" stamp now renders the stored `companies.timezone` instead of a raw
UTC slice), fixing the dead-surface finding. Broad adoption + the per-user `profiles.timezone` override
are the next increment (tracked in docs/BUILD-STATE.md), deliberately after consumption so the override
is not dead surface. `npm run check` exits 0.
