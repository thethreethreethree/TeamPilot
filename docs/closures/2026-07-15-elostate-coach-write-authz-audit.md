# Audit record — Sales Coach service-role write authz (2026-07-15)

**Trigger.** The ELOSTATE Standard build (2026-07-15) added three new service-role functions to
`src/lib/data/salesCoach.ts` (`renameSession`, `getRecentAfterPitchSummariesAdmin`, `getAgentCoachStart`).
Service-role bypasses RLS, so per the CRM-vendor lesson ("RLS-only audits miss service-role routes") each new
service-role path needs its own authz check. This is that audit, recorded per §1.7.4 (audits on the record so
later ones can compare).

**Scope.** Every service-role WRITE reachable from the Sales Coach data layer, plus the read paths of the two
new read functions. Layered by data sensitivity (personal / rep-private / company-wide).

## Findings

| # | Path | Data | Expected bar | Found | Result |
|---|------|------|--------------|-------|--------|
| 1 | `renameSession` (PATCH `/[id]`, clientLabel) | session-owned | owner | **company-visibility** (getSession) | **FIXED** → owner-only (`existing.agentId === auth.uid()`, else 403), commit `6d7938d` |
| 2 | `getRecentAfterPitchSummariesAdmin` (GET `/skills`) | rep-private scores | caller only | `agent_id = auth.uid()` (route line 49) | sound |
| 3 | `getAgentCoachStart` (POST `/[id]/cue`) | internal (a date) | n/a — not returned cross-tenant | used only for the observe decision | sound |
| 4 | `appendTranscriptSegment` (POST `/[id]/finalize`) | session-owned | owner | `session.agentId !== auth.uid()` → 403 | sound (the correct pattern rename should have copied) |
| 5 | `appendSalesCorpusVersion` (POST `/corpus`) | company-wide methodology | manager | `!isManager` → 403 | sound |
| 6 | `appendSalesCorpusVersion` (POST `/product`) | company-wide | manager | `!isManager` → 403 | sound |
| 7 | `setSessionOutcome` (POST `/[id]/outcome`) | coaching workflow | agent OR manager | company-visibility, **documented + append-only** | intentional — a manager recording/correcting a rep's outcome is a real workflow; corrections are traceable events (§3.1) |
| 8 | `setSessionStatus` (PATCH `/[id]`, status) | lifecycle | agent OR manager | company-visibility | intentional — manager ends/reviews a rep's session; pre-existing |
| 9 | `saveAfterPitchSummary` (POST `/[id]/after-pitch`) | rep-private | owner/manager, always owned by the agent | `resolveViewer` gates; row `agent_id = session.agentId` | sound |

## Conclusion

**One real hole, mine, now closed.** `renameSession` inherited a company-visibility check (right for a
manager status transition, wrong for a personal rename) while the correct owner-only pattern sat one file away
in `finalize` (#4). The rename UI was already owner-gated, so this was the classic UI-gated/API-open gap — a
crafted PATCH from any company member could have relabelled a colleague's session. Fixed to owner-only.

**Everything else is correctly gated by sensitivity:** personal/session-owned data → owner-only (#2, #4, #9);
company-wide methodology → manager-only (#5, #6); the two company-wide coaching-workflow writes (#7, #8) are
deliberate, documented, and append-only (a "correction" destroys nothing). No further change made — tightening
the intentional ones would have broken a real manager workflow (§A26: sweep to the boundary, don't over-fix).

**Read-side privacy check (mode-branch additions):** the Standard After-Pitch renders scores, but the API
strips them for non-owners (`forViewer`), so a manager sees an empty score grid, not a rep's private numbers
(A18). The new Call-Outcome and rename affordances are `isStandard && isOwner`. No private-data leak
introduced by the Standard branch.

**Baseline for next time:** compare a future coach authz sweep against this table. New service-role writes
must state their bar (owner / manager / documented-workflow) at the route, not lean on RLS visibility.
