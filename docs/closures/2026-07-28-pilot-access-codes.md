# Closure — Pilot access-code system + audit (2026-07-28)

Founder directive (client waiting): streamline signup with 100 single-use pilot codes, each scoped to
a module (ELOSTATE-complete / C.A.R.E / Sales Coach). Built under the governed-build audit prompt
(ThinkerThinker.md + CLAUDE.md, AMD-006). This manifest is the on-record summary (§A22).

## What was built (file by file)

| Commit | File(s) | What |
|---|---|---|
| `d6e98489` | `0197_pilot_codes.sql`, `api/pilot/{validate,redeem}/route.ts`, `redeem/page.tsx`, `page.tsx`, audit-script allowlists | Pilot codes table + `pilot_code_status` (non-consuming) + `redeem_pilot_code` (SECURITY DEFINER, single-use row-lock) RPCs; validate/redeem routes; `/redeem` UI; landing "Enter access key" |
| `d3b200ea` | `api/pilot/__tests__/routes.test.ts` | 10 route tests (validation, module→landing, error passthrough) |
| `34da1fc8` | `.gitignore` | Gitignore `PILOT-ACCESS-CODES.pdf` (live keys never in git) |
| `3290a35c` | `redeem/page.tsx` | Handle already-authenticated / returned-after-email-confirmation (no signUp dead-end) |
| `0198` | `0198_pilot_redeem_revoke_anon.sql` | Explicitly revoke anon EXECUTE on redeem (Supabase default-grant gap) |
| `50aef150` | `0199_pilot_redeem_hardening.sql` | Audit fixes F0 (profile row-lock), F1 (drop redundant index), F4 (fail-loud on missing plan row) |

**Module semantics** (founder: "provision + land-in-module, soft"): no unified module gate exists;
care→`plan='pro'`, sales_coach→`sales_coach_role='admin'`, elostate→both. **§3.4 deviation**
(founder-authorized, on record): pilot codes skip the 30-day control window (instant guidance).

**100 codes** seeded live (34/33/33), NOT in git; PDF at repo-root `PILOT-ACCESS-CODES.pdf` (gitignored).

## Audit (against AMD-006/§1.5/§3.4/A23-27) — 8 findings, honest

- **Fixed (mine):** F0 concurrency race (2 concurrent same-user redeems → 2 codes + orphaned company), F1 redundant index, F4 silent 0-row plan update, F2 anon-executable redeem. All verified live (rolled-back).
- **F0 class swept to boundary** (A26): `complete_company_onboarding` (0047) = same class (flagged, founder-gated — primary onboarding path, out of scope); `accept_invitation` (0008/0114) = different shape (not a member).
- **Founder-gated (surfaced, not built):** F3 C.A.R.E product-context demo gap (pilot skips wizard → `ai_product_context` NULL → Jeff hands off product Qs); F5 redeem surfaces raw RPC error.message (mirrors `/api/team/accept`); F6 nullable `redeemed_by_email`.

## Verification state (honest, AMD-006 3rd addendum)

- **Runtime-verified** (live DB, rolled-back): all 3 provisionings, single-use, both guards, normalization.
- **Production-verified live:** `elostate.com/redeem` → 200; `/api/pilot/validate` with a real code → `{valid:true, module:elostate, redeemed:false}` (non-consuming); `/api/health` → ok, DeepSeek active.
- **NOT verified (needs founder):** the browser signup→redeem→redirect *write* step (consumes a real code + creates a company). F0's two-session serialization (mechanism-sound `for update`, not two-session-exercised).

## Bonus (found via prod verification)

- `a66f0c3a` — inbound email routes on `OriginalRecipient` not the multi-recipient `To` header (silent-drop fix).
- `3e4cfa78` — **§5 honesty:** `/api/health` + version badge reported stale constitution metadata (AMD-004/count 4) while AMD-005/006 were ratified → corrected to 6 / AMD-006.
- `4cf7e3c1` — **INVARIANT 12** guards `CONSTITUTION` against `docs/amendments/` so the drift can't recur (detection-tested + self-tested).

## Open decisions (yours)

1. One live browser redemption (confirm the write step E2E).
2. Supabase email-confirmation OFF for a friction-free pilot? (flow is now resilient either way).
3. F3 — add optional product-context field to `/redeem`? (~15 lines; changes your specified 3 fields).
4. 0047 — apply the same `for update` fix to the primary onboarding RPC? (ready, low-risk).
5. F5/F6 — the raw-error pattern (shared with `/api/team/accept`) + nullable email.

All code committed, pushed, deployed; full repo green (`npm run check`) at every step.
