# Proposal — close the detection-test coverage gap on the invariant audit

**Status:** PARTIALLY SHIPPED 2026-08-11 — the recommended **top-5 security-critical** (INV18, INV13, INV19,
INV16, INV21) now have detection-tests (test-only, no production change). **Remaining 10** still open:
INV7 (admin gate), INV8 (extension auth), INV9 (NEXT_PUBLIC), INV10 (dangerouslySetInnerHTML), INV11 (cron
secret), INV12 (constitution version), INV15 (coaching_sessions company_id), INV17 (cron in vercel.json),
INV20 (middleware cookies), INV24 (extension LLM fence). **Trigger phrase:** *"detection-test the invariants"*.
**Origin:** surfaced 2026-08-11 while adding a detection-test for invariant 14 (CWE-209, build xj). The test
file's own header states its purpose: *"A gate that cannot FAIL is not a gate — it is a green light with extra
steps. I shipped exactly that bug… the rls-audit's SELECT rule had a regex that could never match, so the
check silently never ran while the audit reported success."* Invariant 14 had shipped with no such test — and
it turned out its regex had a real blind spot (the nested `.message` form). That is direct evidence the gap
hides live defects, not just theoretical ones.

## The gap (measured 2026-08-11)
`scripts/invariant-audit.mjs` defines **24 invariants**. `scripts/__tests__/invariant-audit.test.ts` has
dedicated detection-tests (positive shape matches + negative no-cry-wolf cases) for **9**: INV1 (CSV), INV2
(service-role), INV3 (reachability), INV4 (SECURITY DEFINER tenant param), INV5 (upload validation), INV6
(cross-person gate), INV14 (CWE-209 — just added), INV22 (error-as-no-data), INV23 (transcript fence).

**No dedicated detection-test (15):** INV7 (admin gate), INV8 (extension auth), INV9 (NEXT_PUBLIC safe),
INV10 (dangerouslySetInnerHTML), INV11 (cron CRON_SECRET), INV12 (constitution version), INV13 (PostgREST
`.or(...ilike...)` injection sanitize), INV15 (coaching_sessions company_id), INV16 (LLM maxDuration), INV17
(cron registered in vercel.json), INV18 (non-public mutation auth gate), INV19 (owner-session append check),
INV20 (middleware rotated-cookie preservation), INV21 (`.limit(N)` > 1000 false bound), INV24 (extension LLM
fence).

Each of these guards a real class (many are security-critical), and each relies on a regex or set-membership
check that could silently stop matching under a refactor — with the audit still reporting green.

## Why it matters
The `verify:live`/invariant suite is the codebase's structural memory (A30): dozens of "lesson in prose"
failures were converted into these gates. But a gate with no detection-test is itself a "lesson in prose" one
level up — nothing proves it still fires. INV14's just-found nested blind spot is the existence proof.

## Ranked by fragility × criticality (do the top first)
1. **INV18** (non-public mutation references a recognised auth/tenant gate) — the broadest security gate; a
   large allowlist + reference regex; a silent break = anon-writable routes undetected. HIGH.
2. **INV13** (`.or(...ilike...)` sanitized) — SQL-injection-adjacent; a tricky regex. HIGH.
3. **INV19** (owner-session append check) — cross-user injection; complex. HIGH.
4. **INV16** (LLM maxDuration) — the `LLM_CALL_RE` is a big hand-maintained alternation that has already been
   caught missing a wrapper once (brain/learn); a detection-test would lock the known chokepoints. MEDIUM-HIGH.
5. **INV21** (`.limit(N)` > 1000) — a numeric-bound regex; easy to break silently. MEDIUM.
6. **INV24 / INV8 / INV11 / INV7 / INV20** — auth/fence/secret gates with moderate regexes. MEDIUM.
7. **INV9 / INV10 / INV12 / INV15 / INV17** — simpler set-membership / presence checks; lower silent-break
   risk, but still worth a smoke case. LOWER.

## Effort + shape
Each detection-test mirrors the INV14 one just shipped: re-declare the detector regex, assert it MATCHES the
real violation shape and does NOT match the controlled/negative shape, and (where the regex lives in the
script) `expect(SCRIPT).toContain(<key fragment>)` so a silent narrowing fails the test. ~15–25 min per
invariant. All in one test file, no production-code change — LOW risk (test-only).

## Decision
Greenlight to build (trigger *"detection-test the invariants"*). Options to size it:
- **All 15**, ranked order (one commit or a few grouped commits).
- **Top-N security-critical only** (INV18/13/19/16/21) — the highest silent-break × blast-radius.
- **Defer** — the gates still run; this hardens the gates themselves.

Recommended: at least the top-5 security-critical (INV18/13/19/16/21), since those are the gates whose silent
failure would be most costly and whose regexes are most fragile.
