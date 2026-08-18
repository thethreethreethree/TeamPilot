import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Guard for the keyboard-overlay root-cause fix (founder-surfaced 2026-08-18).
 *
 * The soft keyboard's default `interactive-widget=resizes-visual` makes it OVERLAY `fixed inset-0` shell content,
 * so a bottom-anchored input (the Door Log naming form, a chat composer) ends up hidden behind the keyboard with
 * no way to reach it — a feature-breaking render bug. `resizes-content` instead shrinks the layout viewport when
 * the keyboard opens, pushing the fixed shells' bottom content above it. This one viewport line fixes the whole
 * class app-wide; removing it in a future viewport refactor would silently reintroduce the bug on every input
 * surface, so lock it here.
 */
describe("app viewport — keyboard handling", () => {
  it('declares interactiveWidget "resizes-content" (keyboard resizes the layout, does not overlay fixed shells)', () => {
    const src = readFileSync("src/app/layout.tsx", "utf8");
    expect(
      /interactiveWidget:\s*["']resizes-content["']/.test(src),
      "src/app/layout.tsx viewport must set interactiveWidget: \"resizes-content\" — else the keyboard overlays fixed-shell inputs (hidden Save button class)",
    ).toBe(true);
  });
});
