# Where these files go

Into the **ELOSTATE (TeamPilot) repo**. The scaffold isn't a separate app.

| From this folder | To the repo | Note |
|---|---|---|
| `elostate-remote-sales/src/lib/coach/remote/` | `src/lib/coach/remote/` | New folder beside the existing `v5/`, `pitchScore/`, `doorlog/` |
| `elostate-remote-sales/tests/*.test.ts` | the repo's Vitest tree (e.g. `src/lib/coach/remote/__tests__/`) | Fix the import paths |
| `elostate-remote-sales/supabase/migrations/0271`–`0279` | `supabase/migrations/` | **Renumber to the next free number first** |
| `elostate-remote-sales/tests/sql/` | keep beside the migrations as an RLS suite, or port the cases into `scripts/rls-audit.mjs` | The fixture is a stub of the live schema; never apply it |
| `elostate-remote-sales/.env.example` lines | append to the repo's `.env.example` | One key |
| `docs/`, `BUILD-PLAN/` | `docs/rss/` | Phase TBC records link here |

## Run next, in this order

1. **Read the live schema for the five things this plan couldn't see**, and correct the plan where
   they differ:
   - the `coaching_sessions` status columns (to map `session/state.ts`);
   - the `context` check constraint (0070/0237);
   - the unique index on `rubric_config` (0252:79);
   - the columns of `recording_share_events` (0260), to wire `rss_share_granted()`;
   - the transcript segment table (0269), for full-text search and stats input.
2. `npm run check` in the repo with the copied files. It must stay green before any migration.
3. Answer what you can in `docs/00-OPEN-DECISIONS.md`. D1 first, because it sets the scope.
4. Start Phase 0 (`docs/07-BUILD-ORDER.md`) under BUILD-STARTER V6, with a TBC record per phase.
5. Apply each migration only with `npm run db:apply`. Every migration's preflight stops it if the
   live schema differs from what this plan assumed.

BUILD-STARTER V6 and its `05-DEPLOYMENT-METHOD.md` weren't readable from where this plan was
written, so this plan defers to them and doesn't restate them.
