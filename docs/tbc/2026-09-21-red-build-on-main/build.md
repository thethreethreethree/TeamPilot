# BUILD

## Files

**`src/app/dashboard/meeting-coach/prep/page.tsx`** — was `"use client"` holding a `useRouter`
call. Now a **server shell**: no directive, `export const dynamic = "force-dynamic"` (which is
therefore actually honoured), mounting one client component.

**`src/components/sales-coach/meeting/MeetingPrepUpRoute.tsx`** (new) — the client half. Holds the
`useRouter` navigation and nothing else. `MeetingPrepUp` is untouched.

This is the shape `/dashboard/sales-coach/doors` already had, so the codebase now has one pattern
for "a page mounting a component that builds the browser client at render", not two.

**`scripts/invariant-audit.mjs`** — INVARIANT 27, plus nine self-tests and a summary-line entry.

## The rule

```
a "use client" page/layout/template/default file that exports
dynamic | revalidate | runtime | fetchCache | dynamicParams | preferredRegion | maxDuration
```

No allowlist, because there is no legitimate instance: Next.js honours segment config only in a
server component, so in a client file the line is dead at best and the page is silently
prerendered against the author's intent at worst.

Detection is plain string work, not a regex. `"use client"` must be the first *statement*, so the
check walks lines and skips blanks and comments until it finds one. A regex for "first statement"
is easy to get subtly wrong, and a subtly-wrong gate is worse than none (A33).

## Proven to fire, not assumed to

The real breaker was re-introduced into the actual page and the audit re-run:

```
Violations: 1
✗ route segment config (dynamic) in a "use client" file is silently ignored
    src/app/dashboard/meeting-coach/prep/page.tsx
```

Restored: 0 violations.

## Two false starts, both mine, both recorded

The `why` string and the detector regex were each written with escape sequences that a shell
heredoc mangled into literal newlines, and the audit died with a `SyntaxError` twice before it ran
at all. Recorded because it is the same shape as the bug being fixed: a line that looks right in
the source and does something other than what it says.

The audit also flagged its own fix — my new docblock quoted the public Supabase env prefix in
prose, which tripped the NEXT_PUBLIC_ leak guard. Reworded. A guard catching a comment is noise,
but a guard that can be silenced by rewording a comment is still doing its job on real code.
