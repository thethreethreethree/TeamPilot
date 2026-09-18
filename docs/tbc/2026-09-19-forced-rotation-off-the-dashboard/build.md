# BUILD — a shared password nobody is forced to rotate is not temporary

### Enforce the forced rotation where the extension actually enters

- write-path: `src/lib/api/extensionAuth.ts` — `requireExtensionAuth` returns 403 with
  `code: "must_change_password"` when the flag is set. Placed at the single authority every
  extension route funnels through: `grep` for direct callers of `requireExtensionAuth` outside the
  module returns none, so gating it here gates `suggest`, `dissect`, `extract`, `refresh` and the
  C.A.R.E tools at once, instead of six copies that drift (§2.2).
- write-path: the profile read selects `company_id, status, must_change_password` and falls back to
  the original two columns when that yields nothing. A missing column errors the whole query and
  returns a null profile, which the next line reads as "no company" — the tidy one-query version
  would 403 every extension user on any environment where 0235 is unapplied. The fallback keeps the
  fast path at one query and makes the failure mode "gate inactive" rather than "everyone locked
  out", matching the separate best-effort read `dashboard/layout.tsx` already uses.
- write-path: ordering is deliberate — a `removed` account is still rejected first, so a deactivated
  user is never told to go set a password.
- read-path: a rep holding the shared team password is stopped at the extension and told where to
  finish. `code` is machine-readable so the client can route to `/set-password` rather than surface
  a bare string; `background.js` already forwards `error` to its UI, so the message lands either way.
- read-path: a rep who has rotated is untouched — the flag is false and the gate returns through.

### Capture a name when the member is created, instead of inventing one from their email

- write-path: `src/app/api/team/add-member/route.ts` — optional `fullName` on the `new` variant,
  passed as `user_metadata.full_name` so `handle_new_user`'s coalesce prefers it, and repeated in
  the profiles upsert, which is the authority. The two cannot disagree because both come from the
  same trimmed value.
- write-path: the key is omitted entirely when blank. Writing `null` would overwrite the trigger's
  placeholder and render the roster row nameless — worse than the ugly name it replaces.
- read-path: an admin using "Add agent" sees a **Full name** field
  (`src/components/team/AddAgentDialog.tsx`), shown only on the `new` path — an existing user
  already has a name this must not clobber.
- read-path: omitting the field reproduces the previous behaviour exactly, so nothing that calls
  this route today changes.

### Make the test suite run the tests it claims to run

- write-path: `vitest.config.ts` — native `resolve.tsconfigPaths` replaces the
  `vite-tsconfig-paths` plugin, which had stopped resolving `@/` for modules Vitest 4 externalises
  for SSR. Vite's own deprecation notice recommends this option by name.
- read-path: `npm test` goes from 294 files / 2110 tests to 646 files / 4336 tests. Every one of the
  2222 tests that had stopped running passes, so this recovered coverage rather than papering over
  failures.
- read-path: the comment in the file records the measured exit code of the old configuration (1),
  not the "nothing was failing" story that was tempting and false.

### The gate (A30)

- write-path: `src/lib/api/__tests__/extensionAuth.test.ts` — four tests: flag set → 403 carrying
  the `code` and a message naming `/set-password`; flag false → passes; `removed` still rejected
  first even while the flag is set; and column-absent → falls back, asserting `call === 2` so the
  retry is proven to have run rather than assumed.
- read-path: three mutations each fail a named test — deleting the check, inverting the flag
  comparison, and collapsing the fallback into a single select. The false branch is tested on
  purpose: an exemption-shaped term is exactly what gets dropped in a copy and silently defeats a
  gate, which is the failure §2.2 was written for.
