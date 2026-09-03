# BUILD — the coaching-material 403 is reachable again

Built on top of `main`, not as a competing branch (§3.2.1). Another session shipped the Bearer shim for this route
in `cf7f6a08` while I was working; the shim itself is right and stays. This changes only the four lines that made
the 403 unreachable, and the one test that reported it as covered.

### The 403 branch on `POST /api/coach/sales-session/coaching-material`

- `src/app/api/coach/sales-session/coaching-material/route.ts` — the failure path asks `resolveApiUserId` whether
  anybody is signed in before choosing between 401 and 403.
- `src/app/api/coach/sales-session/coaching-material/__tests__/route.test.ts` — the 403 test now drives the real
  path. It fails against the previous code.

write-path: `route.ts:41-56` — `resolveApiAuth` for the full context; when it refuses, `resolveApiUserId` for
  identity alone. Neither is new: both were already in the repo, and the second exists precisely for this case.
read-path: the status a caller receives. `dashboard/sales-coach/training/page.tsx:184` is the only current caller
  and reads `res.ok` only — so no screen changes today. That is an argument for fixing it now, while nothing depends
  on the wrong value, rather than after something starts reading it.

```json
{
  "feature": "a signed-in caller with no company is told so, rather than told they are not signed in",
  "files": ["src/app/api/coach/sales-session/coaching-material/route.ts",
            "src/app/api/coach/sales-session/coaching-material/__tests__/route.test.ts"],
  "write_path": { "exists": true, "where": "route.ts:41-56", "human_can_set": true },
  "read_path": { "exists": true, "where": "the HTTP status; training/page.tsx:184 is the only caller today",
                 "human_can_see": false,
                 "note": "Deliberately recorded as NOT human-visible right now. The caller reads res.ok only, so this is a correctness fix ahead of a reader, not a bug someone is looking at." },
  "status": "BUILT"
}
```

## What was wrong

```ts
const ctx = await resolveApiAuth(req);
if (!ctx) return 401 "Not authenticated.";
const companyId = ctx.companyId;
if (!companyId) return 403 "No company context.";   // unreachable
```

Both auth paths refuse a company-less caller by returning `null`, never a context with a null `companyId`:
`resolveApiAuth` does `if (!profile || !profile.company_id …) return null`, and `getCurrentAuthContext` does
`if (!profile?.company_id) return null`. So the 403 could not fire, and every rep whose account has no company was
told **"Not authenticated."** — the one thing that is definitely untrue of them. They are authenticated. Sending
them to sign in again puts them in a loop that cannot end.

## The half that made it invisible

The route's own test asserted the 403 and passed, by mocking `resolveApiAuth` to return `{ companyId: null }` — a
value that function cannot produce. **A test that pins impossible behaviour is worse than no test**: it reports the
branch as covered, so nobody looks at it again. The rewritten test drives the real shape and was proven to fail
against the previous code before being kept.

## Not a competing branch

I had built the same shim on `coach-material-bearer-mobile` before `main` gained one. That branch is now
superseded and should be discarded rather than reviewed — this is the same fix expressed as a four-line delta on
top of what is already merged, which is the mergeable shape.

## UNTESTED

The route against a real account with no company. That needs a live profile in that state, which is not something
to manufacture in production.
