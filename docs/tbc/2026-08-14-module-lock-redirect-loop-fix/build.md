# BUILD — module-lock × member-gate redirect loop fix

### moduleGateDecision — the loop-safe access decision
read-path: `src/lib/auth/moduleAccess.ts` `moduleGateDecision(isMember, isLocked)` returns `enter | hold | hub`,
read by both module layouts to decide how to treat the caller.
write-path: none (pure). The critical rule — a locked non-member returns `hold`, NOT `hub` — is locked by
`src/lib/auth/__tests__/moduleAccess.test.ts` (the regression case).

### ModuleNoAccess — the honest in-module terminal
read-path: `src/components/auth/ModuleNoAccess.tsx` renders the "access not set up yet" screen for a locked
non-member, with Re-check (reload) + Sign out actions.
write-path: Sign out calls `supabase.auth.signOut()` then full-navigates to `/login` (re-reads cookies). No DB
write; it's an auth terminal.

### sales-coach + care layouts route through the decision
read-path: `src/app/dashboard/sales-coach/layout.tsx` + `src/app/dashboard/care/layout.tsx` compute the lock
BEFORE the member check and branch on `moduleGateDecision`: `hub`→redirect `/dashboard`, `hold`→render
`ModuleNoAccess`, else enter the shell.
write-path: none (server layout gate). Previously both `redirect('/dashboard')` unconditionally on a non-member
— the loop. Now a LOCKED non-member holds in-module; the non-locked non-member still redirects to the hub.

## Test coverage
`moduleAccess.test.ts` (+3): member→enter (locked or not); **locked non-member→hold (REGRESSION — never a hub
redirect, which loops)**; non-locked non-member→hub. The layouts are server components (repo convention: 0
`*.test.tsx`); the loop-critical logic is the pure decision, which IS gated.

## Out of scope (noted)
- The provisioning two-step itself (invite sets an invitable role + null `sales_coach_role`; admin later assigns
  Staff) is unchanged — that's the intended flow; the bug was that the WAIT bricked instead of holding.
