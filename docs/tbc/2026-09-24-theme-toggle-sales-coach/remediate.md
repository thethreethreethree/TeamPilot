# REMEDIATE

### A module shell that omits an app-wide control

gate-or-promise: declined

No gate, and not because it is hard — because "every shell offers every app-wide control" is not a
checkable property. There is no list of what counts as app-wide, and inventing one so a script has
something to compare against would be building a tracker to look thorough rather than to catch
anything.

Two render tests pin both directions instead: present inside Sales Coach, absent outside it where
the Sidebar already has one. That guards the regression, not the class.

**What is left open** is the real question this raised and did not answer: whether the theme control
is the ONLY thing `SalesCoachShell` is missing relative to the ELOSTATE Sidebar. Recorded in
check.md as an explicit assumption rather than a clean bill.

### TopBar became provider-dependent

gate-or-promise: gate

The gate is `useTheme`'s own throw, which already existed. A consumer that renders `TopBar` outside
`ThemeProvider` fails loudly at the call site rather than painting the wrong mode — and it proved
itself immediately by failing two tests that did exactly that.

The remaining exposure is that the failure takes the whole page rather than one button. That is
acceptable here and worth naming: `ThemeProvider` wraps `{children}` at the root `<body>`, so no
production render can be outside it without `layout.tsx` itself changing, and `Sidebar` and
`CareShell` already carry the same dependency.
