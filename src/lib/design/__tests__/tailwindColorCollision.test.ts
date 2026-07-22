import { describe, it, expect } from "vitest";
// Root Tailwind config. Its own `import { ember, ink } from "./src/lib/design/tokens"` resolves from
// the repo root, which vitest handles.
import config from "../../../../tailwind.config";

/**
 * Regression guard for audit V7 (2026-07-22): a custom color named `base` collided with Tailwind's
 * core `text-base` FONT-SIZE utility, so Tailwind emitted `.text-base { color: var(--bg-base) }` and
 * forced every `text-base` element's text colour to the page background — invisible text app-wide.
 *
 * The class of bug: ANY color registered in `theme.extend.colors` whose name matches a core utility
 * token that shares the `text-`/`bg-`/`border-` prefix. The `text-` prefix is shared by both the
 * text-colour utilities and the FONT-SIZE utilities, so a color named after a font-size (xs, sm, base,
 * lg, xl, 2xl…) is the dangerous case. Colors that must ALSO drive backgrounds/borders belong in the
 * per-property scales (`backgroundColor` / `borderColor` / `ringColor`), NOT top-level `colors`.
 */

// Tailwind's default fontSize keys — a color sharing any of these names collides with `text-<name>`.
const FONT_SIZE_NAMES = new Set([
  "xs", "sm", "base", "lg", "xl",
  "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "9xl",
]);

describe("tailwind config — no color name collides with a font-size utility (V7 guard)", () => {
  const colors = (config.theme?.extend?.colors ?? {}) as Record<string, unknown>;
  const colorNames = Object.keys(colors);

  it("has colors registered (sanity)", () => {
    expect(colorNames.length).toBeGreaterThan(0);
  });

  it("does NOT register `base` (or any font-size name) as a top-level color", () => {
    const collisions = colorNames.filter((n) => FONT_SIZE_NAMES.has(n));
    expect(
      collisions,
      `These color names collide with Tailwind font-size utilities and will force text-<name> to a colour (V7): ${collisions.join(", ")}. Move them to backgroundColor/borderColor/ringColor instead.`
    ).toEqual([]);
  });

  it("`base` remains available where it's actually used (bg/border/ring), just not as a text colour", () => {
    const bg = (config.theme?.extend?.backgroundColor ?? {}) as Record<string, unknown>;
    expect(bg.base, "bg-base must still resolve").toBeTruthy();
  });
});
