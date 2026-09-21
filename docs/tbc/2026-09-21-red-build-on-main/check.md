# CHECK

## Commands run, by the project's own names

| Command | Before | After |
|---|---|---|
| `npm run build:ci` | **FAILED** at `/dashboard/meeting-coach/prep` | **✅ PASSED** — 383 pages generated |
| `npm run invariant:audit` | 1,039 files, 0 violations (INV27 did not exist) | 1,040 files, **0 violations**, INV27 active |
| `npx tsc --noEmit` | exit 0 | exit 0 |
| `npm run lint` | clean | clean |
| `npx vitest run` | 4,585 passed | **4,585 passed**, 15 skipped, 662 files |

`build:ci` passing is the point of this build, and it is the first time in this session that a
production build has rendered anything — including the Pitch Score UI from the previous build,
which had never been prerendered because the export died before reaching it.

## The gate was proven, not assumed

Re-introduced the real breaker into the real file:

```
Violations: 1
✗ route segment config (dynamic) in a "use client" file is silently ignored
    src/app/dashboard/meeting-coach/prep/page.tsx
```

Restored → 0 violations.

Nine self-tests run inside the audit itself (it exits 3 if any fail, declaring its own
0-violations untrustworthy). They cover both directions:

- fires on the directive as the first statement, and behind a leading comment block
- does **not** fire on a server page, nor on the string `"use client"` appearing later in a file
- flags `dynamic` and `revalidate`, ignores `dynamicThing`
- **would have caught the 2026-09-21 breaker**
- **stays quiet on the shipped fix**

The last two matter because the *first* attempted fix — adding `export const dynamic` to a file
that was still `"use client"` — is a state this rule must flag. A guard that only proved it could
stay quiet would have blessed it.

## Two false starts, recorded

The audit failed to parse twice before it ran: a shell heredoc turned `\n` inside the rule's
message and detector into literal newlines. Both times the failure was loud (`SyntaxError`, exit
1), so nothing shipped broken — but it is worth noting that a mangled rule in a **passing** audit
would have reported 0 violations while detecting nothing, which is why the self-tests exist.

## What is NOT verified

- **No browser opened the fixed page.** It builds and it prerenders; nobody has clicked
  "Start Meeting". The change is a file split, so the risk is low and non-zero.
- **INV27 sweeps `page`/`layout`/`template`/`default` only.** A `route.ts` cannot be a client
  component so it cannot hold this defect, but a client component exporting segment config from a
  non-page file is out of scope and would be dead code rather than a build break.
