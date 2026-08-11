import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * Detection-tests for the theme-leak audit — the SAME discipline the invariant-audit tests enforce, applied to
 * the last `npm run check` gate that lacked them. A theme-leak regex that silently stops matching would ship
 * a color that reads on one theme and vanishes on the other (the class this gate exists to catch) while the
 * audit reports "No theme-bound leaks". So these assert the DETECTION LOGIC itself — each leak pattern must
 * match a real leak string AND stay narrow enough not to flag a brand/allowed color — and bind to the script
 * text so a silent narrowing fails here.
 */
const SCRIPT = readFileSync("scripts/theme-audit.mjs", "utf8");

describe("theme-audit.mjs", () => {
  it(
    "passes on the current tree (no theme-bound leaks)",
    () => {
      const out = execFileSync("node", ["scripts/theme-audit.mjs"], { encoding: "utf8" });
      expect(out).toContain("No theme-bound leaks");
    },
    30_000
  );

  it("the navy-named-scale detector flags a theme-bound navy utility, not a brand ember utility", () => {
    const NAVY_NAMED_LEAK = /\b(bg|text|border|divide|ring|placeholder|from|to|via)-navy-\d+(?:\/\d+)?\b/g;
    expect("class='bg-navy-800'".match(NAVY_NAMED_LEAK)).toEqual(["bg-navy-800"]);
    expect("class='text-navy-500/40'".match(NAVY_NAMED_LEAK)).toEqual(["text-navy-500/40"]);
    expect("class='bg-ember-400'".match(NAVY_NAMED_LEAK)).toBeNull(); // ember is brand (mode-agnostic)
    expect(SCRIPT).toContain("const NAVY_NAMED_LEAK = /\\b(bg|text|border|divide|ring|placeholder|from|to|via)-navy-\\d+");
  });

  it("the arbitrary-hex detector captures the prefix + hex so brand-vs-leak can be decided", () => {
    const HEX_LITERAL = new RegExp(
      String.raw`\b(bg|text|border|divide|ring|ring-offset|outline|shadow|decoration|placeholder|caret|accent|fill|stroke|from|to|via)-\[#([0-9a-fA-F]{3,8})\](?:\/\d+)?`,
      "g"
    );
    const m = [...("bg-[#0a1429] text-[#FACC15]".matchAll(HEX_LITERAL))];
    expect(m.map((x) => x[2])).toEqual(["0a1429", "FACC15"]); // both captured; brand-vs-leak decided by BRAND_HEXES
    // FACC15 (ember) is BRAND (allowed); a dark navy hex is a leak — the sets encode that split.
    expect(SCRIPT).toContain('"FACC15"'); // ember hex is in BRAND_HEXES
    expect(SCRIPT).toContain("const HEX_LITERAL = new RegExp");
  });

  it("the gold-text detector flags pale gold body text, not the contrast-aware text-primary", () => {
    const GOLD_TEXT_LEAK = /\btext-gold-\d+\b|\bhover:text-gold-\d+\b/g;
    expect("class='text-gold-100'".match(GOLD_TEXT_LEAK)).toEqual(["text-gold-100"]);
    expect("class='hover:text-gold-200'".match(GOLD_TEXT_LEAK)).toEqual(["hover:text-gold-200"]);
    expect("class='text-primary'".match(GOLD_TEXT_LEAK)).toBeNull();
    expect(SCRIPT).toContain("const GOLD_TEXT_LEAK = /\\btext-gold-\\d+\\b");
  });

  it("the pale-text detector flags -100/-200 tints only, not -300+ or text-primary", () => {
    const PALE_TEXT_LEAK =
      /\btext-(emerald|red|yellow|blue|amber|lime|green|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose|orange|slate|gray|zinc|neutral|stone)-(100|200)\b/g;
    expect("class='text-emerald-100'".match(PALE_TEXT_LEAK)).toEqual(["text-emerald-100"]);
    expect("class='text-red-200'".match(PALE_TEXT_LEAK)).toEqual(["text-red-200"]);
    expect("class='text-emerald-300'".match(PALE_TEXT_LEAK)).toBeNull(); // -300 is often valid; only -100/-200 flagged
    expect("class='text-primary'".match(PALE_TEXT_LEAK)).toBeNull();
    expect(SCRIPT).toContain("emerald|red|yellow|blue|amber|lime|green|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose|orange|slate|gray|zinc|neutral|stone)-(100|200)");
  });

  it("the solid-brand-fill detector flags a SOLID ember fill, not a translucent /opacity overlay", () => {
    const SOLID = [/\bbg-ember-(400|500|600)\b(?!\/)/, /\bbg-\[#FACC15\](?!\/)/];
    expect(SOLID.some((re) => re.test("bg-ember-400"))).toBe(true); // solid → text-primary on it is a contrast smell
    expect(SOLID.some((re) => re.test("bg-ember-400/10"))).toBe(false); // translucent overlay → theme-aware, fine
    expect(SCRIPT).toContain("const SOLID_BRAND_RED = [");
  });

  it("the inline-style-hex detector captures a baked-in hex from a JSX attribute", () => {
    const INLINE_STYLE_HEX =
      /(?:background|backgroundColor|color|borderColor|fill|stroke)\s*[:=]\s*["']#([0-9a-fA-F]{3,8})["']/g;
    expect([...('style={{ background: "#0a1429" }}'.matchAll(INLINE_STYLE_HEX))][0]?.[1]).toBe("0a1429");
    expect("<div className='p-2'>".match(INLINE_STYLE_HEX)).toBeNull();
    expect(SCRIPT).toContain("(?:background|backgroundColor|color|borderColor|fill|stroke)\\s*[:=]");
  });
});
