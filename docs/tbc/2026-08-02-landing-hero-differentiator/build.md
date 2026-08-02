# BUILD — Elostate landing rebuild: hero + differentiator (preview route)

## Doc integrity (§0.1)
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```

## Change

### Landing infrastructure (tokens, font, reveal)
`src/components/landing/brand.ts`, `sora.ts`, `Reveal.tsx` + `Reveal.module.css`.

- **write-path:** `brand.ts` exports the matte-black/signal-yellow tokens + CTA config; `sora.ts` self-hosts
  Sora via next/font; `Reveal` writes an `armed` class on mount (client) then an `in` class when it scrolls
  into view (IntersectionObserver), driving a CSS opacity/transform transition.
- **read-path:** every section imports the tokens/font/Reveal; `Reveal` reads `prefers-reduced-motion` and the
  IntersectionObserver entry. Content ships visible (SSR), so a no-JS/reduced-motion visitor reads the full page.

### Hero + Bulb (the mark)
`src/components/landing/Hero.tsx` + `Hero.module.css`, `Bulb.tsx` + `Bulb.module.css`.

- **write-path:** the hero renders the bulb mark, headline "Don't just manage your team. / Make it think.",
  subhead, and the "Request access" + "See it work" CTAs; entry is a pure-CSS staggered rise + underline sweep;
  a client effect writes the cursor-tracked glow position. `Bulb` is pure SVG + CSS (filament draw + pulse).
- **read-path:** the hero reads `CTA` (hrefs → /redeem, /login) and pointer position; "See it work" targets
  `#differentiator`. No data fetch — it's a static marketing surface.

### Differentiator (the showpiece)
`src/components/landing/Differentiator.tsx` + `Differentiator.module.css`.

- **write-path:** renders a surface symptom card (red), a causal trace of glowing signal nodes, and a lit
  root-cause card — each wrapped in `Reveal` so they surface sequentially on scroll. Shows the engine finding
  the *why*, not just the *what*.
- **read-path:** static content; the only dynamic input is scroll position via `Reveal`'s IntersectionObserver.

### Preview route + dependency
`src/app/landing-preview/page.tsx` (new, noindex) assembles Hero + Differentiator under the self-hosted Sora
wrapper; `package.json` + `package-lock.json` add `framer-motion` (kept for future rich interactions).

- **write-path:** the preview page composes the sections; live `src/app/page.tsx` is unchanged.
- **read-path:** visiting `/landing-preview` renders the sections; nothing reads app/user state.

## Files
- `src/components/landing/{brand.ts,sora.ts,Reveal.tsx,Reveal.module.css,Bulb.tsx,Bulb.module.css,Hero.tsx,Hero.module.css,Differentiator.tsx,Differentiator.module.css}`
- `src/app/landing-preview/page.tsx`
- `package.json`, `package-lock.json` (framer-motion)
