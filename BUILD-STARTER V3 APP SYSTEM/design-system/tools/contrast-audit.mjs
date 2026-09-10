#!/usr/bin/env node
/**
 * contrast-audit — read the tokens that actually landed on disk and verify every
 * semantic pair against WCAG 2.2 AA.
 *
 * token-gen guarantees correctness at generation time. This verifies it again at
 * gate time, because someone always hand-edits the values eventually.
 *
 * TWO INPUT FORMATS, because the kit ships two consumers:
 *   - `theme.ts`   — the App Edition target. token-gen --theme emits
 *                    `export const colors = { light: {...}, dark: {...} }` with
 *                    resolved HEX, because React Native cannot evaluate oklch()
 *                    at runtime.
 *   - `globals.css`— the legacy web target: `:root` / `.dark` custom properties.
 *
 * The App Edition previously had no working token gate at all: this tool read
 * only CSS, and gate.mjs looked only for globals.css, so G3 on an Expo project
 * either failed permanently ("no globals.css found") or was satisfied by a
 * legacy CSS file the app never loads. Repaired per 06-VERIFICATION §7 — the
 * minimum change, no threshold touched, and proven to still fail on a
 * deliberately broken theme.
 *
 * Usage:
 *   node tools/contrast-audit.mjs --file theme.ts
 *   node tools/contrast-audit.mjs --file app/globals.css --json
 */

import fs from "node:fs";
import path from "node:path";
import { contrast, truncate2, grade, WCAG, apcaLc, apcaAdvice } from "./lib/wcag.mjs";

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const argv = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d;
};
const asJson = argv.includes("--json");

/**
 * Immediate subdirectories of ROOT that look like an app (they carry a
 * package.json), so the audit still finds the tokens when the project root sits
 * one level ABOVE the app — a monorepo, or simply a workspace opened on the
 * parent folder. Without this the gate reports "no token file found" forever on
 * that layout, which is a gate that cannot run rather than a gate that passes.
 *
 * One level only, and dot-directories and node_modules are skipped. Searching
 * deeper would start finding the token files of dependencies.
 */
function appDirs(root) {
  try {
    return fs
      .readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules")
      .map((e) => e.name)
      .filter((name) => fs.existsSync(path.join(root, name, "package.json")));
  } catch {
    return [];
  }
}

// theme.ts first: on an App-Edition project it is the file the app actually
// loads, so it is the one worth verifying. globals.css stays in the list for a
// legacy web project. ROOT is searched before any subdirectory, so a project
// whose root IS the app behaves exactly as before.
const TOKEN_PATHS = [
  "theme.ts", "src/theme.ts", "lib/theme.ts", "styles/theme.ts",
  "app/globals.css", "src/app/globals.css", "styles/globals.css", "src/styles/globals.css",
];

const candidates = [
  ...TOKEN_PATHS.map((p) => path.join(ROOT, p)),
  ...appDirs(ROOT).flatMap((dir) => TOKEN_PATHS.map((p) => path.join(ROOT, dir, p))),
];

const file = flag("file") || candidates.find((p) => fs.existsSync(p));

if (!file || !fs.existsSync(file)) {
  const msg =
    "contrast-audit: no token file found. Generate one:\n" +
    "  node tools/token-gen.mjs --theme theme.ts        (React Native / App Edition)\n" +
    "  node tools/token-gen.mjs --out app/globals.css   (web, legacy)";
  if (asJson) console.log(JSON.stringify({ error: msg, failures: [], checked: 0 }));
  else console.error(msg);
  process.exit(2);
}

const source = fs.readFileSync(path.resolve(ROOT, file), "utf8");
const isTheme = /\.(ts|tsx|js|mjs)$/i.test(file);
const css = isTheme ? "" : source;

/* --------------------------------------------- extract token blocks (TS) */

/**
 * Pull `light: { … }` / `dark: { … }` out of the generated theme module.
 *
 * Brace-counted rather than regex-slurped, because the emitted file has nested
 * objects after `colors` (brand, ink, radius, fontSize) and a greedy match would
 * run straight through them. Values are resolved hex strings — an 8-digit
 * `#RRGGBBAA` carries alpha and is reported n/a below, exactly as an
 * `oklch(... / 50%)` value is on the CSS path.
 */
function extractThemeObject(key) {
  const re = new RegExp(`(^|[\\s,{])${key}\\s*:\\s*\\{`, "m");
  const m = re.exec(source);
  if (!m) return {};
  let depth = 1;
  let i = m.index + m[0].length;
  while (i < source.length && depth > 0) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") depth--;
    i++;
  }
  const body = source.slice(m.index + m[0].length, i - 1);
  const out = {};
  for (const decl of body.matchAll(/["']?([a-z0-9-]+)["']?\s*:\s*["']([^"']+)["']/gi)) {
    out[decl[1].trim()] = decl[2].trim();
  }
  return out;
}

/* ------------------------------------------------ extract token blocks (CSS) */

function extractBlock(selector) {
  // Match `:root {` / `.dark {` at the top level and capture to the matching brace
  const re = new RegExp(`${selector}\\s*\\{`, "g");
  const m = re.exec(css);
  if (!m) return {};
  let depth = 1;
  let i = re.lastIndex;
  while (i < css.length && depth > 0) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") depth--;
    i++;
  }
  const body = css.slice(re.lastIndex, i - 1);
  const out = {};
  for (const decl of body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    out[decl[1].trim()] = decl[2].trim();
  }
  return out;
}

const light = isTheme ? extractThemeObject("light") : extractBlock(":root");
const dark = isTheme ? extractThemeObject("dark") : extractBlock("\\.dark");

// A token file that parses to nothing is not a pass — it is a gate that did not
// run. Say so and exit non-zero rather than reporting "0 failures", which is how
// a broken checker quietly becomes a green light.
if (!Object.keys(light).length && !Object.keys(dark).length) {
  const msg =
    `contrast-audit: no tokens could be read from ${path.relative(ROOT, file)}.\n` +
    (isTheme
      ? "Expected `colors = { light: {...}, dark: {...} }` with hex values, as token-gen --theme emits."
      : "Expected `:root { --token: ... }` and `.dark { ... }` blocks.") +
    "\nRegenerate with token-gen rather than hand-writing the file.";
  if (asJson) console.log(JSON.stringify({ error: msg, failures: [], checked: 0 }));
  else console.error(msg);
  process.exit(2);
}

/* --------------------------------------------------------------- pairs */

const PAIRS = [
  ["foreground", "background", "text"],
  ["card-foreground", "card", "text"],
  ["popover-foreground", "popover", "text"],
  ["primary-foreground", "primary", "text"],
  ["secondary-foreground", "secondary", "text"],
  ["accent-foreground", "accent", "text"],
  ["muted-foreground", "muted", "text"],
  ["muted-foreground", "background", "text"],
  ["sidebar-foreground", "sidebar", "text"],
  ["sidebar-primary-foreground", "sidebar-primary", "text"],
  ["ring", "background", "nontext"],
  ["input", "background", "nontext"],
  ["destructive", "background", "nontext"],
];

// Alpha in either notation: `oklch(… / 50%)` on the CSS path, `#RRGGBBAA` on the
// theme path. A ratio against a translucent colour depends on what is behind it,
// so both are reported n/a rather than guessed at.
const isAlpha = (v) =>
  /\/\s*[\d.]+%?\s*\)/.test(v || "") || /^#[0-9a-f]{8}$/i.test((v || "").trim());

function audit(tokens, themeName) {
  const rows = [];
  for (const [fg, bg, kind] of PAIRS) {
    const fgv = tokens[fg];
    const bgv = tokens[bg];
    if (!fgv || !bgv) continue;
    if (isAlpha(fgv) || isAlpha(bgv)) {
      rows.push({ theme: themeName, fg, bg, kind, ratio: null, grade: "n/a (alpha)", pass: null });
      continue;
    }
    const r = contrast(fgv, bgv);
    if (r == null) {
      rows.push({ theme: themeName, fg, bg, kind, ratio: null, grade: "unparsed", pass: null });
      continue;
    }
    const required = kind === "nontext" ? WCAG.NON_TEXT : WCAG.AA_NORMAL;
    const t = truncate2(r);
    rows.push({
      theme: themeName, fg, bg, kind,
      ratio: t,
      required,
      grade: grade(r, kind),
      apca: kind === "text" ? Math.round(apcaLc(fgv, bgv)) : null,
      apcaAdvice: kind === "text" ? apcaAdvice(apcaLc(fgv, bgv)) : null,
      pass: t >= required,
      fgValue: fgv,
      bgValue: bgv,
    });
  }
  return rows;
}

const rows = [
  ...(Object.keys(light).length ? audit(light, "light") : []),
  ...(Object.keys(dark).length ? audit(dark, "dark") : []),
];
const failures = rows.filter((r) => r.pass === false);
const checked = rows.filter((r) => r.pass !== null).length;

/* -------------------------------------------------------------- output */

if (asJson) {
  console.log(JSON.stringify({ file: path.relative(ROOT, file), checked, rows, failures }, null, 2));
} else {
  console.log(`\n\x1b[1mToken contrast\x1b[0m  ${path.relative(ROOT, file)}\n`);
  let theme = null;
  for (const r of rows) {
    if (r.theme !== theme) {
      console.log(`  \x1b[2m── ${r.theme} ──\x1b[0m`);
      theme = r.theme;
    }
    const mark = r.pass == null ? "\x1b[2m–\x1b[0m" : r.pass ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
    const apca = r.apca != null ? `\x1b[2m  APCA Lc ${r.apca} (${r.apcaAdvice})\x1b[0m` : "";
    console.log(
      `  ${mark} ${String(r.ratio ?? "n/a").padStart(6)}  min ${r.required ?? "-"}   ${r.fg} on ${r.bg}${apca}`
    );
  }
  if (failures.length) {
    console.log(`\n\x1b[31m${failures.length} failure(s).\x1b[0m Regenerate rather than hand-patching:`);
    console.log(
      `  \x1b[1mnode tools/token-gen.mjs ${isTheme ? "--theme" : "--out"} ${path.relative(ROOT, file)}\x1b[0m\n`
    );
  } else {
    console.log(`\n\x1b[32m✓ ${checked} pairs pass WCAG 2.2 AA\x1b[0m\n`);
  }
  console.log(
    "\x1b[2mAPCA is advisory only. It is NOT in the WCAG 3 draft (removed July 2023)\n" +
      "and has no legal standing. Gate on the WCAG 2.2 ratio.\x1b[0m\n"
  );
}

process.exit(failures.length ? 1 : 0);
