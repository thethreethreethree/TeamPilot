---
tbc_version: 1
trigger: fix
started_at: 2026-08-14T05:30:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 12
hypotheses: 1
---

# THINK — module-lock × member-gate redirect loop (CRITICAL brick)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes verified. Cited amendments
(A19/A22/A26/A30/A38) read in ThinkerThinker.md this session; CLAUDE.md §§ in-context this session.

## 2. Why (record-check §1.2 — CONFIRMED by reading both guards, not the audit label)
A hole-hunt agent flagged a redirect loop; I confirmed it against the code before touching anything (audit
finding = suspect, not a fix):
- `src/app/dashboard/sales-coach/layout.tsx` redirected a NON-member to `/dashboard`
  (`isSalesCoachMember({role:'Member', sales_coach_role:null})` = `!!null || isAdminRole('Member')` = **false**).
- `src/middleware.ts:79-95` MODULE HARD-LOCK sends a `sales_coach`-locked account off `/dashboard` back to
  `/dashboard/sales-coach` (`redirectForLock` → `moduleHome`).
- So a locked non-member has NO fixed point: layout → `/dashboard` → middleware → `/dashboard/sales-coach` →
  layout → … = `ERR_TOO_MANY_REDIRECTS`. It bricks a **freshly-invited rep** in the NORMAL window between
  invite-accept (an invitable role, `sales_coach_role` null; `0114_accept_invitation_email_match.sql:67-68`) and
  the admin assigning Staff. The whole product's target user, unable to reach ANY page — not even an honest
  "no access yet" screen.
- The C.A.R.E layout (`src/app/dashboard/care/layout.tsx`) is the SAME shape (redirects a non-agent to
  `/dashboard` while care-locked) → same loop. This is a CLASS (A26), not a one-off.

## 3. The fix
A locked non-member must NOT be redirected to the hub (the middleware bounces it back). Instead the layout
HOLDS on an honest in-module terminal:
- `moduleGateDecision(isMember, isLocked)` (pure, in `src/lib/auth/moduleAccess.ts`) → `enter | hold | hub`.
  Member → enter. Non-member + locked → **hold** (the loop-safe branch). Non-member + not-locked → hub
  (safe — no lock, no bounce).
- `src/components/auth/ModuleNoAccess.tsx` — the honest terminal: tells the user access isn't assigned yet, and
  gives the two real actions (Re-check / Sign out) so they're not stranded.
- Both layouts (sales-coach + care) compute the lock BEFORE the member check and branch on the decision.

## 4. Interconnections traced (§1.5)
- The non-locked non-member path is PRESERVED (`hub` → redirect `/dashboard`), so a complete/legacy account's
  existing behavior is unchanged — only the LOCKED non-member path changes (the one that looped).
- Middleware is untouched; the fix lives entirely in the layouts + the shared decision. The middleware lock
  still confines the account to its module — the `hold` screen is INSIDE the module (`/dashboard/sales-coach`
  or `/dashboard/care`), so the lock permits it (no bounce).
- `ModuleNoAccess` sign-out does a full navigation to `/login` (re-reads cookies), and Re-check reloads — so an
  admin assigning the role mid-wait is picked up without a support ticket.
- Demo mode (no Supabase) still bypasses the whole gate (unchanged).

## 5. Hypothesis (§1.5.2)
- **H1 — does `moduleGateDecision(false, true)` return `hold` (not a hub redirect), breaking the loop?** Yes —
  `moduleAccess.test.ts` locks it as the REGRESSION case: a locked non-member holds; re-introducing the
  `/dashboard` redirect (the loop) fails CI.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-14T05:30:30Z", "source_file": "CLAUDE.md", "line_range": "1-40", "why_it_governs": "Understand the loop from the record before fixing — confirm both guards against the code, not the agent's label.", "how_this_build_will_embody_it": "Read both layouts + middleware + isSalesCoachMember + redirectForLock; confirmed the no-fixed-point loop before editing." },
  { "id": "§0.1", "read_at": "2026-08-14T05:30:40Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified; amendments read in-session." },
  { "id": "§1.2", "read_at": "2026-08-14T05:31:00Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Retrospective identification — the loop is read FROM the actual redirect pair, and the invited-rep provisioning gap from the migration.", "how_this_build_will_embody_it": "Traced middleware→layout→middleware with the real predicate values (role=Member → member=false)." },
  { "id": "§1.5", "read_at": "2026-08-14T05:31:30Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — the fix touches two layouts + must not disturb the middleware lock or the non-locked path.", "how_this_build_will_embody_it": "Section 4 preserves the non-locked redirect + the middleware confinement; only the locked-non-member branch changes." },
  { "id": "§1.5.1", "read_at": "2026-08-14T05:32:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Layer-3 continuity — a brick is the worst continuity failure; the fix must leave the user in a flowing (or honestly-waiting) state, not a dead end.", "how_this_build_will_embody_it": "The hold screen is a terminal with real next actions (Re-check / Sign out), not a dead end." },
  { "id": "§1.5.2", "read_at": "2026-08-14T05:32:30Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-verify: the loop was hypothesised from the agent, CONFIRMED by reading the predicate + both redirects before fixing.", "how_this_build_will_embody_it": "H1 stated + gated by the regression test." },
  { "id": "§6", "read_at": "2026-08-14T05:33:00Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — trace ripple (two layouts, the middleware, the non-locked path, demo mode).", "how_this_build_will_embody_it": "All enumerated in Section 4; the C.A.R.E sibling fixed in the same pass." },
  { "id": "A19", "read_at": "2026-08-14T05:33:30Z", "source_file": "ThinkerThinker.md", "line_range": "453-475", "why_it_governs": "Consult the in-tree code before changing it.", "how_this_build_will_embody_it": "Read both layouts + the middleware + the pure predicate before editing." },
  { "id": "A22", "read_at": "2026-08-14T05:34:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-605", "why_it_governs": "Citations require in-session reading.", "how_this_build_will_embody_it": "The cited amendments were read in ThinkerThinker.md this session." },
  { "id": "A26", "read_at": "2026-08-14T05:34:30Z", "source_file": "ThinkerThinker.md", "line_range": "689-694", "why_it_governs": "A reported bug is one instance of a CLASS — sweep to the boundary.", "how_this_build_will_embody_it": "Fixed BOTH module layouts (sales-coach + care), not just the reported one; the shared pure decision prevents a third module re-introducing it." },
  { "id": "A30", "read_at": "2026-08-14T05:35:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Encode the lesson in a gate that fails without cooperation.", "how_this_build_will_embody_it": "moduleAccess.test.ts locks `moduleGateDecision(false,true)==='hold'` — re-introducing the hub redirect reddens CI." },
  { "id": "A38", "read_at": "2026-08-14T05:35:30Z", "source_file": "ThinkerThinker.md", "line_range": "999-1006", "why_it_governs": "'Verified' = the canonical command + output.", "how_this_build_will_embody_it": "closure.md pastes `npm run check` + exit 0." }
]
```
