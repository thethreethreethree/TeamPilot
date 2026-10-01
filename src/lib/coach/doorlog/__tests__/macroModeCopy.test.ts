import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MACRO_ON_BODY, MACRO_OFF_BODY, macroModeBody } from "../macroModeCopy";

/**
 * The website says what the app says under the Macro Mode switch (founder REV 1; website parity chosen in a
 * picker 2026-10-01). The strings are pinned exactly: they are the founder's own words, and the app's
 * macro-mode-copy.ts holds the same two.
 */
describe("the Macro Mode sentence", () => {
  it("is the founder's REV 1 wording, exactly", () => {
    expect(MACRO_ON_BODY).toBe("This mode is for short form sales, under 15 minutes. Fiber internet, Pest Control.");
    expect(MACRO_OFF_BODY).toBe("Long form sales, over 20 minutes, ex: Solar Sales.");
  });

  it("follows the switch: ON is short form", () => {
    expect(macroModeBody(true)).toBe(MACRO_ON_BODY);
    expect(macroModeBody(false)).toBe(MACRO_OFF_BODY);
  });

  it("the card renders it, and no longer carries the old line", () => {
    const src = readFileSync(join(process.cwd(), "src/components/sales-coach/doorlog/MacroModeToggle.tsx"), "utf8");
    expect(src).toMatch(/macroModeBody\(/);
    expect(src).not.toContain("fast Door Log + a macro Report Card");
  });
});
