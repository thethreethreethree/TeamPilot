# BUILD — one mount, gated to the module that had none

### The toggle, in TopBar's right-hand group

- **write-path:** `{inSalesCoach && <ThemeToggle variant="compact" />}` in
  `src/components/layout/TopBar.tsx`, first child of the existing right-hand flex group, left of
  the date/time chip.
- **read-path:** two render tests — the control is present on a Sales Coach route and absent on
  `/dashboard/finance`, where the Sidebar already carries one.

No new theme state, no second provider, no restyle of the existing component. `ThemeProvider` is
mounted at the root `<body>` in `layout.tsx:144`, so the preference persists to localStorage AND
cross-device through `/api/me/theme` — a rep who picks light on their phone gets light on the
laptop, for free, because this is the app's own system rather than a local copy.

`compact` matches CareShell's header usage. The three-wide segmented pill belongs in settings, not
in a bar already carrying a title, a subtitle and a date.

### The existing tests, brought in line with production

- **write-path:** a `withTheme()` wrapper in `src/components/layout/__tests__/TopBar.render.test.tsx`.
- **read-path:** the suite itself, including the two tests that broke:

```
$ npx vitest run src/components/layout/__tests__/TopBar.render.test.tsx
      Tests  5 passed (5)
exit 0
```

`useTheme` throws outside its provider, deliberately, so a component reaching for the theme in the
wrong place fails at the call site instead of silently painting the wrong mode. That made `TopBar`
provider-dependent and killed two existing tests that rendered it bare.

**Wrapping them is not a workaround for that throw.** `ThemeProvider` wraps `{children}` at the root
`<body>`, so every page in the app already renders inside it — the same structural guarantee
`Sidebar` and `CareShell` rely on. Rendering `TopBar` bare was the thing that did not match
production; the throw is doing its job.

The tests also needed `fetch` and `matchMedia` stubs: the provider reads both on mount and jsdom has
neither, and an unmocked `matchMedia` throws.
