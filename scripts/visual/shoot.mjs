#!/usr/bin/env node
/**
 * Render this project's own components and LOOK at them.
 *
 * WHY THIS EXISTS. Twenty-four consecutive builds shipped with a residual that said, in different
 * words each time, "nothing here verifies the result looks right". On 2026-09-24 that residual
 * stopped being a note and produced a defect: `MARKER[m.kind].dot` threw on a value the database
 * had allowed since migration 0254, and the Recordings tab rendered NOTHING for any pitch where
 * the scorer declined a bonus. Five thousand tests were passing. The twelve-step gate was clean.
 * The screen was blank, and the only way to know that was to open it.
 *
 * WHAT IT IS NOT. Not screenshot diffing. There are no baseline images, nothing fails, and this is
 * deliberately not in `npm run check`. Font rendering differs between this machine and CI, so a
 * pixel gate would produce failures that are not real — the flake generator vitest.config.ts's own
 * timeout comment warns about, and a flaky gate is one people learn to re-run instead of read.
 *
 * What it produces is PNGs for a human (or an agent with eyes) to look at. The judgement stays
 * where judgement belongs.
 *
 * HOW IT WORKS, in three steps that each already existed:
 *   1. `tailwindcss` compiles the real stylesheet from `src/app/globals.css` and the real config,
 *      so what renders uses the project's actual tokens — not an approximation.
 *   2. A vitest run with its own config renders each `*.capture.tsx` under jsdom, using the same
 *      Testing Library the render tests use, and writes `document.body.innerHTML` to a file.
 *   3. Headless Chrome screenshots that HTML wrapped in the compiled CSS, once per theme.
 *
 * USAGE
 *   npm run visual                 — every capture, both themes
 *   npm run visual -- Recordings   — only captures whose name contains "Recordings"
 *
 * Output lands in `artifacts/visual/`, which is git-ignored. Nothing here is committed.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve, basename } from "node:path";

const ROOT = resolve(import.meta.dirname, "..", "..");
const OUT = join(ROOT, "artifacts", "visual");
const WORK = join(OUT, ".work");

/**
 * Where Chrome lives, per platform.
 *
 * `CHROME_PATH` wins, because a CI image or a Linux dev box will have it somewhere else entirely
 * and hard-coding three paths and calling that "cross-platform" is how a tool becomes
 * one-machine-only without anyone noticing.
 */
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

function findChrome() {
  const found = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (found) return found;
  /**
   * FAIL LOUD (§1.5.3). The alternative — skipping quietly and exiting 0 — would produce a run
   * that says nothing and looks like a pass, which is precisely the silence this whole tool was
   * built to break. An empty `artifacts/visual/` read as "the surfaces are fine" would be worse
   * than never having run it.
   */
  console.error(
    "\n  No Chrome or Edge found. This tool renders real pages; it cannot degrade to not rendering them.\n" +
      "  Set CHROME_PATH to a Chromium-based browser and re-run.\n\n" +
      `  Looked in:\n${CHROME_CANDIDATES.map((p) => `    ${p}`).join("\n")}\n`
  );
  process.exit(1);
}

/** Every `*.capture.tsx` under src/, wherever it lives beside the thing it captures. */
function findCaptures(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      findCaptures(p, out);
    } else if (entry.name.endsWith(".capture.tsx")) {
      out.push(p);
    }
  }
  return out;
}

const filter = process.argv.slice(2).filter((a) => !a.startsWith("-"))[0] ?? null;

const all = findCaptures(join(ROOT, "src"));
const captures = filter
  ? all.filter((p) => basename(p).toLowerCase().includes(filter.toLowerCase()))
  : all;

if (captures.length === 0) {
  console.error(
    filter
      ? `\n  No capture matches "${filter}". ${all.length} exist:\n${all.map((p) => `    ${basename(p)}`).join("\n")}\n`
      : "\n  No *.capture.tsx files found under src/.\n"
  );
  process.exit(1);
}

const chrome = findChrome();
rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });
mkdirSync(OUT, { recursive: true });

// ── 1. the real stylesheet ────────────────────────────────────────────────────────────────────
const cssPath = join(WORK, "app.css");
console.log("  compiling the project's own Tailwind bundle…");
execFileSync(
  "npx",
  ["tailwindcss", "-i", "src/app/globals.css", "-o", cssPath, "--minify"],
  { cwd: ROOT, stdio: "pipe", shell: process.platform === "win32" }
);
const css = readFileSync(cssPath, "utf8");

// ── 2. the real DOM ───────────────────────────────────────────────────────────────────────────
console.log(`  rendering ${captures.length} capture(s)…`);
execFileSync(
  "npx",
  ["vitest", "run", "--config", "vitest.visual.config.ts", ...captures.map((p) => p.replace(ROOT + "\\", "").replace(ROOT + "/", ""))],
  { cwd: ROOT, stdio: "inherit", env: { ...process.env, VISUAL_OUT: WORK }, shell: process.platform === "win32" }
);

// ── 3. the picture ────────────────────────────────────────────────────────────────────────────
const THEMES = ["dark", "light"];
const written = [];

for (const file of readdirSync(WORK).filter((f) => f.endsWith(".json"))) {
  const { name, html, width, height } = JSON.parse(readFileSync(join(WORK, file), "utf8"));
  for (const theme of THEMES) {
    const page = join(WORK, `${name}.${theme}.html`);
    /**
     * A VIEWPORT OF EXACTLY THE DECLARED WIDTH, as a flex column, because the alternative
     * fabricates layout bugs.
     *
     * A capture hands over a SUBTREE. Lifted out of its parent chain it has no width constraint
     * and no flex context, so a row that fits perfectly on a phone lays out as wide as its content
     * and renders clipped. The first capture taken with this tool did exactly that and looked
     * precisely like a real defect — the fix's own button, apparently cut off at the screen edge.
     *
     * `#vp` restores what the page provides: a fixed width, a column, `overflow:hidden`, and a
     * direct child that flexes to fill it. The screenshot window is 40px wider so a genuine
     * overflow is VISIBLE as overflow rather than silently cropped by the window itself — the
     * distinction between "this is too wide" and "I cannot tell" has to survive.
     */
    const frame =
      `body{margin:0;background:transparent}` +
      `#vp{width:${width}px;min-height:${height}px;display:flex;flex-direction:column;overflow:hidden}` +
      // `flex`/`min-height` only — NOT `display`. Forcing the child to flex would silently break
      // any surface that is a grid (the Recordings panel is one), turning a faithful frame into a
      // different way of inventing layout bugs. As a flex ITEM it lays out in the column; what it
      // is INSIDE stays its own business.
      //
      // `0 1 auto`, NOT `1 1 auto`: do not GROW. A short component stretched to fill the declared
      // height renders its own padding and spacing as something it is not — a compact notice card
      // photographed as a tall empty box. Shrinking is still allowed so a tall page lays out.
      `#vp>*{flex:0 1 auto;min-height:0}`;
    writeFileSync(
      page,
      `<!doctype html><html data-theme="${theme}"><head><meta charset="utf-8"><style>${css}</style>` +
        `<style>${frame}</style></head>` +
        `<body class="bg-base text-primary antialiased"><div id="vp">${html}</div></body></html>`,
      "utf8"
    );
    const png = join(OUT, `${name}.${theme}.png`);
    execFileSync(
      chrome,
      [
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--force-device-scale-factor=2",
        `--screenshot=${png}`,
        // +40px so a real overflow shows AS overflow instead of being cropped by the window.
        `--window-size=${width + 40},${height}`,
        `file:///${page.replace(/\\/g, "/")}`,
      ],
      { stdio: "pipe" }
    );
    written.push(png);
  }
}

console.log(`\n  ${written.length} image(s) in artifacts/visual/\n`);
for (const p of written) console.log(`    ${p.replace(ROOT, ".").replace(/\\/g, "/")}`);
console.log(
  "\n  These are not checked against anything. Open them.\n" +
    "  A test can assert a string is present while the layout is wrong, the colours are wrong,\n" +
    "  or the header sits under the list instead of above it. That is what these are for.\n"
);
