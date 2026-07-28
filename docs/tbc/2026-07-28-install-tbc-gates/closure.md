# CLOSURE — TBC gate installation

## 1. Session-read manifest

The full 23-entry manifest is in `think.md`'s manifest section (minimum set + relied-on
assets, each with a this-session `read_at` and a checked line range). Nothing was read later that is not already
there. The manifest gate confirms every id cited across these five artifacts resolves to an
entry.

## 2. Build inventory (reachability per A31)

| Component | write-path | read-path | status |
|---|---|---|---|
| `scripts/tbc/*.mjs` (5) | run by dev/CI; `npm run tbc` on ratification | exit code + `✗` labels | BUILT |
| `DOC_MANIFEST.json` + `ALLOWLIST.json` | sha256 this session / per-exception reason | `verify-docs` + `loadAllowlist` | BUILT |
| bootstrap artifacts (this dir) | authored this session | the three artifact gates | BUILT |
| `AMD-008` proposal + `OPEN.md` | append-only record | founder outside-view / next build | BUILT (proposal) · PENDING (ratify) |

**Not built (deliberately):** the mandatory wire-in — `tbc` into `check`, and the
`.husky/pre-commit` hook. Both are gated on AMD-008 ratification (§7.4) and are the only
steps that could turn `check`/commits red, so they are held until the bootstrap passes and
the founder ratifies.

## 3. Verification record (A38)

**Canonical command `npm run check`** — run by name this session after all install files
were added:

```
> execos@0.1.0 check
...
 Test Files  225 passed | 1 skipped (226)
      Tests  1602 passed | 15 skipped (1617)
EXIT=0
```

Coverage: 6-of-6 gates, exit 0. The install did not break the existing canonical command.

**The four TBC gates** — re-run by name after the F1 fix (`node scripts/tbc/verify-<x>.mjs`):

```
$ node scripts/tbc/verify-docs.mjs
  · 2 governing document(s) match the manifest.
✓ tbc:docs                                         [exit 0]

$ node scripts/tbc/verify-manifest.mjs
  · build: docs/tbc/2026-07-28-install-tbc-gates
  · 23 manifest entr(ies)
✓ tbc:manifest                                     [exit 0]

$ node scripts/tbc/verify-artifacts.mjs
  · build: docs/tbc/2026-07-28-install-tbc-gates
✓ tbc:artifacts                                    [exit 0]

$ node scripts/tbc/verify-residual.mjs
  · 3 residual entr(ies); top residual RES-2026-07-28-01 opened with an outcome
✓ tbc:residual                                     [exit 0]
```

All four TBC gates exit 0 against this directory. The install is proven correct by its own
gates **before** any wire-in — so flipping enforcement on (post-ratification) cannot turn
`check` or the commit flow red on this build.

## 4. Findings ledger

| id | severity | disposition | class | boundary swept |
|---|---|---|---|---|
| F1 | LOW | FIXED | POSIX-separator assumption in tooling labels | `grep -rnE 'split\("/"\)\|REPO \+ "/"' scripts/tbc/` → 4 sites, all routed through `repoRel` |

No CRITICAL or HIGH findings. The one LOW finding was fixed at a chokepoint (A30).

## 5. Gates added (what now fails mechanically that did not before)

Once AMD-008 is ratified and `tbc` is wired into `check`:

- A build with no `docs/tbc/<date>-<slug>/` directory fails (`verify-manifest` / `verify-artifacts`).
- A closure whose top-confidence residual is unopened fails (`verify-residual`, A36).
- A `CLAUDE.md`/`ThinkerThinker.md` edit without a referenced AMD fails (`verify-docs`, §7.4) — the **first mechanical enforcement of §7.4**.
- An assurance word (the A38 vocabulary) without an adjacent pasted command and exit code fails (`verify-artifacts`, A38).
- A citation without a session-read manifest entry fails (`verify-manifest`, A22/A35).

**Until ratification, none of these are active** — the gates exist and pass on this dir, but
nothing invokes them in `check` or at commit time.

## 6. Residual queue (A36 — a work queue, not a disclaimer)

```json
[
  {
    "id": "RES-2026-07-28-01",
    "item": "The commit-time hook (tbc:docs + tbc:manifest) is strict enough to matter.",
    "why_skipped": "Assumed the hook forces a fresh think.md per commit; felt like the strong enforcement point.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-07-28T12:10:00Z",
    "outcome": "OPENED and the high-confidence label was wrong, exactly as A36 predicts. Read verify-manifest: currentBuildDir() returns the lexically-greatest EXISTING dir. A committer who commits without creating a new build dir is checked against the PREVIOUS (complete) dir and passes. So the hook does NOT force per-commit artifacts — it enforces 'the latest build dir is valid,' which is weaker than assumed. Not a defect in this install (the wire-in is deferred anyway), but filed to docs/residuals/OPEN.md as a real follow-up: consider a freshness check (build dir newer than the code diff) before making the hook mandatory."
  },
  {
    "id": "RES-2026-07-28-02",
    "item": "The gates behave correctly against a SECOND, independent build directory.",
    "why_skipped": "Tested only against this bootstrap dir; currentBuildDir picks lexically-greatest, untested with two dirs present.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-07-28T12:35:00Z",
    "outcome": "OPENED and tested: created a lexically-greater dummy dir (2026-08-15) and a lesser one (2026-06-01), probed currentBuildDir() — it correctly switched to the greatest, ignored the lesser, and never selected the DOC_MANIFEST.json / ALLOWLIST.json / WIRE-IN.md files (isDirectory filter). Selection logic sound; 'medium' confidence was justified. Dummy dirs removed."
  },
  {
    "id": "RES-2026-07-28-03",
    "item": "ThinkerThinker.md's embedded pre-amendment constitution (the A16 divergence).",
    "why_skipped": "Editing a governing doc is out of scope for the install; it needs its own governed change with the subset-check.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null,
    "outcome": "Not opened here — it genuinely matters (hence low confidence it does not). Tracked as the top item in docs/residuals/OPEN.md with the pointer-fix recommendation."
  }
]
```

The top-ranked entry (highest confidence-it-does-not-matter) was opened per A36, and opening
it produced a real finding the cached label had hidden. That is the evidence that this first
TBC-governed build *took* rather than producing five well-formed files and nothing else.

## 7. Hypothesis outcomes

- **H1** (additions can't break `check`) — **CONFIRMED.** `npm run check` exit 0 after the additions.
- **H2** (the four gates hold against this dir) — **CONFIRMED** after the F1 reword + fix (see the verification record above).
- **H3** (wiring in before the bootstrap is ready would break the flow) — **CONFIRMED by source:** `verify-manifest`/`verify-artifacts` fail when `currentBuildDir()` is null or `think.md` is absent, so a naive wire-in on a repo with no build dir goes red. This is why the wire-in is the last, ratification-gated step.

## 8. Doc hashes (this build was conducted against)

- `CLAUDE.md` — `2c5c027ed27d6734fb0ffdefe04b554b84060a3c03c869bc32c3eb52684317b2` (413 lines)
- `ThinkerThinker.md` — `cc9071abd15ab7e06c3e89fef38f66da0b9df351ffa2afde50ec3d4664ef1d92` (1211 lines)
