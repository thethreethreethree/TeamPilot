# BUILD - INVARIANT 26, the Bearer/cookie-client guard

### The invariant
- write-path: `scripts/invariant-audit.mjs` - INVARIANT 26 builds an import graph over
  every scanned file, marks routes matching
  `callerScopedDb|resolveApiAuth|resolveApiUserId|guardExtensionRequest|requireEntitledExtensionUser`
  as Bearer-accepting, and reports any that TRANSITIVELY reaches a `src/lib/**`
  module containing `await createClient()`.
- read-path: whoever adds the fifth instance of this class is told at `npm run check`
  which route reaches which library, with the fix named - instead of a rep finding it.

### Two allowlists, and the difference between them matters
- write-path: `COOKIE_BY_DESIGN` holds the three modules that ARE the cookie path -
  `resolveApiAuth` (the dual path), `auth-helpers` (its first branch), and
  `careAgentAuth` (cookie-only, serving the web dashboard). `INV26_ALLOWLIST` holds
  modules whose cookie use a Bearer caller cannot reach, each with the reason and the
  test that gates it.
- read-path: an exclusion is readable as a claim someone made, not as silence.

### careAgentAuth is deliberately NOT a Bearer mechanism
- write-path: the regex omits it, and a self-test asserts the omission by name.
- read-path: the first hand-run of this analysis counted it and marked 37 web routes
  at-risk. Encoding the omission means that specific wrong answer cannot recur.

### The self-tests (A38)
- write-path: ten `st(...)` assertions - the Bearer regex in both directions, the
  cookie regex in both directions, the module resolver on `@/`, relative and package
  specifiers, and a synthetic route -> helper -> leaf graph proving reachability is
  TRANSITIVE rather than one hop.
- read-path: a future edit that breaks the matcher fails the audit by name, rather
  than silently reporting 0 violations forever - which is the failure the audit's own
  self-test block exists to prevent.

## Files
- `scripts/invariant-audit.mjs`

## Ripple (SS1.5)
- The audit reports 0 violations on the current tree, so nothing else must change to
  land this. Verified by running it.
- The summary line gained one clause, so the report names the new protection.
- No product code is touched by this build.
