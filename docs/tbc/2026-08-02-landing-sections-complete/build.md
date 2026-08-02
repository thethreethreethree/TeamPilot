# BUILD — Elostate landing: remaining sections (Problem → Footer)

## Doc integrity (§0.1)
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```

## Change

### Narrative sections (Problem, Turn, How-it-works, Modules)
`Problem.tsx/.css`, `Turn.tsx/.css`, `HowItWorks.tsx/.css`, `Modules.tsx/.css`.

- **write-path:** each renders static, on-brand marketing content wrapped in `Reveal` for scroll-in; Modules
  cards ignite an accent line on hover (CSS). No data mutation.
- **read-path:** they read only scroll position via `Reveal`'s IntersectionObserver; Modules has `id="modules"`
  (the nav "Product" anchor). Content is present in SSR, so no-JS visitors read the full arc.

### Proof (honest social proof) + CountUp
`Proof.tsx/.css`, `CountUp.tsx`.

- **write-path:** Proof renders the honesty-thesis heading, three honest STRUCTURAL stat tiles (via `CountUp`),
  and clearly-labelled placeholder testimonial cards. `CountUp` writes its display value from 0→final on
  scroll-in.
- **read-path:** `CountUp` reads its `value` prop and IntersectionObserver; it renders the FINAL value in SSR so
  a no-JS/reduced-motion reader sees the real number (4 / 2 / 100%). Testimonials read as visible placeholders.

### Close + Footer
`Close.tsx/.css`, `Footer.tsx/.css`.

- **write-path:** Close renders the final restated outcome + one big Request-access CTA + a risk-removal line;
  Footer renders brand, tagline, link columns, copyright, and a trailing CTA.
- **read-path:** both read `CTA` (hrefs → /redeem, /login); Footer links preserve the app's real routes
  (/privacy, /terms, /help, /pitch). No data fetch.

### Assembly
`src/app/landing-preview/page.tsx` now renders the full arc: Hero → Problem → Turn → How-it-works → Modules →
Differentiator → Proof → Close → Footer. Live `src/app/page.tsx` unchanged.

## Files
- `src/components/landing/{Problem,Turn,HowItWorks,Modules,Proof,Close,Footer}.{tsx,module.css}`, `CountUp.tsx`
- `src/app/landing-preview/page.tsx`
