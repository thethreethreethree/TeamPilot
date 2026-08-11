# OG share-card source + regeneration

`public/og-home.png` is the home page's social/share preview card (1200×630, referenced by
`src/app/page.tsx` `openGraph.images` / `twitter.images`). It is a **rendered asset with a committed
source** — `scripts/og/home.html` — so it never again goes stale as an opaque binary (which is exactly what
happened when the hero copy changed on 2026-08-12 and the old card kept selling the previous message).

## When to regenerate
Whenever the hero message changes. Keep the card copy in sync with:
- the hero (`src/components/landing/Hero.tsx`), and
- the SEO metadata (`src/app/page.tsx` `HOME_TITLE` / `HOME_DESC`).

## How to regenerate (headless Chrome — a local dev step, not CI)
Edit `scripts/og/home.html`, then render it to `public/og-home.png` at 1200×630, allowing the webfont to
load. On Windows (Git Bash), with Chrome installed:

```bash
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1200,630 --virtual-time-budget=5000 \
  --screenshot="$(cygpath -w "$PWD/public/og-home.png")" \
  "file://$(cygpath -w "$PWD/scripts/og/home.html")"
```

macOS/Linux: use the platform Chrome path and drop the `cygpath` wrapping (pass plain absolute paths). Then
eyeball `public/og-home.png` (1200×630) before committing — confirm the Sora webfont loaded (the headline
should be the geometric Sora face, not a system fallback) and the copy matches the live hero.

A `next/og` (Satori) route would make this fully automatic, but it needs the Sora font bytes bundled + a
build-time dependency; deferred as over-engineering for an asset that changes with the marketing message
(rarely). Until then, this source + step keeps it reproducible.
