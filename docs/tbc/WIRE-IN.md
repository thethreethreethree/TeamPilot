# TBC wire-in — the enactment patch (founder-gated)

> This file is the **exact** set of changes that make the TBC protocol *mandatory*.
> None of it is applied. It is enactment, and enactment is a §7.4 constitutional change
> gated on **AMD-008** being ratified. Apply top-to-bottom, in one commit, only after
> ratification. The bootstrap build (`docs/tbc/2026-07-28-install-tbc-gates/`) is already
> green, so applying these steps will not turn `check` or the commit flow red.

This file lives at `docs/tbc/WIRE-IN.md` — a sibling of the build directories, **not inside
one** — so its citations are not scanned by `verify-manifest` (which only reads files inside
the current build dir). Do not move it into a `<date>-<slug>/` directory.

---

## Step 1 — Ratify AMD-008 (founder-only)

Run the §7.2 soundness gate's **gate 5 (outside-view)** — a reading by a stance with no
investment in adopting the protocol. Five of the six gates are answered in
`docs/amendments/AMD-008-PROPOSED-automatic-build-protocol.md`; gate 5 is structurally
yours. Record the decision by **appending** to that file (§7.3, append-only):

- If ratified: append a `## Decision — RATIFIED <date>` section and rename the file
  `AMD-008-automatic-build-protocol.md` (drop `-PROPOSED`).
- If denied: append `## Decision — DENIED <date>` with the reason. Stop here; leave the
  gates installed-but-unwired (they harm nothing dormant).

## Step 1b — Update `src/lib/constitution.ts` (INVARIANT 12) — REQUIRED, easy to miss

Ratifying an amendment (setting its `**Status:** ratified`) makes `scripts/invariant-audit.mjs`
INVARIANT 12 expect the customer-facing version metadata to match the ratified record — or
`npm run check` breaks. On AMD-008 that means:

```
version: "1.8", amendmentCount: 7, lastAmendmentDate: "2026-07-28",
lastAmendmentId: "AMD-008",
lastAmendmentTitle: "The automatic build protocol (THINK · BUILD · CHECK) becomes mandatory",
```

(Count is 7 — AMD-001–006 + 008 — because AMD-007 is still PROPOSED; the gap at 007 is
intentional and INV12 handles it: count = ratified files, lastId = highest ratified.)

## Step 2 — Add the §2.1 clause to CLAUDE.md

Insert, at the end of `## 2. How the Agent Must Behave (Building the App)` (i.e. just before
`## 3.`), this block **verbatim**:

```markdown
### 2.1 Standing build protocol

> Added by [AMD-008](docs/amendments/AMD-008-automatic-build-protocol.md).

`BUILD-PROTOCOL.md` is operational, not reference. It runs automatically on
every build action per its §1 trigger table — no founder invocation required.

Before writing any file, the agent emits the PREFLIGHT and UNDERSTANDING
blocks. Before writing "verified", it emits the VERIFICATION block naming the
canonical command. Before declaring closure, it emits the CLOSURE block
including the un-named-reliance half.

Skipping the protocol because a change seems small is the §5 failure mode and
is forbidden. If the protocol conflicts with this constitution, the
constitution wins and BUILD-PROTOCOL.md is amended under §7.
```

## Step 3 — Regenerate DOC_MANIFEST.json (SAME commit as Step 2)

Editing CLAUDE.md changes its hash. `verify-docs.mjs` will fail unless the manifest is
regenerated **in the same commit** (an AMD reference authorises the edit but does not update
the manifest for you — that is by design). Run:

```bash
node -e "const c=require('crypto'),fs=require('fs');const h=p=>c.createHash('sha256').update(fs.readFileSync(p)).digest('hex');const l=p=>fs.readFileSync(p,'utf8').split('\n').length;const m=JSON.parse(fs.readFileSync('docs/tbc/DOC_MANIFEST.json','utf8'));for(const d of m.documents){d.sha256=h(d.path);d.lines=l(d.path);}fs.writeFileSync('docs/tbc/DOC_MANIFEST.json',JSON.stringify(m,null,2)+'\n');console.log('manifest regenerated');"
```

Then confirm: `node scripts/tbc/verify-docs.mjs` → `✓ tbc:docs`.

## Step 4 — Wire `tbc` into the canonical command

In `package.json`, change the `check` script from:

```
"check": "npm run typecheck && npm run lint && npm run theme:audit && npm run rls:audit && npm run invariant:audit && npm run test",
```

to (insert `&& npm run tbc` **after** `invariant:audit`, before `test`, matching spec §6.1):

```
"check": "npm run typecheck && npm run lint && npm run theme:audit && npm run rls:audit && npm run invariant:audit && npm run tbc && npm run test",
```

## Step 5 — Add the commit-time gate to `scripts/hooks/pre-commit`

**Not `.husky/pre-commit`** — this repo sets `core.hooksPath = scripts/hooks`, so a husky
hook would never fire. Insert, after the existing citation-detection block in
`scripts/hooks/pre-commit`, before its final `exit 0`:

```bash
# TBC (AMD-008): cheap doc + manifest integrity at commit time. Full set runs in `npm run check`.
npm run tbc:docs
npm run tbc:manifest
```

Note the existing hook runs `set -euo pipefail`, so a non-zero `tbc:*` exit will block the
commit — which is the intended behaviour once mandatory.

## Step 6 — Commit

One commit, message referencing the amendment and carrying a `Session-Reads` trailer (the
existing `commit-msg` hook requires it for the `§` citations in this diff):

```
feat(governance): make TBC build protocol mandatory (AMD-008)

Wires the THINK·BUILD·CHECK gates into `npm run check` and the commit hook,
adds CLAUDE.md §2.1, regenerates DOC_MANIFEST.json for the new hash.

Ratifies: AMD-008
Session-Reads: CLAUDE.md §2, §7.4 (2026-…); ThinkerThinker.md A30, A38 (2026-…)
```

## Step 7 — Prove it's green

```bash
npm run check    # now includes tbc — expect exit 0
```

If red: the first substantive commit after this must itself create a
`docs/tbc/<date>-<slug>/` build directory, because the gates now bind. That is the protocol
working as designed, not a break — but it is the behaviour change to expect.

---

## Rollback

Every step is reversible: revert the commit. The scripts and `docs/tbc/` scaffold can remain
(dormant) even if the mandate is rolled back — only Steps 2, 4, 5 make it mandatory.
