---
started_at: 2026-09-04T06:41:28+08:00
---

# THINK — the coaching-material 403 is unreachable, and its test proves nothing

## Why (found by verifying my own claim, not by a report)

I had been telling the owner that the mobile app "is TOLD its rank by the route". Checking that before repeating it
again showed it was false — the app calls the RPC directly and never reads `meRank`. Re-deriving the app's real
route inventory from its fetch sites is what led me back to `coaching-material`, where I found that `main` had
gained the Bearer shim from another session while I was working, in commit `cf7f6a08`.

That fix has a regression in it, and the regression is the exact one I had written into a THINK document earlier
today as the trap to avoid on this route.

## Understanding, from the two functions rather than from the diff (§0)

`main` now reads:

```ts
const ctx = await resolveApiAuth(req);
if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
const companyId = ctx.companyId;
if (!companyId) return NextResponse.json({ error: "No company context." }, { status: 403 });
```

**The 403 is unreachable.** Both auth paths refuse a caller with no company by returning `null`, not by returning a
context with a null `companyId`:

- `resolveApiAuth` (Bearer): `if (!profile || !profile.company_id || profile.status === "removed") return null;`
- `getCurrentAuthContext` (cookie): `if (!profile?.company_id) return null;`

So a signed-in rep with no company now receives **401 "Not authenticated."** where this route previously answered
**403 "No company context."** — and 401 is the one message that is definitely wrong for them, because they ARE
authenticated.

## The test that made it look covered

`__tests__/route.test.ts` asserts the 403, and passes:

```ts
mock(resolveApiAuth).mockResolvedValue({ userId: "u1", companyId: null, ... });
expect((await POST(req())).status).toBe(403);
```

It mocks a return value that function **cannot produce**. The test therefore pins behaviour that does not exist,
and reports a branch as covered which no request can reach. This is worth naming precisely because it is the more
dangerous half: the regression alone is a wrong status code; the regression plus a green test is a wrong status code
that nobody will look for again.

## Four layers (§1.5.1)

1. **Structure.** Keep the seam that exists. The fix is to ask the identity question separately when the full
   context is refused, using the helper written for exactly that — `resolveApiUserId`, whose own comment records
   this same failure happening once before on `/[id]/outcome`.
2. **Operational.** A caller with no company gets 403 again; nobody signed out gets anything but 401.
3. **The person.** A rep whose account is not attached to a company is told the truth about why, rather than that
   they are not signed in — which would send them to sign in again, repeatedly, and never fix it.
4. **Finish.** The test is rewritten to drive the real path, so it fails against the current code and passes
   against the fix. A test that cannot fail is not coverage.

## What could go wrong, before searching (§1.5.2)

- **`resolveApiUserId` might also refuse a caller with no company**, which would make the fix pointless. Read it:
  it deliberately does not require a profile at all, and its comment says why — the cookie path never required one.
- **Another route may have inherited the same shape** from the same session's work. Swept; recorded in check.md.
- **The web caller may depend on the 401.** Read `dashboard/sales-coach/training/page.tsx`: it branches on
  `res.ok` only and never reads the status. So this is invisible to today's callers — which is an argument for
  fixing it now rather than after something starts reading it.

## Session-read manifest (§3.1.2 / A22 / A35)

Every clause was re-opened in the working tree at the time recorded, after this build started. The earlier
builds in this session were not reused: "I read it an hour ago for a different build" is the shape that erodes
into "I know what it says", which is the failure A22 exists for.

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-04T06:44:22+08:00",
    "why_it_governs": "Understand before solving — and the understanding here is which VALUES a function can actually return, not what its call site assumes.",
    "how_this_build_will_embody_it": "think.md reads both auth helpers and quotes the two lines that return null, before naming the 403 unreachable." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-09-04T06:44:22+08:00",
    "why_it_governs": "The methodology must be in the tree at the moment of action.",
    "how_this_build_will_embody_it": "All three governing documents were re-opened at the ranges recorded here, after this build's started_at." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-09-04T06:44:22+08:00",
    "why_it_governs": "Four layers, foundation up.",
    "how_this_build_will_embody_it": "L3 is why this is worth a branch: a rep with no company is told they are not signed in, and signing in cannot change it." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-152", "read_at": "2026-09-04T06:44:22+08:00",
    "why_it_governs": "Think first about how this could fail, then search to confirm.",
    "how_this_build_will_embody_it": "Three hypotheses written before searching: resolveApiUserId might refuse too, another route might share the shape, and a caller might depend on the 401. All three were checked in the code." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-452", "read_at": "2026-09-04T06:44:22+08:00",
    "why_it_governs": "The checklist — item 3: am I about to repeat a failed approach?",
    "how_this_build_will_embody_it": "The approach that failed is the one on main. This build does not re-implement the route; it changes the four lines that made a branch unreachable." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-468", "read_at": "2026-09-04T06:44:22+08:00",
    "why_it_governs": "Citing a label without its content is the canonical failure.",
    "how_this_build_will_embody_it": "Every asset below was re-opened at its range within this build's window." },
  { "id": "A21", "source_file": "ThinkerThinker.md", "line_range": "530-542", "read_at": "2026-09-04T06:44:22+08:00",
    "why_it_governs": "Cross-module: the same concept under two names.",
    "how_this_build_will_embody_it": "'A route that tells not-signed-in apart from no-company' was swept across every route using resolveApiAuth." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-606", "read_at": "2026-09-04T06:44:22+08:00",
    "why_it_governs": "Citations without session-reading operate undetected.",
    "how_this_build_will_embody_it": "This build's reads are its own; the earlier builds in this session were not reused." },
  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-703", "read_at": "2026-09-04T06:44:22+08:00",
    "why_it_governs": "A pattern match is a SUSPECT — confirm the shape actually manifests.",
    "how_this_build_will_embody_it": "The unreachable 403 was confirmed by reading the two functions that return null, not inferred from the shape of the diff." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-780", "read_at": "2026-09-04T06:44:22+08:00",
    "why_it_governs": "A lesson in prose returns; encode it in a gate that fails without the author's cooperation.",
    "how_this_build_will_embody_it": "The test was RUN against the previous code and observed to fail before being kept — the gate is proven, not asserted." },
  { "id": "A31", "source_file": "ThinkerThinker.md", "line_range": "793-806", "read_at": "2026-09-04T06:44:22+08:00",
    "why_it_governs": "The seam between the system and the surface.",
    "how_this_build_will_embody_it": "build.md records that no screen reads this status today, and says so rather than implying a visible fix." },
  { "id": "A33", "source_file": "ThinkerThinker.md", "line_range": "852-866", "read_at": "2026-09-04T06:44:22+08:00",
    "why_it_governs": "A gate must be PRECISE or not exist.",
    "how_this_build_will_embody_it": "No gate is invented for 'a mock that returns something impossible' — the hole is named instead, because any cheap check would fire on this file's three legitimate stubs." },
  { "id": "A35", "source_file": "ThinkerThinker.md", "line_range": "900-912", "read_at": "2026-09-04T06:44:22+08:00",
    "why_it_governs": "The hook charges for the citation, not the reliance.",
    "how_this_build_will_embody_it": "The minimum set is present whether or not the prose quotes it." },
  { "id": "A36", "source_file": "ThinkerThinker.md", "line_range": "923-936", "read_at": "2026-09-04T06:44:22+08:00",
    "why_it_governs": "Read the residual from the top of the confidence ranking.",
    "how_this_build_will_embody_it": "The highest-confidence entry was opened before closure." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1010", "read_at": "2026-09-04T06:44:22+08:00",
    "why_it_governs": "'Verified' names the command you ran.",
    "how_this_build_will_embody_it": "check.md leads with the canonical gate and, more importantly, pastes the run that shows the test failing against the old code." },
  { "id": "§3.1.2", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "119-160", "read_at": "2026-09-04T06:44:26+08:00",
    "why_it_governs": "Defines this manifest and requires an in-session read_at.",
    "how_this_build_will_embody_it": "Every clause re-opened after this build's started_at." },
  { "id": "§3.2.1", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "223-228", "read_at": "2026-09-04T06:44:26+08:00",
    "why_it_governs": "Deviating from the request is a violation; flag before acting.",
    "how_this_build_will_embody_it": "The other session's shim is kept. Only the four lines that broke the 403 are changed, and my own competing branch is retired rather than argued for." },
  { "id": "§3.2.2", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "229-262", "read_at": "2026-09-04T06:44:26+08:00",
    "why_it_governs": "Write path and read path, both asserted.",
    "how_this_build_will_embody_it": "The read path is recorded as NOT human-visible today, which is the honest entry rather than the flattering one." },
  { "id": "§3.2.3", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "263-292", "read_at": "2026-09-04T06:44:26+08:00",
    "why_it_governs": "Run the canonical command by name.",
    "how_this_build_will_embody_it": "check.md leads with npm run check and its exit code." },
  { "id": "§3.3.1", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "298-301", "read_at": "2026-09-04T06:44:26+08:00",
    "why_it_governs": "Audit the built files, not the intent.",
    "how_this_build_will_embody_it": "Both auth helpers, the route, its whole test file and the single web caller were opened." },
  { "id": "§3.3.2", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "302-313", "read_at": "2026-09-04T06:44:26+08:00",
    "why_it_governs": "A CHECK with no cross-module pass is incomplete.",
    "how_this_build_will_embody_it": "Every route using resolveApiAuth was swept for the same shape; one hit." },
  { "id": "§3.3.3", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "314-330", "read_at": "2026-09-04T06:44:26+08:00",
    "why_it_governs": "Name the class by its root shape; record the command.",
    "how_this_build_will_embody_it": "'A guard written against a value the function it guards cannot return', with the sweep command in check.md." },
  { "id": "§3.3.4", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "331-345", "read_at": "2026-09-04T06:44:26+08:00",
    "why_it_governs": "Gate or promise, per fix.",
    "how_this_build_will_embody_it": "One gate, proven by restoring the old code; one promise declined with the hole named." },
  { "id": "§3.3.5", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "347-352", "read_at": "2026-09-04T06:44:26+08:00",
    "why_it_governs": "Never report clean for something not inspected.",
    "how_this_build_will_embody_it": "The un-inspected case — a real account with no company — is named and carried into the residual." },
  { "id": "§4", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "418-457", "read_at": "2026-09-04T06:44:26+08:00",
    "why_it_governs": "The residual is a queue read from the top of the confidence ranking.",
    "how_this_build_will_embody_it": "Two entries; the high-confidence one opened before closure." },
  { "id": "§6.2", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "515-528", "read_at": "2026-09-04T06:44:26+08:00",
    "why_it_governs": "The gate that reads this manifest.",
    "how_this_build_will_embody_it": "Each range was printed with its first line before this block was written." }
]
```
