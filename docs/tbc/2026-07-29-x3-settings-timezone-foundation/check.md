# CHECK — Settings Slice 3 (Timezone foundation) audit

Audited: the new datetime/format module, its test, and the Settings "Last saved" wire.

## Within-module pass (four layers)

- **1 structure:** one pure module, no deps; mirrors the finance/format.ts shared-formatter precedent.
- **2 effectivity:** tsc exit 0; format test 8/8 including the load-bearing "different zones render
  differently" assertion. Full `npm run check` output + exit in closure.md.
- **3 composition:** the Settings "Last saved" stamp is the first consumer; the util is reusable by the
  ~12 other ad-hoc display sites as they adopt it. Only that one display changed.
- **4 surface:** the stamp now shows the company's local time rather than a raw UTC slice.

## Cross-module pass

The util is pure and client/server-safe (Intl only). No DB, no auth, no schema change — zero blast radius
beyond the one display it is wired into. A bad `companies.timezone` value degrades to local time (caught
RangeError), so it cannot crash any page that adopts it.

## Class sweep (A26 — the dead-surface class this addresses)

- **class:** a stored value with no consumer (companies.timezone). sweep: this slice adds the FIRST
  consumer; the per-user override is deliberately deferred until consumption is broader, so it does not
  reproduce the class. The remaining ~12 ad-hoc `toLocaleString`/`.slice` sites are NOT converted in this
  slice (a broad refactor left for a focused increment, not rushed) — recorded as a residual, not silently
  skipped.

## Findings

No findings. Additive pure util + one consumer; tsc-clean; unit-pinned. (remediate.md omitted.)

## Inspected / not-inspected

- **Inspected:** the format module (both functions), the test, the Settings wire, tsc.
- **NOT inspected (→ residual):** the ~12 other timestamp displays (broad adoption deferred); the per-user
  `profiles.timezone` override column (deferred until consumption is broader, so it is not dead surface).
