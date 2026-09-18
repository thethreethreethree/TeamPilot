# BUILD — the admin could see the locked-out rep and do nothing about it

### Generate a temporary password that is readable down a phone line

- write-path: `src/lib/auth/tempPassword.ts` — `generateTempPassword(length = 14)`. One of each required
  character class is *placed*, then the whole string is Fisher-Yates shuffled over `crypto.randomInt`, so the
  classes are not pinned to fixed positions the way a naive "upper + lower + digit + special + filler" builder
  leaves them.
- write-path: ambiguous glyphs are removed from every alphabet — no `O`/`0`, no `I`/`l`/`1`. Not cosmetic: the
  delivery channel is a human reading this aloud or retyping it from a text message, and a glyph collision
  produces the second support call this whole feature exists to prevent.
- write-path: the function asserts its own output against the SHARED `isStrongPassword` before returning. This
  is the A33 chokepoint — every temp password in the product passes through this one function, so "temp
  passwords satisfy the policy" holds by construction rather than by inspecting call sites. If an alphabet is
  ever edited such that a class is lost, it throws here instead of minting a login nobody can use.
- read-path: the admin reads a 14-character string off the screen and gives it to their teammate.

### Let an admin reset a non-admin teammate's password

- write-path: `src/app/api/team/reset-password/route.ts` — admin-only, service-role (`auth.admin` plus the
  guarded `must_change_password` column), company-pinned exactly as `set-role` does it: a profile row scoped to
  the caller's `company_id` IS the gate, so an admin can never reach another tenant's member.
- write-path: four refusals, each for its own reason — self (400, Settings is the path that proves you know the
  old password), another tenant (404), a `removed` member (409, a reset must not re-admit someone through a side
  door), and an admin target (403, because admin is already the top of this product's authority and the only
  thing left to escalate to is somebody else's account).
- write-path: rate limit 10/min, tighter than `set-role`'s 40, because each call rotates a real credential and a
  loose limit is a way to churn a colleague's password repeatedly.
- write-path: the partial-failure path returns the password WITH the 500 when the `must_change_password` write
  fails. The credential has already changed at that point; a clean error would send the admin to retry while
  their teammate is locked out holding nothing.
- read-path: the response carries the password exactly once. Nothing stores it in plaintext.

### Put the action where the admin is already looking

- write-path: `src/app/dashboard/team/page.tsx` — a key button on each member row, rendered only when
  `amAdmin && !isAdminRole(member.role)`. That one condition hides admin targets and, because an admin's own row
  is an admin row, the caller's own row too — matching the route's refusals rather than restating them.
- write-path: a modal, not a toast. A credential that auto-dismisses after four seconds is a credential the
  admin has to ask for again. It carries a `select-all` code block, a copy button with a tick on success, and an
  explicit "shown once" warning.
- write-path: the clipboard write has a rejection handler. `navigator.clipboard` fails on an insecure origin or
  a denied permission, and a silent no-op would leave the admin pasting whatever was on their clipboard before.
- read-path: the confirm dialog says the current password stops working immediately, so the admin does not
  discover that by locking someone out mid-shift.
- read-path: when the rotation could not be forced, the panel shows an amber note and tells the admin to ask the
  member to change it themselves — the honest version of the partial failure, rather than a success-coloured panel
  over a half-completed operation.

### The gate (A30)

- write-path: `src/app/api/team/reset-password/__tests__/route.test.ts` (11) — every refusal, and for each one
  an assertion that `updateUserById` was NOT called. A refusal that still rotated the password would be a denial
  with the damage already done, and a status-code-only test would not see it.
- write-path: the happy path asserts the password reaching `auth` is the SAME string handed to the admin. A
  mismatch there is a reset that "succeeds" while locking the member out permanently.
- write-path: `src/lib/auth/__tests__/tempPassword.test.ts` (6) — 500 iterations against the shared policy, 500
  against the ambiguous-glyph rule, position spread for the shuffle, the length floor, and uniqueness.
- read-path: assertions run against `validateStrongPassword` itself, never a regex copied into the test, so the
  generator cannot drift away from the two screens that accept a password.
