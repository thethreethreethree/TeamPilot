# §1.7 Ground-up structural audit · 2026-07-22

Per §1.7, a foundation-up walk of the system, layer by layer in increasing order of consequence. This complements
the same-day *visual* audit cycle (`2026-07-22-ground-up-audit-cycle.md`) and the *route-security* sweeps
(`2026-07-22-service-role-route-authz.md`). Each layer: **solid** (verified this session) / **flagged** / **open**.
Outside-view stance (§1.3): read as if it were someone else's system.

| # | Layer | Status | Evidence (verified this session unless noted) |
|---|---|---|---|
| 1 | **Environment** | flagged→fixing | Node/Next 16 build works. `npm audit`: 1 HIGH (`sharp`/libvips) **fixed on branch `fix/sharp-cve-override`** (build-verified); 5 remaining are build-time Next-transitive tooling (~nil runtime risk, fix via Next update). |
| 2 | **Toolchain** | solid | Full `npm run check` green: typecheck · lint · theme:audit (0 leaks) · rls:audit (0) · invariant:audit (0) · 1123 tests. Fixed a flaky invariant-audit test (subprocess timeout). |
| 3 | **Types** | solid | `tsc --noEmit` clean across the project (re-run after every change this session). `noUncheckedIndexedAccess` on (caught two test bugs). |
| 4 | **Schema** (the highest-consequence layer) | solid | The three top structural invariants are DB-enforced, not application-code: §3.1 event-chain append-only (`events_no_update`/`no_delete` rules); **§3.2 Understanding Gate** (`check_understanding_gate()` trigger raises if signals < threshold — the central discipline, un-bypassable); finance ledger balance (deferrable constraint trigger at commit). See the data-integrity sections in the route-security audit doc. |
| 5 | **RLS / tenant isolation** | solid | `rls:audit`: every table RLS-enabled, every op covered/documented, every update/all policy pins the tenant on write, every view runs as invoker (0 RLS-bypassing views). Prior tamper sweeps (0090–0142) closed author-spoof / tenant push-out / SoD holes. |
| 6 | **Data integrity** | solid | Append-only chain (events→signals→problems→resolutions) immutable at the DB; `decision_dialogues` immutability trigger; CSV exports formula-safe (invariant audit). |
| 7 | **API** | solid | 10-sweep route-security audit (authz / cost-abuse / prompt-injection / CSRF / SSRF / XSS / mass-assignment / headers / open-redirect) — no live vulnerabilities. Every route validates input (zod, unknown-key-stripping) + is RLS- or service-role-authz-gated. |
| 8 | **Discipline** (the in-product AI) | solid | §3.2 gate structural (row 4). §3.4 control-window / "honesty is the moat" verified by enforcement in the 2026-07-16 audit (privileged self-write closed by triggers 0090/0093). §3.3 guide-don't-overtake: Care prompt hands off rather than fabricates (prompt-injection sweep). |
| 9 | **Presentation** | solid + 1 open | theme:audit 0 leaks (the V7 Tailwind color-collision root cause fixed + regression-guarded). Extension delivered (panel + adapters). **Open (branch):** WCAG 1.4.4 viewport a11y fix on `fix/viewport-a11y-pwa-scale-lock`. |

## Flags summary (leveraged bottom-up — a low-layer flag matters more)
- **Layer 1 (Environment):** the HIGH sharp CVE is the most leveraged flag — a foundational dependency. Fixed on
  a branch; **merge it.** The 5 build-time transitive CVEs are low-consequence (build-only, trusted input).
- **Layer 9 (Presentation):** the WCAG viewport fix + the file-mention autocomplete fix are on branches — merge.
- **Optional hardenings** (not flags, defense-in-depth): explicit cookie `SameSite`, HSTS for the standalone
  deploy target, a CSP (deferred with a documented nonce-strategy reason).

## Verdict
The foundation is genuinely solid where it is most consequential: the schema ENFORCES the constitution's central
claims (§3.1 immutability, §3.2 the Understanding Gate, ledger balance) rather than merely documenting them — the
strongest evidence that the thesis is *built*, not persuasive prose. The only bottom-layer flag (a dependency
CVE) is fixed and awaiting merge. Per §1.7.5 these are flags, not blockers; the actual gates (§3.2, §7 Default
Deny) remain the blockers. An empty flag list would itself be suspicious (§1.7.3) — this audit's flags are the
four branches + three optional hardenings, all on the record.
