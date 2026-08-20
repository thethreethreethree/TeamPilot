---
title: Add-agent upgrade — add by email + team passwords + forced first-login change
build_plan: founder direction 2026-08-21 (urgent client build)
phase: Sales Coach Team / Members
started_at: 2026-08-21T05:20:00Z
manifest_entries: 12
---

# Streamlined "Add agent" + team passwords

Founder direction (2026-08-21, urgent — client waiting): "a user that already has an Elostate sales coach
account can be added by an admin by email — no invite, automatic. A new user without an account can be added by
email + a team password the admin sets up. The team password is 8 chars with letters, numbers, a special char,
upper+lower, case-sensitive; distributed to the team; the new member is prompted to change their password after
first login. The team password can be changed, deleted, and there can be multiple (each titled)." UI: a
"Team passwords" / create-team-password control next to Add agent on the Members page.

Founder decisions (AskUserQuestion 2026-08-21): (1) admin creates the account, the team password is the initial
login credential; (2) admin picks which titled team password when adding a new user; (3) the management UI lives
next to Add agent on the Members page.

## Step 2 — Session-read manifest (A22 / §0.1)
```json
[
  { "id": "§0",     "read_at": "2026-08-21T05:20:00Z", "source_file": "CLAUDE.md", "line_range": "10-40",  "why_it_governs": "Understanding precedes solving — this touches auth/user-creation; a misdiagnosis here is dangerous.", "how_this_build_will_embody_it": "Mapped the CURRENT system (Explore) BEFORE building: membership = profiles.company_id, roles = profiles.role + sales_coach_role, invite-by-code self-signup, service-role admin.createUser precedent, the 0090/0091 privileged-column guard. The design mirrors those, not new invention." },
  { "id": "§1.5.1", "read_at": "2026-08-21T05:20:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer sieve — the add flow must actually create a usable, correctly-gated account (layer-2), compose with the existing role toggles (layer-3), and present clearly (layer-4).", "how_this_build_will_embody_it": "Layer-1: new team_passwords table + guarded must_change_password, service-role routes mirroring the care-agent pattern. Layer-2: route tests prove gating + the create/new-user paths. Layer-3: the Sales Coach role can be granted AT add time (one step) and still adjusts on the row. Layer-4: two focused dialogs on the Members page." },
  { "id": "§1.7",   "read_at": "2026-08-21T05:20:00Z", "source_file": "CLAUDE.md", "line_range": "300-330", "why_it_governs": "Ground-up / security — team passwords are a shared credential + admin-creates-user is a privilege.", "how_this_build_will_embody_it": "Every route admin-gated + company-pinned (INV15) + service-role; team_passwords RLS deny-all (secret only via the admin-gated route, allowlisted with reason in rls-audit); must_change_password guarded by its own trigger so a user cannot self-clear it to keep the shared password." },
  { "id": "§2.2",   "read_at": "2026-08-21T05:20:00Z", "source_file": "CLAUDE.md", "line_range": "244-262", "why_it_governs": "Single-source decisions — the password policy must not drift between the team password and the user's first-login change.", "how_this_build_will_embody_it": "ONE validateStrongPassword (passwordPolicy.ts) used by BOTH the team-password create route and the forced set-password route + the set-password UI." },
  { "id": "§3.4",   "read_at": "2026-08-21T05:20:00Z", "source_file": "CLAUDE.md", "line_range": "150-165", "why_it_governs": "Honesty — never a silent half-add; never a fact asserted that isn't true.", "how_this_build_will_embody_it": "new-user path deletes the auth user if the profile provision fails (no orphan half-account); existing-user path 404s honestly when no account is found; the multi-company complication is DOCUMENTED as deferred (founder's explicit call), not silently mishandled." },
  { "id": "§0.1",    "read_at": "2026-08-21T05:22:00Z", "source_file": "CLAUDE.md", "line_range": "44-60",   "why_it_governs": "Precondition gate — the methodology defining 'understanding' for this domain must be in the working tree.", "how_this_build_will_embody_it": "Both governing docs (CLAUDE.md, ThinkerThinker.md) are in-tree; the auth model was mapped from the real code this session, not from cached labels." },
  { "id": "§1.5.2",  "read_at": "2026-08-21T05:22:00Z", "source_file": "CLAUDE.md", "line_range": "160-190",  "why_it_governs": "Proactive audit — THINK about what could be wrong in the surrounding system, then confirm.", "how_this_build_will_embody_it": "While building I audited the adjacent invite/role surfaces and the privileged-column guard; surfaced the multi-company reassignment risk and the secret-at-rest concern as ranked residual rather than leaving them silent." },
  { "id": "§6",      "read_at": "2026-08-21T05:22:00Z", "source_file": "CLAUDE.md", "line_range": "330-360",  "why_it_governs": "Quick decision checklist run before substantive action.", "how_this_build_will_embody_it": "Ran it: understood WHY (mapped the model), traced the workflow (add → set role → first-login), and flagged the external-config precondition (§5c — migration 0235 apply)." },
  { "id": "A19",     "read_at": "2026-08-21T05:22:00Z", "source_file": "ThinkerThinker.md", "line_range": "meta", "why_it_governs": "Methodology-in-the-working-tree at the meta altitude — do not act from cached labels.", "how_this_build_will_embody_it": "The design consumed a fresh, code-derived map of the current auth/membership system (Explore) rather than assumed conventions." },
  { "id": "A22",     "read_at": "2026-08-21T05:22:00Z", "source_file": "ThinkerThinker.md", "line_range": "meta", "why_it_governs": "Session-reads manifest — pair each cited asset with an in-session read timestamp.", "how_this_build_will_embody_it": "This manifest carries read_at for every cited section; the commit will carry the Session-Reads trailer." },
  { "id": "A30",     "read_at": "2026-08-21T05:22:00Z", "source_file": "ThinkerThinker.md", "line_range": "meta", "why_it_governs": "A lesson/invariant counts only when gated by tests, not prose.", "how_this_build_will_embody_it": "The security boundary (401/403 gating) and the password policy are locked by route + unit tests, not asserted in comments." },
  { "id": "A38",     "read_at": "2026-08-21T05:22:00Z", "source_file": "ThinkerThinker.md", "line_range": "meta", "why_it_governs": "'Verified' is a claim about a command that was run.", "how_this_build_will_embody_it": "check.md pastes the canonical `npm run check` output + exit 0 (3446 passing); nothing is called verified without the command evidence." }
]
```

## Four-layer trace
- **Layer 1 (structure):** `team_passwords` table (company-scoped, titled, soft-delete); `profiles.must_change_password` + an isolated guard trigger (NOT folded into the critical 0090/0091 guard). Service-role routes.
- **Layer 2 (effectivity):** admin adds by email → existing account attaches immediately; a new person is created with the picked team password + forced first-login change. Route tests prove gating + both paths.
- **Layer 3 (composition):** the Sales Coach role is grantable at add-time (streamlines the old two-step) yet the row toggles still work; the forced-change gate lives OUTSIDE /dashboard so it can't loop.
- **Layer 4 (surface):** AddAgentDialog (existing/new toggle) + TeamPasswordsDialog (create/view/copy/delete) beside "Add agent"; a focused /set-password page with a live policy checklist.

## Deferred (founder's explicit call)
Multi-company reassignment — adding an existing account that already belongs to another team reassigns them.
The founder acknowledged this complication and deferred it. For now the add is direct (documented in-code).
