# CHECK — schedule deferred LOW fixes

## Gate — the canonical command (A38)
```
$ npm run check     # tsc --noEmit && eslint && theme:audit && rls:audit && invariant:audit && tbc && test
> typecheck / lint / theme:audit / rls:audit / invariant:audit — pass
> tbc:docs / tbc:manifest / tbc:artifacts / tbc:residual / tbc:freshness — pass
> test            Test Files  591 passed | 1 skipped (592)
                  Tests  3865 passed | 15 skipped (3880)
GATE_EXIT=0
```

## What this covers (pure seams gated)
- **uploadLimits** — `oversizeMessage` returns null under / a clear MB message over the limit; the base64 cap is
  TRUTHFUL (admits a max-size file's base64 yet keeps the body under the ~4.5 MB request limit).
- **pdfText** — José→Jose, 李伟→??, PDF metacharacters still escaped, ASCII untouched.
- **xlsxSheetToCells** — a far-right cell ref (`XFD1`) stays bounded (≤ 257), not ~16384.

## Not unit-gated (bounded honestly)
- The printed-schedule "⚠ N have no one assigned" footer (canvas render — jsdom has no 2D context; the underlying
  `emptyShiftsThisWeek` count is already tested in gridView).
- The events/coverage GET rate-limits (a one-line `rateLimit` mirroring the sibling POSTs / 27 other routes).

## Findings
No findings — each change executes a confirmed audit finding the founder greenlit; every pure seam is locked.
