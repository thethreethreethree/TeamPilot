# BUILD — the correction moves the score, and the rep can see that it did

### The override log — append-only, reason required

- write-path: `supabase/migrations/0255_pitch_score_overrides.sql` — `pitch_score_overrides`,
  one row per correction: `item_type` (`element` | `bonus` | `violation`), `item_id`, old/new value,
  old/new points, `reason`, `actor_id`, `created_at`.
- write-path: `reason text not null check (length(btrim(reason)) > 0)`. Whitespace is not a reason.
  This is the second of three places the requirement is enforced (schema, CHECK, route) — an
  unexplained override is indistinguishable from a manager fixing a number they did not like.
- write-path: old/new **points** are stored rather than derived, because the rubric version that
  produced them may be retired before anyone reads the row. The row has to explain the total on its
  own.
- write-path: a tenant trigger mirroring the one 0252 puts on the other child tables —
  `company_id` is supplied by the writer, so nothing but a trigger stops a row being filed against
  the wrong company.
- write-path: **no insert/update/delete policy, deliberately.** Written only by the DEFINER RPC.
  The three omissions are recorded in `scripts/rls-audit.mjs` with their reasons; append-only is
  the constitutional point (§3.1) — a second override of the same item supersedes the first by
  being *later*, and both stay on the record.
- read-path: a select policy granting **the rep whose score it is**, or a manager in the same
  company. This is the requirement, not a courtesy: an override the rep cannot see is a silent
  correction.
- read-path: `readPitchScore` returns `overrides` with every pitch, newest first, each row labelled
  from the rubric so it reads without a lookup. An override whose item a later rubric retired still
  appears, falling back to the raw id — the correction happened and moved the total, and hiding it
  would leave points on screen that nothing explains.

### The RPC that does no arithmetic

- write-path: `supabase/migrations/0256_apply_pitch_score_override.sql` — amends the evidence,
  writes the log row, and stores the recomputed verdict, in **one transaction**. Every number it
  writes was computed by `scorePitch` and passed in as a parameter. The reasoning is in the
  migration's own header and in think.md: a SQL recompute would duplicate six decisions that
  already have authorities.
- write-path: an element is **upserted**, not updated — an element the scorer never graded is a
  real correction, and the commonest one on a short pitch.
- write-path: a removed bonus becomes `rejected_bonus` worth 0; a removed violation stays a
  violation worth 0. **Demoted, never deleted.** The row is evidence that something was heard and
  judged; deleting it erases the judgement rather than reversing it.
- write-path: `revoke execute … from public, anon, authenticated` (INVARIANT 4) — SECURITY DEFINER
  taking a company id is exactly the shape that invariant exists to catch.
- read-path: reached only through `applyOverride`, which is reached only through the route.

### The recompute — pure, and through the same scorer

- write-path: `src/lib/coach/pitchScore/applyOverride.ts`. `recomputeWithOverride()` rebuilds the
  scorer's inputs from the stored evidence, applies the one correction, and runs `scorePitch`.
  Pure, so it is tested without a database.
- write-path: bonuses are re-fed at `confidence: 1`, because the scorer **already applied its
  confidence floor** when it awarded them. Re-judging them here would re-run a decision that has
  been made.
- write-path: two facts about the conversation are preserved and cannot be overridden —
  `objectionOccurred: !pitch.deliveryScaled` and
  `reachedDiscovery: pitch.notQualifyingReason !== "Didn't reach Discovery"`. A manager who
  believes the pitch *did* reach Discovery is disputing the transcript, which is a re-score, not a
  correction. Flipping either would rescale a whole section.
- write-path: the band comes from `gamification/bands.ts`, never a local copy. A local copy shipped
  this morning with four bands against the authority's five and disagreed with the rep's own Arena
  on the same page.
- read-path: the route returns the recomputed `base`, `total` and `qualifying`, so the calling
  screen does not need a second round-trip to show the corrected number.

### The route — manager-only, tenant proven on the way in

- write-path: `src/app/api/coach/sales-session/pitch-score/override/route.ts`. Rate limited tighter
  than scoring (20/min): a burst of overrides is either a mistake or somebody working through a
  leaderboard.
- write-path: `requireSalesCoachManager` — the check **cannot** be delegated to RLS here.
  Everywhere else in this feature the policy *is* the access rule; here the write runs through a
  DEFINER RPC with the service role, which bypasses RLS by definition, so a missing check has no
  second line of defence. It consumes the chokepoint's verdict rather than re-expressing who a
  manager is (§2.2).
- write-path: the pitch is read with the service role — which has no RLS — so `company_id` is
  compared explicitly. A foreign pitch and a missing pitch return **byte-identical** 404s, so a
  uuid cannot be probed.
- write-path: `companyId` and `actorId` come from the proven session, never the body. A
  body-supplied actor is an override logged against somebody who did not make it, which destroys
  the audit trail the feature exists to create.
- write-path: failure reasons map to statuses (`unknown_item`/`invalid_value` → 422,
  `write_failed` → 500). The database's message is logged and never returned (CWE-209).
- read-path: a manager posts `{ pitchId, itemType, itemId, newValue, reason }` and gets the
  corrected verdict back. A rep calling it gets 403 and nothing is written.
