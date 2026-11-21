---
started_at: 2026-11-20T20:00:00Z
trigger: Build-continuation guard after Phase 8 closed — RSS plan docs/rss Phase 9 (reach).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - RSS Phase 9: reach

## The record

- Plan 07-BUILD-ORDER Phase 9: apply 0279 (renumbered 0286); webhook sender · Google and Microsoft sign-in · CSV team
  import. Looked at: a test endpoint receives a signed session.scored and verify() accepts it. 05-ROUTES: webhooks
  route + sender cron (`${ts}.${body}`, X-Elostate-Timestamp / -Signature, backoff, delivery log). 08-DEPLOYMENT: one
  new env key RSS_WEBHOOK_SIGNING_SECRET. Feature menu: F31.8, F1.2 (Supabase OAuth), F2.8.
- Sessions close from the session route, finalize and auto-close-stale-cron; scores are stored by three callers
  (button, finalize, drain) through scoreSession. Hence enqueue triggers on the tables, not calls in routes.
- Invitations: POST /api/team carries a privilege-escalation gate and two duplicate checks; managers: set-manager uses
  assertValidManager + the 0272 trigger; findAuthUserByEmail pages all of auth.users per call.
- docs/AUTH-REDIRECTS.md is the external-config contract for auth (the 2026-08-14 recovery outage).

## Outside view

Each Phase 9 feature sends something out of, or lets someone into, the product. The failures to fear: a signature any
customer can forge, a server made to call its own network, an open redirect after sign-in, words injected onto the
login page, a button for a provider nobody configured, an import that invites someone who already has an account.

## Session-read manifest

```json
[
  {"id": "§0", "source_file": "CLAUDE.md", "line_range": "10-14", "read_at": "2026-11-20T20:37:00Z",
   "why_it_governs": "Webhooks, OAuth and the team import each depend on something outside the code (a receiver, a provider, auth.users); each was read before it was built on.",
   "how_this_build_will_embody_it": "Read every session-close and score path before choosing triggers; read the invite route before sharing it; executed enqueue, backoff and the endpoint guard on PG 16.4."},
  {"id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-24", "read_at": "2026-11-20T20:37:00Z",
   "why_it_governs": "The plan (docs/rss) and the constitution must be in the tree and read this session.",
   "how_this_build_will_embody_it": "07-BUILD-ORDER Phase 7 + gate, 06-UI-SPEC Training, 00-OPEN-DECISIONS D9/D18 read this session; ThinkerThinker assets below read this session."},
  {"id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-80", "read_at": "2026-11-20T20:37:00Z",
   "why_it_governs": "Layer 2: a feature whose write errors on every call does not work, whatever its tests say.",
   "how_this_build_will_embody_it": "Four ON CONFLICT writes on rule tables replaced; each write path executed against the schema."},
  {"id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-141", "read_at": "2026-11-20T20:37:00Z",
   "why_it_governs": "Look past the task: the gate's own detectors can be wrong.",
   "how_this_build_will_embody_it": "INVARIANT 33's ignoreDuplicates exemption and sql-harness's empty-reason probe were both found wrong and fixed."},
  {"id": "§6", "source_file": "CLAUDE.md", "line_range": "434-436", "read_at": "2026-11-20T20:37:00Z",
   "why_it_governs": "Checklist item 0: a decision the plan already settles is not put to the founder.",
   "how_this_build_will_embody_it": "D18 follows the plan's stand-in (unmounted, allowlisted with reason), not a picker."},
  {"id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-460", "read_at": "2026-11-20T20:37:00Z",
   "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
   "how_this_build_will_embody_it": "Assets opened by line this session; the plan's decisions file decided D18's handling."},
  {"id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-599", "read_at": "2026-11-20T20:37:00Z",
   "why_it_governs": "No citation without a session read.",
   "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."},
  {"id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-775", "read_at": "2026-11-20T20:37:00Z",
   "why_it_governs": "A lesson in prose returns; the class needs a gate.",
   "how_this_build_will_embody_it": "INVARIANT 33 now fails any .upsert on a rule table, ignoreDuplicates included."},
  {"id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1006", "read_at": "2026-11-20T20:37:00Z",
   "why_it_governs": "A verification claim is a claim about a command that was run.",
   "how_this_build_will_embody_it": "check.md pastes each gate step's exit code; the two Postgres steps are recorded as SKIPPED, not passed."},
  {"id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-343", "read_at": "2026-11-20T20:59:00Z",
   "why_it_governs": "Trims, retention changes and erasure all touch the append-only record.",
   "how_this_build_will_embody_it": "Trims and retention changes are rows; the erasure job is NOT built, because real erasure deletes, which §3.1 forbids without an amendment."},
  {"id": "§3.1.1", "source_file": "CLAUDE.md", "line_range": "347-363", "read_at": "2026-11-20T21:20:00Z",
   "why_it_governs": "Erasure deletes; §3.1.1 (AMD-014) is the only rule that permits it, under five conditions.",
   "how_this_build_will_embody_it": "Admin-filed and reviewed (route), personal data only (0285 inventory), facts kept (blanked rows), hashed request + completion row, one door (INVARIANT 38)."},
  {"id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-196", "read_at": "2026-11-20T21:40:00Z",
   "why_it_governs": "Webhooks need a server secret and sign-in needs provider apps and an allowlist, all outside the repo.",
   "how_this_build_will_embody_it": "Both fail loud or stay hidden until configured (cron 503 + screen notice; buttons only for declared providers), and both are documented as blocking steps with verification (AUTH-REDIRECTS.md, .env.example, OPEN.md)."}
]
```
