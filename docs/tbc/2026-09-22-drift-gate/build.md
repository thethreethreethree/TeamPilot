# BUILD — two is better than forty-eight and it is still two

## What was built

An extension to `enum:audit`, not a new audit. One more source kind, sharing the existing walker,
member extraction, comparison and report.

### A function's value list as a source

- **write-path:** `scripts/enum-coverage-audit.mjs` — the migration loop now also matches
  `create [or replace] function NAME() … as $tag$ … array[…] … $tag$` and stores the values under
  the key `name()`.
- **read-path:** the same `findings` comparison every CHECK-set mirror goes through. Nothing
  downstream of the parse knows there are two kinds.

Parsed from the **non-lowercased** text, deliberately. The CHECK half lowercases because those
values are lowercase by convention here; role names are not. Lowercasing would make every
comparison fail, and the obvious repair — lowercase the mirror too — would then stop catching a
genuine case mismatch. Pinned by a test that asserts `ceo` vs `CEO` IS a finding.

**Bounded to the dollar-quoted body, and the first version was not.** See check.md — that version
attributed an array from a different statement in 0001 to `auth_company_id()`.

### The second marker

```ts
// sql-source: admin_roles()
export const ADMIN_ROLES = ["CEO", "CFO", "COO", "admin"] as const;
```

- **write-path:** `const FN_MARKER = /\/\/\s*sql-source:\s*([a-z0-9_]+)\(\s*\)/gi` and a second
  collection pass over the same files.
- **read-path:** `src/lib/roles.ts:45` is the first and currently only declaration.

A separate marker rather than one regex covering both forms. `enum-source:` claims *this union
mirrors a column's CHECK set*; `sql-source:` claims *this constant mirrors what a function
returns*. One pattern matching both has a failure mode of matching the wrong kind — which is the
failure this audit exists to prevent, one level up.

### A failure message that fits both shapes

- **write-path:** the closing `console.log` in `enum-coverage-audit.mjs` now prints two paragraphs
  — one for a CHECK value a union does not name, one for a `()` mirror out of step — each pointing
  at the build record of the incident it describes.
- **read-path:** whoever the gate stops. Exercised by the two mutation probes in check.md, whose
  pasted output is the message as it actually prints.

The existing closing text describes a union member falling through a switch. A role list out of
step is a different harm — authority the application grants and the database refuses — and a
message describing only the other case sends the reader looking in the wrong place.

## Ripple

- **`enum:audit`'s set count went 104 → 105.** One function source in 263 migrations:
  `admin_roles()`. The declared-mirror count went 8 → 9.
- **No migration, no data, no surface.** The audit reads the migration history and writes nothing.
- **`roles.ts` gains a comment and a marker.** `ADMIN_ROLES` itself is untouched — it has been
  correct since 2026-08-29; it was the database that disagreed.
- **The gate's first run is against 0265 as it stands**, which is the point. A gate whose first
  run is against a state it helped create proves nothing.
