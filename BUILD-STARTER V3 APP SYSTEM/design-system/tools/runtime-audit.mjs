#!/usr/bin/env node
/**
 * runtime-audit — checks that only exist once the UI is rendered.
 *
 * ⚠️ APP EDITION NOTE: this is the WEB (headless-browser) auditor and does NOT
 * apply to a React Native app — there is no page/URL to open. In the App Edition
 * the runtime gate is an ON-DEVICE check: run the core flow on a real iOS and
 * Android device, and for an automated pass use a device harness (Detox / Maestro)
 * — (verify current). `gate.mjs` only invokes this when a `--url` is passed, so it
 * simply stays skipped for an RN build; a skipped device check is not a pass.
 * This file is retained unchanged for any web target and as the reference shape.
 *
 * (Web) Static linting cannot see: horizontal overflow, computed contrast after
 * cascade, real tap-target boxes, focus visibility, heading order in the DOM,
 * or layout shift. This does.
 *
 * Requires (web only): npm i -D playwright @axe-core/playwright
 *
 * Usage:
 *   node tools/runtime-audit.mjs --url http://localhost:3000 --routes / /pricing
 *   node tools/runtime-audit.mjs --url http://localhost:3000 --json
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const argv = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d;
};
const listFlag = (n) => {
  const i = argv.indexOf(`--${n}`);
  if (i < 0) return null;
  const out = [];
  for (let j = i + 1; j < argv.length && !argv[j].startsWith("--"); j++) out.push(argv[j]);
  return out.length ? out : null;
};
const asJson = argv.includes("--json");

const BASE = flag("url", "http://localhost:3000").replace(/\/$/, "");
const ROUTES = listFlag("routes") || ["/"];
const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

const GATES = JSON.parse(
  fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), "rules.json"), "utf8")
).gates;

/* ------------------------------------------------------------ in-page checks */

/**
 * Everything inside this function runs in the browser. It must be
 * self-contained — no closures over Node scope.
 */
function collectPageFacts() {
  const out = {
    overflow: null,
    smallTargets: [],
    tinyText: [],
    longMeasures: [],
    headingOrder: [],
    landmarks: {},
    focusables: 0,
    invisibleFocus: [],
    primaryCtas: 0,
    stickyHeaderPct: 0,
    imagesWithoutDims: [],
  };

  const doc = document.documentElement;
  out.overflow = Math.max(0, doc.scrollWidth - doc.clientWidth);

  const vis = (el) => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || s.opacity === "0") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const label = (el) => {
    const t = (el.innerText || el.textContent || "").trim().slice(0, 40);
    return t || el.getAttribute("aria-label") || el.tagName.toLowerCase();
  };

  const selector = (el) => {
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" && el.className
      ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
      : "";
    return `${el.tagName.toLowerCase()}${id}${cls}`;
  };

  /* --- tap targets (WCAG 2.5.8: 24x24 CSS px, with a spacing exception) --- */
  const interactive = [
    ...document.querySelectorAll(
      'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [tabindex]:not([tabindex="-1"])'
    ),
  ].filter(vis);

  out.focusables = interactive.length;

  const boxes = interactive.map((el) => ({ el, r: el.getBoundingClientRect() }));

  for (const { el, r } of boxes) {
    if (r.width >= 24 && r.height >= 24) continue;
    // Inline-in-text exception: a link inside a paragraph is exempt
    const parentTag = el.parentElement?.tagName?.toLowerCase();
    const inline = ["p", "li", "span", "td", "label", "figcaption"].includes(parentTag);
    if (inline && el.tagName.toLowerCase() === "a") continue;
    // Spacing exception: a 24px circle on this target must not touch another
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const crowded = boxes.some(
      (o) =>
        o.el !== el &&
        Math.hypot(cx - (o.r.left + o.r.width / 2), cy - (o.r.top + o.r.height / 2)) < 24
    );
    if (!crowded) continue;
    out.smallTargets.push({
      selector: selector(el),
      label: label(el),
      width: Math.round(r.width),
      height: Math.round(r.height),
    });
  }

  /* --- text size + measure --- */
  const textNodes = [...document.querySelectorAll("p, li, span, td, dd, blockquote, a")].filter(vis);
  for (const el of textNodes) {
    const s = getComputedStyle(el);
    const size = parseFloat(s.fontSize);
    const text = (el.innerText || "").trim();
    if (!text || text.length < 40) continue;
    if (size < 14) {
      out.tinyText.push({ selector: selector(el), px: Math.round(size * 10) / 10, sample: text.slice(0, 50) });
    }
    // characters per line ~= width / (0.5 * fontSize)
    const cpl = el.getBoundingClientRect().width / (size * 0.5);
    if (cpl > 85 && text.length > 200) {
      out.longMeasures.push({ selector: selector(el), cpl: Math.round(cpl) });
    }
  }

  /* --- heading order --- */
  const heads = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter(vis);
  let prev = 0;
  for (const h of heads) {
    const lvl = Number(h.tagName[1]);
    if (prev && lvl > prev + 1) {
      out.headingOrder.push({ from: `h${prev}`, to: `h${lvl}`, text: label(h) });
    }
    prev = lvl;
  }
  out.h1Count = document.querySelectorAll("h1").length;

  /* --- landmarks --- */
  out.landmarks = {
    main: document.querySelectorAll('main, [role="main"]').length,
    nav: document.querySelectorAll('nav, [role="navigation"]').length,
    header: document.querySelectorAll('header, [role="banner"]').length,
    footer: document.querySelectorAll('footer, [role="contentinfo"]').length,
  };

  /* --- sticky header footprint --- */
  const sticky = [...document.querySelectorAll("*")].filter((el) => {
    const s = getComputedStyle(el);
    return (s.position === "sticky" || s.position === "fixed") && el.getBoundingClientRect().top <= 1;
  });
  if (sticky.length) {
    const tallest = Math.max(...sticky.map((el) => el.getBoundingClientRect().height));
    out.stickyHeaderPct = Math.round((tallest / window.innerHeight) * 100);
  }

  /* --- images without intrinsic dimensions (CLS risk) --- */
  for (const img of document.querySelectorAll("img")) {
    const hasDims = img.getAttribute("width") && img.getAttribute("height");
    const s = getComputedStyle(img);
    const hasRatio = s.aspectRatio && s.aspectRatio !== "auto";
    if (!hasDims && !hasRatio) {
      out.imagesWithoutDims.push({ src: (img.currentSrc || img.src || "").slice(-60) });
    }
  }

  return out;
}

/** Focus visibility: tab through and confirm something actually changes. */
function focusProbeScript() {
  return (el) => {
    const before = getComputedStyle(el);
    const snap = {
      outline: before.outlineStyle + before.outlineWidth + before.outlineColor,
      shadow: before.boxShadow,
      border: before.borderColor,
      bg: before.backgroundColor,
    };
    el.focus();
    const after = getComputedStyle(el);
    const changed =
      snap.outline !== after.outlineStyle + after.outlineWidth + after.outlineColor ||
      snap.shadow !== after.boxShadow ||
      snap.border !== after.borderColor ||
      snap.bg !== after.backgroundColor;
    return changed;
  };
}

/* ------------------------------------------------------------------- main */

async function main() {
  let chromium, AxeBuilder;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error(
      "runtime-audit: playwright is not installed.\n" +
        "  npm i -D playwright && npx playwright install chromium"
    );
    process.exit(3);
  }
  try {
    AxeBuilder = (await import("@axe-core/playwright")).default;
  } catch {
    AxeBuilder = null;
  }

  const launchOpts = {};
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) {
    launchOpts.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  }
  const browser = await chromium.launch(launchOpts);
  const results = [];

  for (const route of ROUTES) {
    for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
      });
      const page = await ctx.newPage();
      const url = `${BASE}${route}`;
      const issues = [];

      try {
        const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
        if (!resp || !resp.ok()) {
          issues.push({ gate: "reachable", severity: "block", detail: `HTTP ${resp?.status() ?? "no response"}` });
          results.push({ route, viewport: vp.name, issues });
          await ctx.close();
          continue;
        }
      } catch (e) {
        issues.push({ gate: "reachable", severity: "block", detail: String(e.message).slice(0, 140) });
        results.push({ route, viewport: vp.name, issues });
        await ctx.close();
        continue;
      }

      await page.waitForTimeout(400);
      const facts = await page.evaluate(collectPageFacts);

      /* -------- gate: horizontal overflow -------- */
      if (facts.overflow > GATES.layout.maxHorizontalOverflowPx) {
        issues.push({
          gate: "no-horizontal-scroll",
          severity: "block",
          detail: `page scrolls ${facts.overflow}px sideways at ${vp.width}px`,
        });
      }

      /* -------- gate: tap targets -------- */
      for (const t of facts.smallTargets.slice(0, 12)) {
        issues.push({
          gate: "tap-target",
          severity: "block",
          detail: `${t.width}x${t.height}px (min 24) — ${t.selector} "${t.label}"`,
        });
      }

      /* -------- gate: body text size -------- */
      for (const t of facts.tinyText.slice(0, 8)) {
        issues.push({
          gate: "text-size",
          severity: t.px < 12 ? "block" : "warn",
          detail: `${t.px}px — ${t.selector} "${t.sample}"`,
        });
      }

      /* -------- gate: measure -------- */
      for (const m of facts.longMeasures.slice(0, 6)) {
        issues.push({
          gate: "measure",
          severity: "warn",
          detail: `~${m.cpl} characters per line (max ${GATES.layout.maxProseMeasureCh}) — ${m.selector}`,
        });
      }

      /* -------- gate: document structure -------- */
      if (facts.h1Count === 0) {
        issues.push({ gate: "heading-structure", severity: "block", detail: "no <h1> on the page" });
      } else if (facts.h1Count > 1) {
        issues.push({ gate: "heading-structure", severity: "warn", detail: `${facts.h1Count} <h1> elements` });
      }
      for (const s of facts.headingOrder.slice(0, 5)) {
        issues.push({
          gate: "heading-structure",
          severity: "warn",
          detail: `skipped level ${s.from} → ${s.to} at "${s.text}"`,
        });
      }
      if (!facts.landmarks.main) {
        issues.push({ gate: "landmarks", severity: "block", detail: "no <main> landmark" });
      }
      if (!facts.landmarks.nav) {
        issues.push({ gate: "landmarks", severity: "warn", detail: "no <nav> landmark" });
      }

      /* -------- gate: sticky header footprint -------- */
      if (facts.stickyHeaderPct > 12) {
        issues.push({
          gate: "sticky-header",
          severity: "warn",
          detail: `sticky header occupies ${facts.stickyHeaderPct}% of the viewport (max 12%)`,
        });
      }

      /* -------- gate: CLS risk -------- */
      for (const i of facts.imagesWithoutDims.slice(0, 6)) {
        issues.push({
          gate: "cls-risk",
          severity: "warn",
          detail: `image with no width/height or aspect-ratio: ${i.src}`,
        });
      }

      /* -------- gate: focus visibility -------- */
      const focusFails = await page.evaluate(() => {
        const probe = (el) => {
          const g = (n) => {
            const s = getComputedStyle(n);
            return [s.outlineStyle, s.outlineWidth, s.outlineColor, s.boxShadow, s.borderColor, s.backgroundColor].join("|");
          };
          const before = g(el);
          el.focus();
          const after = g(el);
          return before !== after;
        };
        const els = [
          ...document.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea'),
        ].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        const bad = [];
        for (const el of els.slice(0, 40)) {
          if (!probe(el)) {
            bad.push(
              el.tagName.toLowerCase() +
                ":" +
                ((el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 30) || "(no label)")
            );
          }
        }
        return bad;
      });
      for (const f of focusFails.slice(0, 8)) {
        issues.push({
          gate: "focus-visible",
          severity: "block",
          detail: `no visible focus change on ${f}`,
        });
      }

      /* -------- gate: axe (WCAG 2.2 AA) -------- */
      if (AxeBuilder) {
        try {
          const axe = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
            .analyze();
          for (const v of axe.violations) {
            issues.push({
              gate: "axe",
              severity: v.impact === "critical" || v.impact === "serious" ? "block" : "warn",
              detail: `${v.id} (${v.impact}) ×${v.nodes.length} — ${v.help}`,
            });
          }
        } catch (e) {
          issues.push({ gate: "axe", severity: "warn", detail: `axe failed: ${String(e.message).slice(0, 100)}` });
        }
      }

      /* -------- gate: reduced motion honoured -------- */
      if (vp.name === "desktop") {
        const rmCtx = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          reducedMotion: "reduce",
        });
        const rmPage = await rmCtx.newPage();
        try {
          await rmPage.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
          const animating = await rmPage.evaluate(() => {
            const long = [];
            for (const el of document.querySelectorAll("*")) {
              const s = getComputedStyle(el);
              const dur =
                parseFloat(s.animationDuration || "0") * (s.animationDuration.includes("ms") ? 1 : 1000) +
                parseFloat(s.transitionDuration || "0") * (s.transitionDuration.includes("ms") ? 1 : 1000);
              if (dur > 100 && s.animationName !== "none") long.push(el.tagName.toLowerCase());
              if (long.length > 3) break;
            }
            return long;
          });
          if (animating.length) {
            issues.push({
              gate: "reduced-motion",
              severity: "block",
              detail: `animations still running under prefers-reduced-motion: ${animating.join(", ")}`,
            });
          }
        } catch {
          /* non-fatal */
        }
        await rmCtx.close();
      }

      results.push({ route, viewport: vp.name, issues, facts: { focusables: facts.focusables } });
      await ctx.close();
    }
  }

  await browser.close();

  const all = results.flatMap((r) => r.issues.map((i) => ({ ...r, ...i, issues: undefined })));
  const blocking = all.filter((i) => i.severity === "block");
  const warnings = all.filter((i) => i.severity === "warn");

  if (asJson) {
    console.log(JSON.stringify({ ok: blocking.length === 0, base: BASE, blocking, warnings }, null, 2));
  } else {
    const red = (s) => `\x1b[31m${s}\x1b[0m`;
    const yel = (s) => `\x1b[33m${s}\x1b[0m`;
    const dim = (s) => `\x1b[2m${s}\x1b[0m`;
    console.log(`\n\x1b[1mRuntime audit\x1b[0m  ${BASE}  ${ROUTES.join(" ")}\n`);
    for (const r of results) {
      const b = r.issues.filter((i) => i.severity === "block").length;
      const w = r.issues.filter((i) => i.severity === "warn").length;
      const mark = b ? red("✗") : w ? yel("!") : "\x1b[32m✓\x1b[0m";
      console.log(`  ${mark} ${r.route} @ ${r.viewport}  ${dim(`${b} blocking, ${w} warnings`)}`);
      for (const i of r.issues) {
        const c = i.severity === "block" ? red : yel;
        console.log(`      ${c(i.gate)}  ${i.detail}`);
      }
    }
    console.log(
      `\n${blocking.length ? red(`${blocking.length} blocking`) : "\x1b[32m0 blocking\x1b[0m"} · ${warnings.length} warnings\n`
    );
  }

  process.exit(blocking.length ? 1 : 0);
}

main().catch((e) => {
  console.error("runtime-audit failed:", e);
  process.exit(3);
});
