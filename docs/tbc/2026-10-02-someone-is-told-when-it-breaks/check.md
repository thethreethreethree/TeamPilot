# CHECK - someone is told when it breaks

## Commands

```
$ npx vercel@latest env ls production --project team-pilot   (names only)
  NEXT_PUBLIC_MEETING_COACH_ENABLED CRON_SECRET ELEVENLABS_API_KEY NEXT_PUBLIC_VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY
  VAPID_SUBJECT NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY NEXT_PUBLIC_SUPABASE_URL DEEPSEEK_API_KEY
$ npx tsc --noEmit -p .
exit 0
$ npx vitest run src/lib/llm src/lib/coach src/app/api
 Test Files  403 passed (403)
      Tests  3325 passed (3325)
exit 0
$ (mutation: captureMessage call removed)   providerHealth.test.ts   Tests  2 failed | 15 passed   exit 1 (restored)
$ (mutation: browser flag reads SENTRY_DSN too)   health route.test.ts   Tests  1 failed | 5 passed   exit 1 (restored)
```

The full `npm run check` is appended below.

## Findings

### Error reporting was off in production while the code assumed it was on

class: an external-config dependency failing silently (CLAUDE.md §1.5.3)
sweep: every item of docs/CONFIG-PRECONDITIONS-AUDIT.md against the production variable names (done; appended there)
severity: high

### A mock that named only one Sentry function

class: a module mock narrower than the module's real use
sweep: grep -rln '@sentry/nextjs", () =>' src (2 files, both now provide captureMessage)
severity: low

The worker test failed when providerHealth began calling captureMessage; caught by running the worker tests
before the gate.

## Not opened

No image, icon, logo, favicon or graphic asset was touched.

## Full gate (three runs; the first two failed, recorded rather than dropped)

```
$ MIGRATION_AUDIT_PSQL="docker exec -i pgprobe psql -U postgres" PGHOST=localhost PGPORT=55433 ... npm run check
run 1: exit 1   invariant:audit ✗ Unreviewed NEXT_PUBLIC_ env var: NEXT_PUBLIC_SENTRY_DSN in src/app/api/health/route.ts
       -> added to NEXT_PUBLIC_ALLOWLIST with its reason (a DSN only sends events; it is meant for the browser).
          It was already read by the two root config files, which the audit does not scan.
run 2: exit 1   envDocsComplete.test.ts: SENTRY_DSN undocumented in .env.example
       -> documented beside NEXT_PUBLIC_SENTRY_DSN, with the fallback and the health flag.
run 3: exit 0
 Test Files  728 passed | 1 skipped (729)
      Tests  5669 passed | 15 skipped (5684)
```

## Appended 2026-10-02T06:35Z - a comment that claimed Sentry kept every AI error

### publicMessage.ts said "Sentry keeps the exception"

class: a code comment asserting an outside system's behaviour that was never checked
sweep: grep -rnE "Sentry (keeps|has|captures|records|gets)|reported to Sentry|in Sentry" src (4 hits)
severity: low

Untrue twice over: no DSN in production, and even with one, a route that answers with llmPublicMessage does not
throw, so request-error capture never sees it. Corrected. The other two hits (worker.ts, pitchFailureMessage.ts)
are true once the DSN exists: the worker calls Sentry.captureException itself.

```
$ npm run check   (with the comment correction)
 Test Files  728 passed | 1 skipped (729)
      Tests  5669 passed | 15 skipped (5684)
exit 0
$ curl -s https://elostate.com/api/health   (6679b5f live, 06:26Z)
  "errorReporting": {"server": false, "browser": false}   <- loud, as intended, until the DSN is set
```
