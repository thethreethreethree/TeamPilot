# BUILD — Elostate landing go-live (homepage swap + a11y/mobile polish)

## Doc integrity (§0.1)
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```

## Change

### Homepage swap with auth routing
`src/app/page.tsx` (now a SERVER component) + `src/components/landing/LandingPage.tsx` (new).

- **write-path:** `page.tsx` redirects a signed-in user to `resolveUserLanding(...)` (their module home) and, for
  a signed-out visitor, renders `<LandingPage/>`. `LandingPage` composes the 9 sections under self-hosted Sora
  with `overflow-x: hidden`. The old 600-line client marketing page is replaced (its content lives in git
  history). No new auth path — CTAs still point at /redeem, /login.
- **read-path:** `page.tsx` reads the Supabase user + `profiles.company_id`, then `resolveUserLanding` reads
  `companies.access_module` (RLS-bound) to pick the destination — the same signal the middleware confines on.

### Preview route dedup
`src/app/landing-preview/page.tsx` now renders `<LandingPage/>` (noindex) — one source for `/` and the preview.

- **write-path:** renders the shared component; nothing new written.
- **read-path:** none beyond rendering; kept so the team can view the marketing page while signed in.

### Accessibility + mobile polish
`src/components/landing/{Hero,Close,Footer,Proof,Problem,Turn,HowItWorks,Modules,Differentiator}.module.css`,
`Modules.tsx`.

- **write-path:** added `:focus-visible` outlines to interactive elements; raised low-contrast muted text to
  WCAG-AA; `overflow-x: hidden` on every section + `overflow-wrap: break-word` on every heading + mobile heading
  clamps; `aria-hidden` on decorative module icons.
- **read-path:** these are presentational rules read by the browser; `:focus-visible` reads the keyboard-focus
  state; the reduced-motion media query still reads `prefers-reduced-motion`.

## Files
- `src/app/page.tsx`, `src/app/landing-preview/page.tsx`, `src/components/landing/LandingPage.tsx`
- `src/components/landing/*.module.css` (9 sections), `src/components/landing/Modules.tsx`
