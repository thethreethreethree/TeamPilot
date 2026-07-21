#!/usr/bin/env node
//
// scripts/theme-audit.mjs — Exhaustive theme-leak detector.
//
// What it does
// ────────────
//   Scans every src .ts / .tsx file for color-bearing Tailwind utilities and
//   inline-style hex values, splits them into BRAND (mode-agnostic, allowed)
//   vs THEME-BOUND (leaks — must use the semantic scale), and prints a
//   precise report. Exits non-zero if any theme-bound leaks remain.
//
// Why it exists
// ─────────────
//   Per the constitution's feedback discipline: the agent shall not declare a UI
//   migration "complete" based on its own narrow tests. Every prior pass
//   was scoped to "the patterns I happened to think of," which produced
//   a sequence of false-confidence completion claims and forced the user
//   to re-discover the same root cause. This audit removes the discretion:
//   it enumerates EVERY Tailwind color-bearing prefix and EVERY known leak
//   pattern, so the residual count is a hard fact, not an opinion.
//
//   The brand triad (crimson / gold / arc) is mode-agnostic by docs/BRAND.md
//   §9.5, so brand-fill / brand-border / brand-ring / brand-gradient usages
//   are explicitly allowed. Only theme-bound colors (the navy surface scale
//   and dark-context hex literals) are leaks.
//
// Usage
// ─────
//   node scripts/theme-audit.mjs               # report, exit 1 if leaks
//   node scripts/theme-audit.mjs --verbose     # also list per-file lines
//
// Exit code
// ─────────
//   0 if zero theme-bound leaks. 1 otherwise.

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const VERBOSE = process.argv.includes("--verbose");

// ─── Every Tailwind utility prefix that can carry a color ─────────────
const COLOR_PREFIXES = [
  "bg", "text", "border", "divide", "ring", "ring-offset",
  "outline", "shadow", "decoration", "placeholder", "caret",
  "accent", "fill", "stroke", "from", "to", "via",
];

// ─── Brand-fill / brand-border tokens that are explicitly mode-agnostic
//      Ember (the bulb yellow) holds contrast on both dark and light
//      surfaces. ink (the matte-black grayscale) is the field; near-
//      black 950 reads correctly as bg-base in dark mode, the same
//      utility maps to bg-base resolving to cream in light mode via
//      CSS var swap. No red, no cyan, no navy — dropped 2026-06-12.
const BRAND_HEXES = new Set([
  // Ember (amber) family — the bulb
  "FFFDF0", "FEF9C3", "FEF08A", "FDE047",
  "FACC15", "EAB308", "CA8A04", "A16207", "854D0E", "713F12",
  // Ink (matte-black grayscale) family — for inline mark stroke / bg
  "FAFAFA", "F4F4F5", "E4E4E7", "D4D4D8",
  "A1A1AA", "71717A", "52525B",
  "3F3F46", "27272A", "18181B", "09090B",
  // Back-compat — some legacy gold hex literals may still appear during
  // sweep; recognized as brand because gold→ember is an alias now.
  "E8B53A", "F2C94C", "D4A024", "A6801C",
]);

const BRAND_NAMED_SCALES = new Set([
  "ember", "ink",
  // Back-compat aliases — still resolve via tailwind config to ember/ink.
  "gold", "navy",
]);

// ─── Patterns that ARE always leaks (theme-bound) ──────────────────────
// Named-scale references that bind directly to the dark navy palette.
const NAVY_NAMED_LEAK = /\b(bg|text|border|divide|ring|placeholder|from|to|via)-navy-\d+(?:\/\d+)?\b/g;

// Hex literals inside Tailwind arbitrary values (`bg-[#abc123]`, with optional opacity).
// Captures the prefix and the 3/6/8-digit hex so we can decide brand-vs-leak.
const HEX_LITERAL = new RegExp(
  String.raw`\b(${COLOR_PREFIXES.join("|")})-\[#([0-9a-fA-F]{3,8})\](?:\/\d+)?`,
  "g"
);

// Crimson named scale should no longer appear after the 2026-06-12 sweep.
// Leaks here mean the sweep missed a reference; flag for cleanup.
const CRIMSON_TEXT_LEAK = /\btext-crimson-\d+\b/g;

// Same-element brand-fill + theme-aware text = inverted contrast bug.
// Ember (#FACC15) is bright yellow — white text on it is unreadable.
// The CSS contrast guard in globals.css swaps text-primary children to
// #09090B inside ember backgrounds, but explicit text-primary on a
// solid ember button is still a smell worth catching at audit time.
//
// Match only SOLID ember fills (no /opacity suffix). Tinted fills like
// `bg-[#FACC15]/10` are translucent overlays on a theme-aware surface,
// so `text-primary` against them is correct.
const SOLID_BRAND_RED = [
  /\bbg-ember-(400|500|600)\b(?!\/)/,
  /\bbg-\[#FACC15\](?!\/)/,
  /\bbg-\[#EAB308\](?!\/)/,
  /\bbg-\[#CA8A04\](?!\/)/,
];
const THEME_AWARE_TEXT_ON_BRAND = /\btext-primary\b/;

// Gold text variants that should use `text-accent-text` — gold-100/200/300
// are pale helmet tones that pop on dark navy and disappear on light cream.
// gold-600 is the contrast-aware replacement encoded in text-accent-text.
// User-reported in the §3.5 review build: the closed-banner body was
// invisible in light mode because text-gold-100/80 was used for body text.
const GOLD_TEXT_LEAK = /\btext-gold-\d+\b|\bhover:text-gold-\d+\b/g;

// Tailwind palette text-color-100/200 — the general shape of "pale tint
// designed for dark-bg legibility" that disappears on light mode. Toast
// notifications hit this with text-emerald-100 / text-red-100 / etc.
// after the audit caught the gold variant; same root cause, different
// palette. Use `text-primary` instead (contrast-aware) and let the
// background tint + colored border carry kind-recognition.
//
// We intentionally only flag the -100 and -200 tones — those are the
// pale ones that always need replacing. Higher numbers (-300, -400) are
// often valid for icons or accent text on tinted backgrounds.
const PALE_TEXT_LEAK = /\btext-(emerald|red|yellow|blue|amber|lime|green|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose|orange|slate|gray|zinc|neutral|stone)-(100|200)\b/g;

// Inline `style={{ background: '#...' }}` (and similar) — captures any
// dark-themed hex baked into JSX attributes. Only flag if the hex is in
// the navy/dark family.
const INLINE_STYLE_HEX = /(?:background|backgroundColor|color|borderColor|fill|stroke)\s*[:=]\s*["']#([0-9a-fA-F]{3,8})["']/g;
const DARK_HEXES = new Set([
  "0c0d16", "0A1429", "0a1429",
  "12141f", "0D1B2D", "0d1b2d",
  "152339", "1F3050", "1f3050",
  "1a1d2e", "252840", "2D446C", "2d446c",
  "3a3f5c", "5F7290", "5f7290",
  "8895c4", "e8eaf6",
  "5a6399",
]);

// ─── Walk ──────────────────────────────────────────────────────────────
// ─── Allowlist ────────────────────────────────────────────────────────
// Files where a "leak" is actually a documented tradeoff that the theme
// system cannot solve. Each entry must carry a stated reason.
const FILE_ALLOWLIST = new Map([
  [
    "src/app/manifest.ts",
    "PWA manifest is built at compile time — cannot follow user's runtime theme preference. Brand-dark splash is the accepted static value.",
  ],
  [
    "src/lib/design/tokens.ts",
    "Design-tokens source file. Any Tailwind utility name appearing here is documentation referencing the utility, not an applied class.",
  ],
  [
    "src/components/care/demo/CareShowroom.tsx",
    "Deliberate fixed-dark 'product console': the /care/demo showroom renders a dark agent-inbox screenshot inside the theme-aware page — a single-theme element per the design discipline, chosen for contrast-safety. Legible on both page themes (light-mode screenshot-verified 2026-07-22).",
  ],
  [
    "src/components/care/demo/JeffLiveChat.tsx",
    "Deliberate fixed-dark demo chat console — same rationale as CareShowroom.tsx.",
  ],
  [
    "src/components/care/demo/CareHonestNote.tsx",
    "Deliberate fixed-dark demo note — the theme-aware version rendered invisible in light mode (unresolved Layer-4 cause, audit finding F4); fixed colors are the verified-legible workaround.",
  ],
]);

const files = Array.from(
  new Set(
    execSync("git ls-files src -- '*.ts' '*.tsx'", { encoding: "utf8" })
      .split("\n")
      .filter(Boolean)
      // Untracked Phase-1 chat pages still must be audited.
      .concat([
        "src/app/dashboard/chats/page.tsx",
        "src/app/dashboard/chats/[id]/page.tsx",
      ])
  )
);

const leaks = {
  navyNamed: [],
  hexLeak: [],
  crimsonText: [],
  goldText: [],
  paleText: [],
  inlineStyle: [],
  brandRedSameElement: [],
};

const brandHits = {
  brandHex: 0,
  brandScale: 0,
};

for (const file of files) {
  if (FILE_ALLOWLIST.has(file.replace(/\\/g, "/"))) continue;
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  const lines = text.split(/\r?\n/);

  lines.forEach((line, i) => {
    const lineNo = i + 1;

    // ── Legitimate exception #1: `text-navy-N` is intentional dark text
    //     on a BRIGHT brand-button fill (gold or arc cyan). These buttons
    //     stay the same fill color on both modes, so dark navy text on
    //     them is mode-agnostic correct. Skip if same line shows a known
    //     bright-button fill.
    const hasBrightButtonFill =
      /\bbg-gold-\d+\b/.test(line) || /\bbg-arc-\d+\b/.test(line);

    // ── Legitimate exception #2: a dark hex inside a
    //     `prefers-color-scheme: dark` media-query line is already
    //     gated to dark mode — by definition the right value there.
    const isDarkMediaQueryLine = /prefers-color-scheme:\s*dark/.test(line);

    // ── Named navy leak ──
    for (const m of line.matchAll(NAVY_NAMED_LEAK)) {
      const isNavy900Text = /^text-navy-900\b/.test(m[0]);
      if (isNavy900Text && hasBrightButtonFill) continue;
      leaks.navyNamed.push({ file, lineNo, match: m[0] });
    }

    // ── Crimson text leak (needs `text-brand`) ──
    for (const m of line.matchAll(CRIMSON_TEXT_LEAK)) {
      leaks.crimsonText.push({ file, lineNo, match: m[0] });
    }

    // ── Gold text leak (needs `text-accent-text`) ──
    // Exception: text-gold-N is legitimate when the SAME element has a
    // bright fill (the option pill in the durability review modal) —
    // dark text on a bright button is correct on both modes. We use
    // the same hasFill heuristic as the white-text migration.
    const hasFillInline =
      /\bbg-gold-\d+\/\d+/.test(line) || /\bbg-gold-\d+\b/.test(line);
    for (const m of line.matchAll(GOLD_TEXT_LEAK)) {
      if (hasFillInline) continue;
      leaks.goldText.push({ file, lineNo, match: m[0] });
    }

    // ── Pale Tailwind text leak (text-X-100/200) ──
    // Same shape as the gold-100 issue: pale tints intended for dark
    // backgrounds that disappear on light cream. Use text-primary plus
    // a colored border/icon for kind-recognition. Exception: when the
    // same element has a fully-saturated colored fill (e.g.
    // `bg-emerald-500 text-emerald-100`), the dark pale text is
    // intentional contrast against the bright fill.
    for (const m of line.matchAll(PALE_TEXT_LEAK)) {
      const palette = m[1];
      // Same-palette fill on same line = intentional pale-on-bright pairing.
      const hasMatchingFill = new RegExp(
        `\\bbg-${palette}-(400|500|600|700|800|900)\\b(?!/\\d)`
      ).test(line);
      if (hasMatchingFill) continue;
      leaks.paleText.push({ file, lineNo, match: m[0] });
    }

    // ── Tailwind arbitrary hex literal — brand vs leak ──
    for (const m of line.matchAll(HEX_LITERAL)) {
      const [whole, _prefix, hex] = m;
      const upper = hex.toUpperCase();
      if (BRAND_HEXES.has(upper)) {
        brandHits.brandHex++;
      } else {
        leaks.hexLeak.push({ file, lineNo, match: whole });
      }
    }

    // ── Same-element brand-red fill + text-primary ──
    // The inverted-contrast bug: text-primary swings to near-black on
    // light mode, which on a constant brand-red fill produces unreadable
    // black-on-red. Other brand-red buttons all use text-white directly.
    //
    // Restricted to .ts / .tsx: in `src/app/globals.css` the same two
    // strings appear together as part of the descendant-guard CSS
    // selector (`[class*="bg-[#C8232C]"] .text-primary { color: white }`)
    // which is exactly the rule that protects the child-element case.
    // That's not a leak — it's the fix.
    if (/\.tsx?$/.test(file) && THEME_AWARE_TEXT_ON_BRAND.test(line)) {
      const brandFill = SOLID_BRAND_RED.find((re) => re.test(line));
      if (brandFill) {
        const fillMatch = line.match(brandFill);
        leaks.brandRedSameElement.push({
          file,
          lineNo,
          match: `${fillMatch?.[0] ?? "brand-red"} + text-primary`,
        });
      }
    }

    // ── Inline-style hex in dark family ──
    if (isDarkMediaQueryLine) return; // explicitly dark-gated, allowed
    for (const m of line.matchAll(INLINE_STYLE_HEX)) {
      const hex = m[1];
      const upper = hex.toUpperCase();
      if (DARK_HEXES.has(hex) || DARK_HEXES.has(hex.toLowerCase()) || DARK_HEXES.has(upper)) {
        leaks.inlineStyle.push({ file, lineNo, match: m[0] });
      }
    }
  });
}

// ─── Report ────────────────────────────────────────────────────────────
const totalLeaks =
  leaks.navyNamed.length +
  leaks.hexLeak.length +
  leaks.crimsonText.length +
  leaks.goldText.length +
  leaks.paleText.length +
  leaks.inlineStyle.length +
  leaks.brandRedSameElement.length;

function group(items) {
  const byFile = new Map();
  for (const it of items) {
    if (!byFile.has(it.file)) byFile.set(it.file, []);
    byFile.get(it.file).push(it);
  }
  return byFile;
}

function printSection(title, items, hint) {
  if (items.length === 0) return;
  console.log(`\n  ${title}  (${items.length})`);
  console.log(`    ${hint}`);
  const byFile = group(items);
  for (const [file, list] of byFile) {
    console.log(`\n    ${file}`);
    const counts = new Map();
    for (const it of list) counts.set(it.match, (counts.get(it.match) ?? 0) + 1);
    for (const [match, n] of counts) {
      console.log(`      ${String(n).padStart(3)} × ${match}`);
    }
    if (VERBOSE) {
      for (const it of list) console.log(`           L${it.lineNo}  ${it.match}`);
    }
  }
}

console.log("═══ ELOSTATE theme-leak audit ═══");
console.log(`  Files scanned: ${files.length}`);
console.log(`  Brand-color uses (allowed): ${brandHits.brandHex} hex, ${brandHits.brandScale} named`);
console.log(`  Files on documented allowlist: ${FILE_ALLOWLIST.size}`);
for (const [path, why] of FILE_ALLOWLIST) {
  console.log(`    • ${path} — ${why}`);
}
console.log(`  Theme-bound leaks: ${totalLeaks}`);

printSection(
  "› Named navy-scale uses",
  leaks.navyNamed,
  "These bind to the dark navy palette and bypass the theme. Migrate to semantic (bg-base / bg-surface / text-secondary / border-default …)."
);
printSection(
  "› Theme-bound hex literals in Tailwind arbitrary values",
  leaks.hexLeak,
  "Replace with the semantic class for the equivalent surface / text / border."
);
printSection(
  "› text-crimson-N (needs contrast-aware text-brand)",
  leaks.crimsonText,
  "crimson-400 is correct on dark, illegible on light. Use `text-brand`."
);
printSection(
  "› text-gold-N body/label uses (needs contrast-aware text-accent-text)",
  leaks.goldText,
  "gold-100/200/300 are pale helmet tones — invisible on light cream. Use `text-accent-text`. Exception: text-gold-N is intentional when paired with a bg-gold-N fill (dark text on bright button)."
);
printSection(
  "› text-<palette>-100/200 (pale tints designed for dark, invisible on light)",
  leaks.paleText,
  "Pale Tailwind tints (text-emerald-100, text-red-100, text-yellow-100, etc.) work on dark navy but disappear on light cream. Use `text-primary` plus a colored border / icon for kind-recognition. Exception: paired with a saturated bg-<palette>-500/600/etc. on the same element (dark text on bright fill)."
);
printSection(
  "› Inline style hex in dark family",
  leaks.inlineStyle,
  "Replace with CSS variable: `rgb(var(--bg-base))` etc., or migrate the attribute to a className."
);
printSection(
  "› Same-element brand-red fill + text-primary (inverted contrast)",
  leaks.brandRedSameElement,
  "Solid brand-red is dark on both modes; text-primary swings to near-black on light → unreadable. Use `text-white` explicitly, matching every other brand-red button."
);

if (totalLeaks === 0) {
  console.log("\n✓ No theme-bound leaks.");
  process.exit(0);
} else {
  console.log("\n✗ Theme-bound leaks found. Fix or document as a legitimate exception.");
  process.exit(1);
}
