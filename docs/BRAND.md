# ELOSTATE — Brand Identity (Lightbulb)

> Ratified 2026-06-12 as the governing visual identity. Replaces the prior
> "Iron Man" identity (crimson / gold / arc-cyan / navy) which is now
> archived. The new identity is governed by the logo asset at
> `IMMAGE ASSETS/ELOSTATE_LOGO.jpeg` — that file is the source of truth.

---

## 1. The mark

A continuous-stroke lightbulb containing a stylized lowercase **e**.

- The bulb is the metaphor: an idea forming.
- The **e** folded inside the bulb is the brand letter sitting where the
  filament would.
- The stroke is consistent weight (~6% of canvas) for legibility at
  every size from a 16px favicon to a 512px PWA install splash.
- Color: ember-400 (`#FACC15`).
- Background: transparent for inline use; matte-black (`#09090B`) for
  the PWA-maskable variant.

Canonical files:

- `public/icon.svg` — transparent background, inline use (sidebar, login, hero).
- `public/icon-maskable.svg` — matte-black background with 20% W3C safe-zone
  padding, for OS-level icon masks (circle, squircle, rounded square).
- `src/components/brand/Logo.tsx` — React wrapper. Use `<LightbulbMark />`
  for just the bulb, `<Logo variant="wordmark" />` for mark + ELOSTATE text,
  `<Logo showTagline />` to append the tagline.

---

## 2. The wordmark

**ELOSTATE** in Inter Black (weight 900), tracking `-0.01em`, white
(`#FAFAFA`) on dark surfaces, ink-900 (`#18181B`) on light surfaces.

Always use the `<Logo>` component or the inline pattern from `Logo.tsx`.
Do not re-implement a wordmark with a different weight or tracking — the
mark + wordmark are a unit.

---

## 3. The tagline

There is intentionally no canonical tagline at the moment.

A previous version of this document carried "Problem Solving System for
Teams" as the slogan, derived from text that appeared below the bulb in
an early version of the logo JPEG. The user has confirmed that is NOT
the canonical brand slogan. The slot is left empty here until the actual
slogan is provided.

Do not invent or default a slogan into the title, meta description,
sidebar, hero, footer, or any other surface. The brand name "ELOSTATE"
stands alone until further notice.

If you need product-descriptive prose for SEO meta tags, use a factual
statement about behavior (e.g. "ELOSTATE stays silent until it has
earned the right to speak") — not a slogan-shaped claim.

---

## 4. Palette

### 4.1 Brand: **ember** (the bulb)

| Token | Hex | Use |
| --- | --- | --- |
| ember-50  | `#FFFDF0` | Light-mode hover surface tint |
| ember-100 | `#FEF9C3` | Light-mode background accent |
| ember-200 | `#FEF08A` | Light tint, badge backgrounds |
| ember-300 | `#FDE047` | Success / "validated/held" semantic |
| ember-400 | `#FACC15` | **Brand primary — the bulb** |
| ember-500 | `#EAB308` | Primary hover / pressed |
| ember-600 | `#CA8A04` | Brand text in light mode |
| ember-700 | `#A16207` | Deeper accent |
| ember-800 | `#854D0E` | **Warning / error semantic — burnt amber, no red** |
| ember-900 | `#713F12` | Deepest amber, rare use |

### 4.2 Field: **ink** (the matte-black grayscale)

| Token | Hex | Use |
| --- | --- | --- |
| ink-50  | `#FAFAFA` | Light-mode base background / dark-mode text-primary |
| ink-100 | `#F4F4F5` | Light-mode surface-raised |
| ink-200 | `#E4E4E7` | Light-mode borders |
| ink-300 | `#D4D4D8` | Light-mode strong border |
| ink-400 | `#A1A1AA` | Text-secondary (dark mode) |
| ink-500 | `#71717A` | Text-muted (both modes) |
| ink-600 | `#52525B` | Mid-gray |
| ink-700 | `#3F3F46` | Dark-mode strong border / light-mode text-secondary |
| ink-800 | `#27272A` | Dark-mode borders / surface-raised |
| ink-900 | `#18181B` | Dark-mode surface / light-mode text-primary |
| ink-950 | `#09090B` | **Dark-mode base — matte black** |

### 4.3 What is NOT in the palette

- **No red.** Even error/danger uses ember-800 (burnt amber) so the
  palette stays mono-warm. This is intentional design governance,
  derived from the logo.
- **No cyan.** The prior arc-reactor cyan is gone.
- **No navy.** The prior surface scale is gone.
- **No bright neon yellow.** ember-400 is warm amber, not lemon yellow.

If a UI need seems to require a color outside ember/ink, the design
answer is "use ember-800 with an icon" before "introduce a new color".

---

## 5. Surface tokens (mode-switching)

The semantic surface utilities resolve via CSS variables in
`src/app/globals.css`. Use these — not raw hex — in any new component.

| Utility | Dark mode | Light mode |
| --- | --- | --- |
| `bg-base` | ink-950 | ink-50 |
| `bg-surface` | ink-900 | white |
| `bg-surface-raised` | ink-800 | ink-100 |
| `border-default` | ink-800 | ink-200 |
| `border-strong` | ink-700 | ink-300 |
| `text-primary` | ink-50 | ink-900 |
| `text-secondary` | ink-400 | ink-700 |
| `text-muted` | ink-500 | ink-500 |
| `text-brand` | ember-400 | ember-600 |

---

## 6. Signature treatments

### 6.1 Bulb glow

Radial ambient gradient behind the mark on hero surfaces.

```css
.bulb-glow {
  background: radial-gradient(
    circle at center,
    rgba(250, 204, 21, 0.30) 0%,
    rgba(250, 204, 21, 0.12) 35%,
    transparent 70%
  );
}
```

### 6.2 Bulb shadow

Three intensities of amber-only glow shadows:

| Class | Use |
| --- | --- |
| `shadow-glow-ember-soft` | Hovered chips, inline marks |
| `shadow-glow-ember` | Default — buttons, hero marks |
| `shadow-glow-ember-strong` | Splash screens, install prompts |

`shadow-glow` (legacy) is aliased to `shadow-glow-ember`.

### 6.3 Pulse dot

Live / AI-active indicator. Same animation as before, recolored:

```css
@keyframes pulse-dot {
  0%, 100% { opacity: 1; box-shadow: 0 0 8px rgba(250, 204, 21, 0.7); }
  50%      { opacity: 0.5; box-shadow: 0 0 4px rgba(250, 204, 21, 0.3); }
}
```

---

## 7. Brand-fill child contrast guard

Ember (`#FACC15`) is bright yellow. White text on it fails accessibility.
The CSS rule in `globals.css` automatically swaps `text-primary` children
inside ember backgrounds to `#09090B` (matte black) so semantic styling
"just works" without per-component overrides.

This means: **do not write `text-white` on an ember button.** Use
`text-primary` (which the rule rewrites) or the explicit `text-[#09090B]`
inline.

---

## 8. Where to use the logo

| Surface | Treatment |
| --- | --- |
| Landing header | `<LightbulbMark className="w-7 h-7" />` + wordmark |
| Landing hero | `<LightbulbMark className="w-20 h-20" />` + `bulb-glow` behind |
| Login page | `<LightbulbMark className="w-14 h-14" />` + wordmark + tagline |
| Sidebar | `<LightbulbMark className="w-9 h-9" />` + wordmark + `TAGLINE_SHORT` + live/demo dot |
| Pitch page | Hero treatment matches landing |
| PWA install prompt | `<LightbulbMark className="w-12 h-12" />` |
| Favicon | `/icon.svg` |
| PWA icons | `/icon.svg` + `/icon-maskable.svg` |
| Error / 404 pages | `<LightbulbMark className="w-16 h-16" />` |

When in doubt, drop the mark wherever a brand surface needs anchoring.
The bulb is the brand.

---

## 9. Theme-audit enforcement

`scripts/theme-audit.mjs` enforces palette discipline. Allowed brand
hexes are restricted to the ember + ink scales above. Any other hex
literal in a Tailwind utility is a leak that must either be swept to a
semantic token or explicitly allowlisted in the script with a stated
reason.

Run before committing: `npm run theme:audit`.

---

## 10. The prior identity

The "Iron Man" identity (crimson + gold + arc-cyan + navy) was the
foundation of the visual system from inception through 2026-06-11. It
was a strong identity, but it implied "powered armor / superhero" which
diverged from the actual product positioning ("Problem Solving System
for Teams"). The lightbulb identity collapses the visual language to
one warm, idea-anchored mark that matches what the System actually does:
help teams see the problem clearly.

The prior tokens (`crimson`, `arc`, `navy` as distinct scales) are gone.
Aliases (`gold` → `ember`, `navy` → `ink`) survive in `tailwind.config.ts`
so legacy class names don't break — but the visual result is mono-amber
regardless of which alias a component happens to use. The aliases will
be removed in a future cleanup once unused.

---

**The logo is the constitution of the visual identity. When in doubt,
look at `IMMAGE ASSETS/ELOSTATE_LOGO.jpeg` and ask whether the surface
you're building extends or contradicts it.**
