---
started_at: 2026-08-29T09:45:00+08:00
---

# THINK — invite people directly AT a tier (stage 3 / R1 of the team reorg)

## Why (the founder's directive + pick)
Stages 1-2 ordered every roster by the 6-tier hierarchy and made the tiers ASSIGNABLE to EXISTING members
(`/api/team/set-role`). R1 was the deferred half: a brand-new person can only be invited as CEO/COO/Lead/Member
today (the `team_invitations.role` 0008 CHECK), so hiring a Director means invite-as-Member → then reassign — a
two-step the RBAC "provision-at-invite" norm exists to avoid. The founder picked R1 (picker, 2026-08-29). This closes
the layer-2 gap in the reorg: invite straight into the tier.

## Understanding (the constraints + the ripple — §0, §1.5)
`team_invitations.role` HAS a CHECK (0008: `role in ('CEO','COO','Lead','Member')`); widening it needs a migration
(`npm run db:apply`, never hand-applied). Three things the naive "just add the roles" misses:

1. **Privilege-escalation ripple (§2.2 / A40).** Migration 0141 is a SECURITY guard: the `team_invitations` INSERT
   RLS policy lets a non-admin invite non-admin roles but gates CEO/COO behind "caller is already admin" — because
   accepting a CEO/COO invite grants company-admin. `CFO` was folded into `ADMIN_ROLES` on 2026-08-29. So making CFO
   invitable WITHOUT adding it to 0141's gate would let any Member mint a CFO invite → instant admin escalation,
   re-opening exactly the hole 0141 closed. 0141 HARDCODES `('CEO','COO')` — the re-derived copy of ADMIN_ROLES that
   A40 warns will drift. The migration must add CFO to both terms of that policy. The API route (`/api/team` POST)
   already branches on `isAdminRole(safeRole)` (the VERDICT, not a re-derivation), so it auto-covers CFO — only its
   error copy names "(CEO/COO)".

2. **Legacy `'Lead'` must stay in the CHECK.** Existing invitation rows may hold `role='Lead'`; an ALTER that drops
   'Lead' would fail validation against those rows. So the new CHECK = the 8 assignable tier roles + legacy 'Lead' = 9
   values. To keep the strict `enumConstraintSync` drift-guard (INVITABLE_ROLES ≡ CHECK set) green, INVITABLE_ROLES
   becomes those same 9. `'Lead'` stays valid-but-not-offered: the invite DROPDOWN drives off `ORG_ROLE_OPTIONS` (the
   curated 8, tier-grouped — Supervisor is Lead's modern replacement), decoupling presentation (8) from validity (9),
   exactly as the assignment UI already does.

3. **The drift-guard pin + regex hazard.** `enumConstraintSync.test.ts` reads the CHECK from the migration matching
   `startsWith("0008")`; it must repoint to the migration that now defines the authoritative CHECK (0239). Its regex
   `\brole\s+in\s*\(...\)` also matches `p.role in ('CEO','CFO','COO','admin')` inside the 0141 policy — so in 0239 the
   CHECK's `role in (...)` list must be the FIRST such occurrence in the file (CHECK before the policy re-create).

`accept_invitation` (0114) writes `profiles.role = invitation.role`; profiles.role has no CHECK, so VP/Director/etc.
land fine and the org-rank + ADMIN_ROLES logic already classifies them (not admin). No accept-path change needed.

## The build (§1.5 — reuse the existing patterns, widen one axis)
- migration `0239` — DROP+ADD the `team_invitations_role_check` CHECK (9 roles, CHECK first); re-create the 0141
  INSERT policy with CFO in both terms. Idempotent (drop-before-create).
- `roles.ts` — INVITABLE_ROLES → the 9 (8 assignable + legacy Lead), documented; isInvitableRole unchanged in shape.
- `InviteMemberDialog.tsx` — dropdown from `ORG_ROLE_OPTIONS` (tier-grouped `<optgroup>`s), not INVITABLE_ROLES; the
  Role hint copy stops hardcoding "CEO, COO, Lead, or Member".
- `route.ts` — error copy "(CEO/CFO/COO)" (the gate itself already right via isAdminRole).
- `chats/page.tsx` — the invite hint stops enumerating the role list (would now be 9 incl Lead); says "pick their tier".
- tests: `roles.test` INVITABLE assertion → the 9 (conscious expansion) + isInvitableRole('VP') etc.;
  `enumConstraintSync` pin → 0239.

## Session-read manifest (A22 — read_at ≥ started_at 09:45:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-08-29T09:46:00+08:00",
    "why_it_governs": "Understanding precedes solving — earn the diagnosis before widening a security-relevant CHECK.",
    "how_this_build_will_embody_it": "Traced the 0141 escalation ripple + the Lead/CHECK constraint BEFORE writing the migration." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-08-29T09:46:05+08:00",
    "why_it_governs": "Methodology doc must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md + ThinkerThinker.md re-opened via Read this session; cited axioms below." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-76", "read_at": "2026-08-29T09:46:08+08:00",
    "why_it_governs": "Organic + Holistic — trace the ripple (0141 escalation policy) before widening the CHECK; reuse existing patterns.",
    "how_this_build_will_embody_it": "Found + fixed the RLS policy ripple in the same migration; dropdown reuses ORG_ROLE_OPTIONS; validity reuses the CHECK-synced set." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-08-29T09:46:10+08:00",
    "why_it_governs": "Layer-2 effectivity — invite-at-tier must actually persist + gate end-to-end, not just typecheck.",
    "how_this_build_will_embody_it": "Migration applied via db:apply; route + RLS gate unit/behaviourally checked; dropdown posts the tier." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-160", "read_at": "2026-08-29T09:46:15+08:00",
    "why_it_governs": "THINK-first — the escalation ripple is the non-obvious failure to find before shipping, not after.",
    "how_this_build_will_embody_it": "Audited the adjacent RLS policy (0141) + found the hardcoded-copy drift; fixed it in the same migration." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-330", "read_at": "2026-08-29T09:46:20+08:00",
    "why_it_governs": "Single-source decisions — 0141 re-derives ADMIN_ROLES as a hardcoded ('CEO','COO'); that copy drifts.",
    "how_this_build_will_embody_it": "Add CFO to the policy copy + a comment pointing at ADMIN_ROLES; the route consumes isAdminRole (the verdict)." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-372", "read_at": "2026-08-29T09:46:25+08:00",
    "why_it_governs": "Honesty — a non-admin's admin-role invite must be refused with a clear reason, never a silent success.",
    "how_this_build_will_embody_it": "Route 403 names the admin requirement; RLS backstop refuses the direct-client path." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-470", "read_at": "2026-08-29T09:46:30+08:00",
    "why_it_governs": "Run the quick-decision checklist before a substantive action.",
    "how_this_build_will_embody_it": "Ran it: understood the ripple, reused patterns, kept the drift-guard strict, migration via db:apply." },
  { "id": "A13", "source_file": "ThinkerThinker.md", "line_range": "311-330", "read_at": "2026-08-29T09:46:35+08:00",
    "why_it_governs": "Vocabulary-once — the invitable set + dropdown source live in roles.ts, consumed everywhere.",
    "how_this_build_will_embody_it": "INVITABLE_ROLES + ORG_ROLE_OPTIONS authored once; dialog/validate/route consume by reference." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-460", "read_at": "2026-08-29T09:46:40+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-600", "read_at": "2026-08-29T09:46:45+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a fresh read_at; the commit trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-780", "read_at": "2026-08-29T09:46:50+08:00",
    "why_it_governs": "Encode the lesson in a gate — the CHECK/enum sync + the escalation gate must be tested, both branches.",
    "how_this_build_will_embody_it": "enumConstraintSync stays strict (repinned); roles.test pins the 9; route test covers the admin-role 403." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1010", "read_at": "2026-08-29T09:46:55+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the real `npm run check` output + exit code + db:apply result." },
  { "id": "A40", "source_file": "ThinkerThinker.md", "line_range": "1045-1055", "read_at": "2026-08-29T09:47:00+08:00",
    "why_it_governs": "A decision returned as a verdict, consumed — never re-derived; the 0141 hardcode is the re-derivation.",
    "how_this_build_will_embody_it": "The migration syncs the policy copy to ADMIN_ROLES (+CFO) with a source-pointer comment." }
]
```
