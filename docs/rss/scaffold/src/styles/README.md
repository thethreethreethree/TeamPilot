# Styles for the Remote Sales System

**Use the ELOSTATE repo's existing Sales Coach theme. Do not add a new one.** `npm run theme:audit`
in the repo enforces it.

The ELOSTATE theme files could not be read from where this plan was written, so they are not copied
here. `sales-coach-tokens.css` holds the values measured from the shipped Sales Coach UI
(screenshot, Sept 2026). Use it only to check a new screen against the shipped one, never as the
source of truth.

Two brand records exist, and they differ:

| Record | Ground | Accent | Applies to |
| --- | --- | --- | --- |
| Shipped Sales Coach UI (Sept 2026) | zinc-950 `#09090B` | yellow-400 `#FACC15` | **Sales Coach screens — this system** |
| ELOSTATE brand kit (Aug 2026) | `#0A0A09` | `#FFDA03` (text on light: `#877402`) | Marketing, parent brand |

The project-specific record (the Sales Coach UI) wins inside the app.

**New UI rule from this plan:** outcome and status colours always come with a glyph or a word.
A colour alone isn't enough. Today every outcome except Sold is grey (F26.10).
