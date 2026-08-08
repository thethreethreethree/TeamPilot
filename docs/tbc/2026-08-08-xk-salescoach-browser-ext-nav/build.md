# BUILD — Sales Coach "Browser extension" nav entry

### sidebar nav entry (mirror C.A.R.E)
- **write-path:** `src/components/sales-coach/SalesCoachShell.tsx` — `Puzzle` import; `external?: boolean` added
  to the shell's `NavItem` type; the `{ label: "Browser extension", href: "/extension/download-sales", icon:
  Puzzle, external: true }` item inserted in NAV_SECTIONS before Settings; the render's active-computation and
  `<Link>` updated to honor `external` (`target="_blank" rel="noopener noreferrer"`, excluded from active).
- **read-path:** the Sales Coach left sidebar renders it for every logged-in Sales Coach user; clicking opens
  `/extension/download-sales` (the built download + install page) in a new tab.
- **what:** a persistent "Browser extension" sidebar item with the puzzle icon, matching C.A.R.E's
  `CareShell.tsx` SECONDARY_NAV entry. Desktop sidebar only — NOT added to the mobile tab bar (a browser
  extension is desktop-only; a mobile slot would mislead).
- **why:** founder request — surface the Sales Coach extension the SAME way C.A.R.E does (a nav item), which the
  first pass missed (delivered inline page cards instead).

### detection guard (A30 — gate the missed parity)
- **write-path:** `src/components/sales-coach/__tests__/salesCoachShellNav.test.ts` (new).
- **read-path:** `npm run test` (vitest) reads `SalesCoachShell.tsx` + `CareShell.tsx` as source and asserts the
  nav entry, its href, `external: true`, the new-tab render, and that C.A.R.E still carries the mirrored pattern.
- **what:** 3 source-substring tests (the shell is a client component, unrenderable in the node env — same
  posture as the extension-client guards). Fails CI if the nav entry is dropped, mispointed, or loses external.
- **why:** the parity was missed once; a gate prevents the next drop (A30).
