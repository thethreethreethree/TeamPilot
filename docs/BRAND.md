# ELOSTATE — Brand & Visual Identity

> **Inspiration source:** Iron Man (2008) Marvel Studios theatrical poster.
> **Established:** 2026-06-02
>
> This document is the canonical source of truth for ELOSTATE's visual identity.
> Designers, engineers, and copywriters should treat this as the spec — any
> deviation is a decision that should be defended in writing.

The visual identity borrows the Iron Man aesthetic deliberately: a system that
projects **structural confidence** (the armor), **earned intelligence** (the
arc reactor), and **considered heroism** (the gold) on a backdrop of
**operational seriousness** (the deep navy). The metaphor maps to the product:
the discipline is the suit, the per-company brain is the arc reactor, the
hard-won outcomes are the gold.

This is not Marvel fan art. We borrow the *visual grammar* — crimson, gold,
arc-reactor cyan, deep navy — and let the product's own personality grow on
top.

---

## 1. Color system

The palette is organized in three tiers: **brand** (identity carriers),
**semantic** (meaning carriers), and **neutral** (surface carriers). Every UI
color choice maps to one of these.

### 1.1 Brand colors — the Iron Man triad

#### Iron Man Crimson — `crimson`
The suit. Used for primary actions, brand identity, the most important
interactive element on every screen.

| Token | Hex | Role |
|---|---|---|
| `crimson.50`  | `#FFF1F2` | Lightest tint (rare; toast backgrounds) |
| `crimson.100` | `#FFE3E5` | Subtle hover backgrounds |
| `crimson.200` | `#FFB8BD` | Soft tint |
| `crimson.300` | `#FF8A92` | Light interactive |
| `crimson.400` | `#F75663` | Hover-bright |
| **`crimson.500`** | **`#C8232C`** | **Primary brand — the suit red** |
| `crimson.600` | `#A91D24` | Primary hover / active state |
| `crimson.700` | `#8A1820` | Pressed state |
| `crimson.800` | `#6B131A` | Dark accent |
| `crimson.900` | `#4D0E14` | Deepest crimson |

#### Iron Man Gold — `gold`
The helmet, the title text, the metallic highlights. Used for **success
states, validated outcomes, premium emphasis**. In the product, gold is the
color of *something that held*.

| Token | Hex | Role |
|---|---|---|
| `gold.50`  | `#FEF8E7` | Soft success tint |
| `gold.100` | `#FDEEC4` | Subtle hover |
| `gold.200` | `#FADD89` | Soft tint |
| `gold.300` | `#F2C94C` | Bright highlight |
| **`gold.400`** | **`#E8B53A`** | **Primary gold (held outcomes, validated)** |
| `gold.500` | `#D4A024` | Gold hover |
| `gold.600` | `#A6801C` | Darker gold |
| `gold.700` | `#785C14` | Deep gold |
| `gold.800` | `#4B380D` | Dark accent |
| `gold.900` | `#2C2008` | Deepest gold |

#### Arc Reactor Cyan — `arc`
The chest reactor, the eye glow. Used for **AI activity, active processing,
informational status, "the System is thinking."** Whenever the AI is doing
something live, this is the color.

| Token | Hex | Role |
|---|---|---|
| `arc.50`  | `#ECFBFE` | Lightest cyan |
| `arc.100` | `#D0F4FA` | Soft cyan tint |
| `arc.200` | `#A8E6F0` | Reactor core glow inner |
| `arc.300` | `#7DDCE8` | Bright cyan highlight |
| **`arc.400`** | **`#5EC8E0`** | **Primary cyan — AI active / energy** |
| `arc.500` | `#3FB1CC` | Cyan hover |
| `arc.600` | `#2A8FA8` | Darker cyan |
| `arc.700` | `#1F6B7E` | Deep cyan |
| `arc.800` | `#144654` | Dark accent |
| `arc.900` | `#0A222A` | Deepest cyan |

### 1.2 Neutral colors — the navy field

The dark backdrop in the Iron Man poster — a deep, slightly cool navy with the
subtle suggestion of technical schematics behind it. This is our base surface.

| Token | Hex | Role |
|---|---|---|
| `navy.50`  | `#E3E8F0` | Lightest navy (rarely used) |
| `navy.100` | `#C7D1E3` | High-contrast text on dark |
| `navy.200` | `#94A3BF` | **Body text on dark** |
| `navy.300` | `#5F7290` | Muted text |
| `navy.400` | `#3C4D6A` | Deeper muted / disabled |
| `navy.500` | `#2D446C` | Border hover |
| **`navy.600`** | **`#1F3050`** | **Border default** |
| `navy.700` | `#152339` | Card raised / hover surface |
| **`navy.800`** | **`#0D1B2D`** | **Card surface (glass-card)** |
| **`navy.900`** | **`#0A1429`** | **Primary background (the field)** |

### 1.3 Semantic colors — meaning carriers

These extend the brand triad with specialized purpose colors. **Use these
sparingly** — most UI should stay in the brand-and-neutral palette.

| Token | Hex | Meaning |
|---|---|---|
| `success` | `#E8B53A` | Held outcome (uses brand gold) |
| `warning` | `#FF9F1C` | Caution / amber |
| `error` | `#E63946` | Failure / rejected (distinct from brand crimson) |
| `info` | `#5EC8E0` | Informational / AI-active (uses brand cyan) |

> **Critical:** `success` is gold, not the conventional emerald. This is a
> deliberate brand choice — in ELOSTATE, success means *something that held*,
> which is the brand promise. Generic green here would be a brand violation.

### 1.4 Color usage rules

1. **Crimson** appears on at most **one** element per surface — the primary
   action. Multiple crimson buttons on the same screen dilute the brand.
2. **Gold** marks things the system has *earned* — held outcomes, validated
   methods, status badges for things that succeeded. Never use gold for
   "premium" decoration without earned meaning.
3. **Cyan** is the AI-active color. Pulse-dot, streaming text indicator,
   "thinking…" states, brain-related UI. Off when the AI is silent (§3.4).
4. **Navy** is the field. Backgrounds, surfaces, borders, body text — most
   pixels on most screens.
5. **Never combine bright crimson, bright gold, and bright cyan in the same
   small region.** That's the Iron Man title card visual — overwhelming for
   utility UI. Save it for hero moments only (landing page, pitch deck).

---

## 2. Glow & metallic effects

A signature element of the Iron Man poster is the **light emission**: the arc
reactor glows, the eyes glow, the gold has specular highlights. We translate
this to UI as:

### 2.1 Glow shadows

```css
/* Crimson glow — for primary CTAs */
box-shadow: 0 0 24px rgba(200, 35, 44, 0.35);

/* Gold glow — for "earned" badges */
box-shadow: 0 0 20px rgba(232, 181, 58, 0.30);

/* Arc reactor glow — for AI-active elements */
box-shadow: 0 0 28px rgba(94, 200, 224, 0.40);
```

### 2.2 Metallic gradients

Used for **logo treatments and hero buttons only** — never on routine UI.

```css
/* Gold metallic — title text, premium badges */
background: linear-gradient(135deg, #F2C94C 0%, #E8B53A 45%, #A6801C 100%);

/* Crimson metallic — hero CTA */
background: linear-gradient(135deg, #F75663 0%, #C8232C 60%, #8A1820 100%);

/* Reactor core — AI-active indicator */
background: radial-gradient(circle, #FFFFFF 0%, #A8E6F0 30%, #5EC8E0 60%, #1F6B7E 100%);
```

### 2.3 Border treatments

- Default: 1px solid `navy.600` (#1F3050)
- Hover: 1px solid `navy.500` (#2D446C)
- Active (focus): 1px solid `crimson.500` + ring `crimson.500/30`
- AI-active surfaces: 1px solid `arc.400` (#5EC8E0)
- Earned/held: 1px solid `gold.400` (#E8B53A)

---

## 3. Typography

### 3.1 Font stack

| Role | Font | Fallback | Weights |
|---|---|---|---|
| **Display** | Inter | system-ui, sans-serif | 800–900 (Black) |
| **Headings** | Inter | system-ui, sans-serif | 700 (Bold) |
| **Body** | Inter | system-ui, sans-serif | 400, 500 |
| **Numerals / data** | Geist Mono | "Fira Code", monospace | 400, 600 |
| **Captions / category labels** | Inter | system-ui, sans-serif | 500, uppercase tracking |

We keep **Inter** as the primary face because it pairs cleanly with the dark
field and remains readable at small UI sizes. The Iron Man title's slab-style
heroism is borrowed via **weight and tracking discipline**, not by switching
to a display face.

### 3.2 Type scale & treatment

| Use | Size | Weight | Tracking | Notes |
|---|---|---|---|---|
| Hero | 48–56px | 800 (Black) | -0.02em (tight) | Reserved for landing/pitch covers |
| H1 page title | 28–32px | 700 (Bold) | -0.01em | TopBar titles, section heroes |
| H2 section | 22–24px | 700 | -0.01em | Card group headers |
| H3 card | 14–16px | 600 (Semibold) | normal | Individual card titles |
| Body | 14px | 400 (Regular) | normal, 1.5 leading | Default paragraph |
| Body small | 12px | 400 | normal | Helper text |
| Caption | 10px | 500 (Medium) | 0.15em (widest) | All-caps category labels |
| Numerals | 14–24px | 600 | tabular-nums | Stats, version numbers, counts |

### 3.3 Tracking discipline (the Iron Man "title" feel)

To borrow the IRONMAN title's tight monumental quality without switching
fonts, we apply **negative tracking on large headings** and **wide tracking
on small captions**:

- Display & H1 → `tracking-tight` (-0.02em to -0.01em)
- Caption (all-caps) → `tracking-widest` (0.15em or higher)

This produces the same "compressed-headline, spaced-eyebrow" rhythm without
adding a font dependency.

---

## 4. Iconography

- **Library:** lucide-react (already in use)
- **Stroke weight:** 2 (default) — matches the Iron Man poster's clean line
  weight rather than the heavier marvel-comics line
- **Size:** 14px / 16px / 18px for inline UI; 20–24px for section markers
- **Color rule:** icons inherit text color by default. Only colorize icons
  when they carry brand meaning (crimson for primary action, gold for
  earned status, cyan for AI-active, etc.).

---

## 5. Layout & spacing

| Token | Value | Role |
|---|---|---|
| `xs` | 4px | Tight gaps between related items |
| `sm` | 8px | Default form spacing |
| `md` | 16px | Card internal padding |
| `lg` | 24px | Section spacing |
| `xl` | 40px | Major section breaks |
| `2xl` | 64px | Hero / pitch slide padding |

**Border radius scale:**

| Token | Value | Role |
|---|---|---|
| `radius-sm` | 6px | Small chips, badges |
| `radius-md` | 8px | Inputs, buttons |
| `radius-lg` | 12px | Cards |
| `radius-xl` | 16px | Modals |
| `radius-pill` | 9999px | Pills, toggles |

---

## 6. Motion

Per the existing `prefers-reduced-motion` policy, all motion is overridden to
0.01ms when the user requests reduced motion. For default motion:

- **Standard transition:** 150ms ease-out
- **Surface transition:** 200ms ease
- **Glow pulse (arc reactor):** 2s ease-in-out infinite
- **Score-ring fill:** 1s ease forwards
- **Fade-in:** 400ms ease forwards

The arc reactor pulse is reserved for **AI-active indicators** — never used
for decoration alone.

---

## 7. Hero patterns (for landing / pitch / cover surfaces)

These are the **only** places where the full Iron Man visual grammar appears
together. Routine UI stays calmer.

### 7.1 The reactor ring

A radial-gradient circle used as a logo treatment. Used on:
- Landing page hero
- Pitch deck cover & close
- 404 / error pages (smaller variant)

```css
.reactor-ring {
  background: radial-gradient(
    circle at center,
    #FFFFFF 0%,
    #A8E6F0 18%,
    #5EC8E0 35%,
    transparent 70%
  );
  box-shadow: 0 0 60px rgba(94, 200, 224, 0.4);
}
```

### 7.2 The schematic backdrop

A subtle vertical-line pattern in `navy.700` over `navy.900`, evoking the
technical schematics in the Iron Man poster background. Used at low opacity
on hero sections only.

### 7.3 The gold seal

A small gold-gradient badge used to mark **constitutional milestones** —
ratified amendments, validated methods, held resolutions. Carries the
"earned" semantic.

---

## 8. Brand voice (carries with the visual identity)

The visual is heroic-restrained. The voice is the same:

- **Confident, not loud.** Crimson on navy, not crimson on red.
- **Earned, not asserted.** Gold marks things that held — never decorative.
- **Live, not noisy.** Cyan only when the AI is actually doing something.
- **Plain, not corporate.** Display Inter Black, not Times New Roman.

---

## 9. Where this identity is enforced in code

| File | Role |
|---|---|
| `docs/BRAND.md` | This document (canonical) |
| `src/lib/design/tokens.ts` | Programmatic tokens for components |
| `tailwind.config.ts` | Extends Tailwind palette with brand tokens |
| `src/app/globals.css` | CSS variables, animations, base styles |
| `src/components/ui/*` | Components consume tokens via Tailwind utilities |

Any new visual element should be expressible in this palette. If it can't be,
that's a brand decision to be made consciously — not an accident.

---

## 9.5 Dual-mode operation — Light (day) + Dark (night)

The Iron Man identity translates faithfully across both modes. **Brand colors
(crimson, gold, arc cyan) stay identical** — they pop on both surfaces. Only
the **surface scale** swaps:

| Token | Dark (default — operator mode) | Light (day mode) |
|---|---|---|
| `bg-base` (page background) | `navy.900` `#0A1429` | cool slate `#F4F6FA` |
| `bg-surface` (cards, modals) | `navy.800` `#0D1B2D` | white `#FFFFFF` |
| `bg-surface-raised` (hover) | `navy.700` `#152339` | `#F8FAFD` |
| `border-default` | `navy.600` `#1F3050` | `#E5E8EE` |
| `border-strong` (hover) | `navy.500` `#2D446C` | `#CBD2DD` |
| `text-primary` | `#F1F5FA` | `navy.900` `#0A1429` |
| `text-secondary` | `navy.200` `#94A3BF` | `navy.400` `#3C4D6A` |
| `text-muted` | `navy.300` `#5F7290` | `navy.300` `#5F7290` |

**Contrast-aware brand text:** the brand triad needs darker variants when used
as *text on white*. Components that switch should use these:

| Use | Dark mode | Light mode |
|---|---|---|
| Crimson text/link | `crimson.400` `#F75663` | `crimson.600` `#A91D24` |
| Gold text | `gold.300` `#F2C94C` | `gold.600` `#A6801C` |
| Arc cyan text | `arc.300` `#7DDCE8` | `arc.700` `#1F6B7E` |

**Brand backgrounds and glows stay identical** in both modes — `bg-crimson-500`
is the same crimson on a dark page or a light page. The visual signature is
intact across modes.

### Mode-selection rules

- Mode persists in `localStorage` under `execos.theme.v1`
- Initial mode honors `prefers-color-scheme` (system preference)
- A no-flash inline script in `layout.tsx` sets `data-theme` *before* first
  paint so the wrong theme never flashes
- Toggle is available in the landing-page header and the dashboard sidebar
- Three-state switcher: `system | light | dark` — "system" follows the OS

### What's themed vs what isn't

- **Themed:** page background, card, border, text color, modal, input field
- **Brand-fixed:** crimson buttons, gold "held" badges, arc-cyan AI-active
  indicators, the pulse-dot, gradient effects, hero treatments
- **Imagery:** `.bg-crimson-metallic`, `.text-gold-metallic`, `.reactor-ring`
  are mode-agnostic — brand signatures
- **Code/data surfaces:** stay dark in both modes (operators expect this)

---

## 10. Quick reference — the 9 colors that matter most

| Use | Color | Hex |
|---|---|---|
| Background | navy.900 | `#0A1429` |
| Card surface | navy.800 | `#0D1B2D` |
| Border | navy.600 | `#1F3050` |
| Body text | navy.200 | `#94A3BF` |
| **Primary action** | **crimson.500** | **`#C8232C`** |
| **Primary action hover** | **crimson.600** | **`#A91D24`** |
| **Earned / success** | **gold.400** | **`#E8B53A`** |
| **AI active** | **arc.400** | **`#5EC8E0`** |
| Error / rejected | error | `#E63946` |

If you remember nothing else, remember these nine.
