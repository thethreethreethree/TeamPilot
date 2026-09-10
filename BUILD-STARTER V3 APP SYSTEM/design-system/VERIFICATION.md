# Verification record

What was actually tested, what passed, and what is still a known limit.

This file exists because a system that enforces rigour should be able to show
its own working. An independent audit was run against this toolkit before
release; the bugs it found are listed at the bottom with their fixes.

---

## Colour engine — `tools/lib/oklch.mjs`

| Check | Result |
|---|---|
| hex → OKLCH → hex round trip | **Exact** for 15 named colours and 20,000 random sRGB triples, including through `formatOklch` CSS-string precision |
| Cross-check against `culori` | max ΔL 6.5e-9, ΔC 3.4e-8, ΔH 2.5e-5; reverse conversion matched exactly |
| Gamut fitting | Binary search converges inside 1/255 of a channel |

## Contrast engine — `tools/lib/wcag.mjs`

| Check | Expected | Measured |
|---|---|---|
| black on white | 21.00 | 21.00 |
| `#767676` on white | ≈4.54 | 4.542224959605253 |
| `#56317E` on white | ≈9.83 | 9.830156201059367 |
| 18px bold counts as large text | no | no |
| 18.66px bold counts as large text | yes | yes |
| APCA black-on-white | ≈106 | 106.04 |
| APCA white-on-black | ≈−108 | −107.88 |

Identical to `culori` to the last digit on every sampled pair.

## Token generation — `tools/token-gen.mjs`

- **144 seed colours** — 24 curated (pure white, pure black, chroma 0, chroma
  0.37 at hues 0/90/180/270, L 0.99, L 0.02) plus 120 random: **0 crashes, 0
  contrast failures, all exit 0**.
- **800 token pairs re-verified with continuous maths** (`culori`, not the
  toolkit's own 8-bit path): **0 below 4.5:1**. An earlier build had 22 pairs
  (1.7%) sitting fractionally below when measured this way, because the solver
  stopped the instant it cleared the threshold on quantised sRGB. A 2% safety
  margin now guarantees the emitted CSS clears in both models.

## Static linting — `tools/design-lint.mjs`

- All 25 rules fire on purpose-built violations.
- Every regex in `rules.json` compiles under `/gu` (checked in CI-style loop —
  two invalid `\"` escapes were caught this way and fixed).
- A realistic 60-line React Native / NativeWind component, and `token-gen`'s own
  generated `theme.ts`, both produce **zero findings**.

## Runtime auditing — `tools/runtime-audit.mjs`

The runtime gate is exercised against a deliberately broken screen and a clean
one across three screen sizes:

- Broken screen: **33 blocking, 11 warnings** — horizontal overflow, 16×16 tap
  targets, 10px text, missing screen title, missing landmarks/roles, an
  oversized sticky header, unsized images, missing focus indicators, plus
  accessibility-scanner violations.
- Clean screen: **0 blocking, 0 warnings** at all three sizes.

> App-Edition note: the runtime gate is ultimately an **on-device / simulator**
> check — run the core flow on real iOS and Android, and automate it with a
> device harness (Detox / Maestro — **verify current**). A skipped device check
> is not a pass.

## Hooks

| Behaviour | Verified |
|---|---|
| `pre-write-guard` blocks a UI write with no contract | exit 2 |
| `pre-write-guard` blocks rule violations in proposed content | exit 2 |
| `pre-write-guard` allows compliant content | exit 0 |
| A waiver in the contract unblocks the write | exit 0 |
| Prose merely *mentioning* a rule does **not** waive it | exit 2 |
| Temp lint copy stays inside the temp directory | contained |
| `stop-gate` blocks a failing build | exit 2 |
| `stop-gate` releases after 4 consecutive failures | exit 0 on attempt 5 |
| `stop-gate` fails **closed** if `tools/gate.mjs` is removed | exit 2 |
| All hooks survive `null` on stdin | no crash |

## End to end

Fresh project → install → gate BLOCKED (no contract) → contract from template
→ still BLOCKED (unfilled placeholders) → contract completed → tokens generated
(`theme.ts`) → compliant screen written → **gate PASS**. Install completes in
under a second.

---

## Bugs found by the pre-release audit, and their fixes

All were found by an independent reviewer running the code, not by reading it.

### Critical

1. **Waiver deadlock.** The PreToolUse hook linted a temp copy with the lint
   root pointed at the temp directory, so waivers were never read — while the
   block message told the agent to add one. An agent following the hook's own
   instructions could never unblock itself.
   *Fixed:* `MDGL_WAIVER_ROOT` carries the real project path.

2. **The escape hatch did not escape.** After the loop limit, `stop-gate`
   printed "no longer blocking" and then exited 2, which blocks. *Fixed:* it
   now exits 0 with a `systemMessage` requiring the failure be reported.

3. **Waivers were granted by prose.** The waiver regex fell back to scanning
   the entire contract, so a sentence like "we never violate DS-001" disabled
   that rule project-wide — and the template's inline `waivers: []` made that
   fallback the default path. *Fixed:* waivers are read only from the
   frontmatter key or the Waivers table's first column.

4. **Temp path escape.** `path.join(tmpDir, relativePath)` was unguarded
   against `../`, and with a deep project root could resolve onto a real
   absolute path and overwrite it. *Fixed:* the resolved path is verified to be
   inside the temp directory, with a basename fallback.

### High

5. **DS-021 was dead.** Its lookahead required `onClick`/`Button` to appear
   after the size class without crossing a quote — impossible in real JSX.
   *Fixed:* rewritten as a brace-aware detector.

6. **Any `=>` in a JSX attribute defeated four rules.** `[^>]*` stopped at the
   `>` of an arrow function, silently disabling DS-006/009/010 and producing a
   false positive on DS-007. *Fixed:* a brace- and quote-aware JSX tag scanner
   replaces the naive pattern.

7. **Line numbers were wrong after any block comment**, because comment
   blanking destroyed newlines — and those numbers are what the hooks feed back
   to the agent. *Fixed:* newlines preserved.

8. **The loop guard was dead code.** `stop_hook_active` short-circuited before
   the counter was read, so the gate blocked once per turn then fell silent.
   *Fixed:* the session-scoped counter now bounds the loop.

9. **The gate was trivially bypassable** by deleting `tools/gate.mjs`. *Fixed:*
   fails closed when the hooks are installed but the gate is missing, and
   `permissions.ask` now covers all of `tools/**`.

### Medium and low

- DS-012 missed both Tailwind `!` modifier forms — fixed.
- DS-023 false-positived on `max-w-4xl` — fixed.
- DS-024 counted per file rather than per view — fixed.
- DS-001 flagged `href="#abc"` as a colour — fixed.
- DS-018 flagged `✓` and `★` as emoji — emoji ranges narrowed.
- DS-016 reported twice — fixed.
- `--staged` was documented but unimplemented — implemented.
- The G1 placeholder check missed most of its own template's placeholders —
  broadened.
- Hooks crashed on `null` stdin (`JSON.parse("null")` returns null without
  throwing) — fixed.
- The installer copied `node_modules` file-by-file and then deleted it, and its
  probe tested the contract gate while claiming to test the lint gate — both
  fixed.
- `18.66px` was asserted where W3C says "approximately 18.5px" — both figures
  now stated, stricter one used.
- The type scale was described as a pure 1.25 ratio; it only holds from `3xl`
  up — now stated honestly.

---

## Known limits

Stated plainly, because a verification document that only lists successes is
marketing.

- **The linter is regex- and scanner-based, not an AST parser.** It is tuned to
  avoid false positives, which means it will miss some real violations. A file
  that passes is not proven correct.
- **Automated accessibility tooling catches roughly a third of WCAG failures.**
  Contrast, name/role/value and landmark checks are reliable. Focus order,
  meaningful alt text and error-recovery flows are not.
- **Nine token pairs are not gated** — `chart-1..5`, `border`, and
  `sidebar-border`. Charts are checked by eye against the dataviz rules; plain
  dividers are decorative and deliberately below 3:1. The tool reports these as
  advisory rather than claiming they passed.
- **DS-020 (desktop hamburger) is heuristic.** It looks for a menu trigger not
  scoped to small screens. A sufficiently unusual navigation implementation
  will slip past it.
- **The Stop gate blocks at most 4 times per session**, then releases with a
  warning. This is a deliberate deadlock guard, not a loophole — but it does
  mean a determined agent that cannot fix the gate will eventually be allowed
  to stop. The release message requires it to report the failure.
- **Taste is not automatable.** Every gate can pass on a build that is dull.
  §16 of the manual is the part that matters and the part no program checks.
