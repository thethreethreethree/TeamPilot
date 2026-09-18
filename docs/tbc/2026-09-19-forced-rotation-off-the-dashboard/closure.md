# CLOSURE — a shared password nobody is forced to rotate is not temporary

This build came out of a request that was not a build at all: add two people to Align Sales Pros,
they are having trouble making an account. Neither email existed in `auth.users`, so the trouble was
simply that nobody had made them one.

What turned it into a build is that provisioning those two accounts by hand meant walking every
path the "Add agent" button walks — and three of them had something wrong.

The one that matters is F1. `must_change_password` is the mechanism that makes a *shared* team
password temporary: an admin hands one secret to several new hires, and the forced rotation is what
retires it from each account. It was enforced in exactly one file, `dashboard/layout.tsx`, while the
middleware matcher never covered `/api/*` and the extension gate resolved company entitlement
without ever reading the flag. A salesperson works in the extension. They can go a long time without
loading a dashboard page, and for all of it the shared password stays live on their account.

That was not deduced from the code alone. Verifying the two new accounts required signing in as
them, and the sign-in returned a valid `access_token` with the flag still set — the hole was visible
because the verification step was real rather than a re-reading of the write that had just returned
200.

The care went into placement, not logic. Adding the column to the existing profile select is the
obvious version and it is a trap: a missing column errors the entire query, yields a null profile,
and the next line reads that as "no company associated" — so on any environment where 0235 were
unapplied, the tidy fix would 403 every extension user. The layout had already met this and solved
it with a separate best-effort read. Here the same discipline is kept while holding the fast path at
one query: three columns, falling back to two. The gate goes inactive on a missing column instead of
closing on everybody, and the test asserts the retry actually ran rather than trusting it.

Two smaller things travelled with it. Members added through "Add agent" were being named after their
email prefix, because the 2026-08-21 fast path dropped the name capture the older invite path had —
a regression, and the name in question is the rep's identity on the leaderboard. And the suite used
to verify any of this was running 294 of 647 files.

That last one carries its own correction, which is the honest part of this closure. The tempting
account was "the gate said nothing was wrong while a third of the suite never ran." It was measured
rather than asserted, and the old configuration exited **1**. The failure was loud. What it was not was
*legible*: `2110 passed | 0 failed` reads as an environment problem to route around, not as absence.
The claim was corrected in the source comment and in check.md before either was committed, which is
the only reason it is not now a durable falsehood in the repository.

What this build does not do is close the class. `resolveApiAuth` re-derives the same auth decision
for 12 mobile routes and says so in its own header. The founder was given that against a
middleware-wide alternative and chose the narrow fix, so it stays open, named, and theirs.

## Residuals

```json
[
  { "id": "R1-the-second-bearer-path-still-has-no-rotation-gate",
    "item": "resolveApiAuth authenticates a Bearer token for 12 routes (KPI, leaderboard, gamification, sales-session CRUD) and never reads must_change_password. A rep holding an unrotated shared password reaches all of them.",
    "why_skipped": "Offered to the founder in a picker against a middleware-wide fix; they chose the narrow extension gate. Extending into the mobile surface is a separate decision with its own UX consequence — a mobile client has no /set-password screen of its own to send the user to — and taking it quietly would be the §3.3 overtake.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-19T05:30:00+08:00",
    "outcome": "OPENED and left open deliberately. The exposure needs someone to already hold a distributed team password, so it is insider/lateral rather than remote, which is what makes deferring it defensible rather than negligent. Named in check.md and here so the next reader does not mistake the extension fix for the class being closed. The §2.2 remedy — have resolveApiAuth consume requireExtensionAuth's verdict instead of mirroring its conditions — is the shape of the real fix whenever the founder wants it." },

  { "id": "R2-the-fallback-is-a-security-gate-that-fails-open",
    "item": "If the must_change_password column is unreadable, the extension gate goes inactive rather than denying.",
    "why_skipped": "The alternative fails closed on EVERY extension user of a paid surface, not just an unrotated one, because a missing column nulls the whole profile read. The codebase already chose this trade in dashboard/layout.tsx and documented it there.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-19T05:31:00+08:00",
    "outcome": "OPENED rather than waved through, because 'fails open' on an auth gate should never be a silent property. 0235 is applied — observed directly in this company's live profiles rows — so the branch is not currently reachable in production. It is pinned by a test that asserts the fallback runs, so a refactor that collapses it into one query fails loudly. Accepted with the reasoning attached rather than defended as obviously right." },

  { "id": "R3-the-two-accounts-this-task-created-are-now-gated-by-the-thing-it-shipped",
    "item": "Both Align accounts carry must_change_password, so with this deployed they must use the web app to set a password before the extension will serve them.",
    "why_skipped": "Clearing the flag for them would leave the generated temporary passwords live on their accounts indefinitely — precisely the condition F1 exists to end. The friction is one screen and they must pass it to use the dashboard regardless.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-19T05:32:00+08:00",
    "outcome": "OPENED and handed to the founder as an operational instruction — sign in on the web, set a password, then the extension — rather than engineered around. Worth recording because the founder asked for access urgently, and a fix that quietly adds a step to the very people the request was about is the kind of thing that should be said out loud, not discovered by a rep at a door." },

  { "id": "R4-the-extension-client-was-not-driven-against-a-deployed-build",
    "item": "The 403 and its machine-readable code are asserted by unit tests and by reading background.js's error forwarding. No browser was pointed at a deployed build to see what a rep actually sees.",
    "why_skipped": "The change was committed for an urgent access request; a real client run needs the deploy to land first.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-19T05:33:00+08:00",
    "outcome": "OPENED. Reading background.js confirms the client forwards a response's `error` string to its UI, so a rep does see the sentence naming /set-password even though nothing routes on `code` yet — the code is there for a client that wants to deep-link later, not for one that does today. What is genuinely unverified is the rendering: whether that message is legible in the extension's error surface or truncated. Recorded as unverified rather than folded into the tests that pass." },

  { "id": "R5-vite-tsconfig-paths-is-now-an-unused-dependency",
    "item": "The plugin is no longer referenced by vitest.config.ts but remains in package.json devDependencies.",
    "why_skipped": "Removing a dependency is a separate change with its own lockfile churn, and leaving it costs nothing at runtime.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-19T05:34:00+08:00",
    "outcome": "OPENED because it is top of the confidence-it-does-not-matter ranking, which is exactly where A36 says to read. Grepped: the only surviving references are package.json, package-lock.json and the .next/standalone copy — no config or source imports it, so the removal is safe whenever wanted. The one thing that would make this matter rather than not: leaving an unused resolver plugin installed means a future author debugging path resolution may find it, assume it is load-bearing, and reinstate it as a plugin — re-creating the exact breakage this build fixed. Left in place, but the reason it is harmless is now written down instead of assumed." }
]
```
