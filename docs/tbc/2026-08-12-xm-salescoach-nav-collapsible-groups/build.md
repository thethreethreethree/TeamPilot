# BUILD — collapsible Manager Dashboard + Team Tools groups

## Feature inventory

### Collapsible "Manager Dashboard" + "Team Tools" sidebar groups (`src/components/sales-coach/SalesCoachShell.tsx`)
- write-path: no DB persistence (intentional — mirrors CareShell's non-persisted `toolsOpen`). The "write" is
  component state: each collapsible group header is a `<button onClick={() => setOpenGroups(m => ({...m,
  [header]: !(m[header] ?? false)}))} aria-expanded={open}>`, toggling that group's entry in the `openGroups`
  Record. State initializes OPEN for every collapsible group; an `activeGroupHeader` effect writes the active
  group back to open on navigation into it (so a collapse can never strand the user — AMD-006 L3).
- read-path: `SalesCoachShell` reads `openGroups[header]` + `pathname` to render each section — a collapsible
  section shows its items (under an `ml-2 border-l pl-2` rule) only when open, with the header brighter when the
  active route is inside it; ungrouped sections render flat. `filterManagerNavSections(NAV_SECTIONS, isManager)`
  reads the viewer's role to drop manager-only items (Coach Assessment, Team) and any group left empty.
  Reachable on every `/dashboard/sales-coach/*` route via the product layout; structure/order/gating/affordance
  locked by `salesCoachShellNav.test.ts` (9/9).

## Files changed
- **src/components/sales-coach/SalesCoachShell.tsx**
  - Imports: added `useEffect` (React) and `ChevronDown` (lucide).
  - `NavSection` type: added optional `collapsible?: boolean`.
  - `NAV_SECTIONS`: restructured from one flat headerless section into four —
    1. ungrouped: `Home`
    2. `collapsible` "Manager Dashboard": Coach Assessment (managerOnly), Analytics, Sessions
    3. `collapsible` "Team Tools": Roleplay, One Liners, Team (managerOnly)
    4. ungrouped: Team Chat, KPI Analytics, Browser extension (external), Settings
    Item hrefs/icons/gating are byte-identical to the pre-change flat list — only grouping changed.
  - Extracted `isNavItemActive(item, pathname)` to module scope (was inline in the render) and reused it in
    both the section render and the active-group computation — one source of active-state truth.
  - Added `openGroups` state (`Record<header, boolean>`), initialized OPEN for every collapsible group, plus an
    `activeGroupHeader` derivation + `useEffect` that re-opens the active group on navigation into it.
  - Render: a `collapsible` section now renders its header as a toggle `<button aria-expanded>` with a
    Chevron (Down when open, Right when closed) and shows its items under an `ml-2 … border-l pl-2` left rule
    only when open. Ungrouped sections render flat, exactly as before. The header reads brighter
    (`text-white/90`) when the active route is inside a collapsed group (Layer-3 "you are here" signal).

## What did NOT change (holistic — §1.5.1)
- **MOBILE_TABS** untouched — the mobile PWA bottom-tab bar is a separate 5-tab surface; the founder's mockup
  is the desktop sidebar. Mobile behavior is unaffected.
- **filterManagerNavSections / filterManagerNav** (src/lib/nav/managerNav.ts) unchanged — reused as-is; it
  spreads `...s` so the new `collapsible`/`header` fields pass through the manager filter intact.
- **The "Back to ELOSTATE" footer, collapse-whole-sidebar chevron, Learning-Mode FAB, nav progress bar** — all
  unchanged.
- **Browser-extension nav entry** — same `label`/`href`/`external:true`, now in the bottom ungrouped section;
  the parity test (salesCoachShellNav.test.ts) still holds.

## Mirror source (A28)
CareShell.tsx "C.A.R.E Tools" expander (button + `aria-expanded` + ChevronDown/Right + `border-l` nested items
+ auto-expand-active `useEffect` on a persistent layout). Same shape, applied to two groups instead of one.
