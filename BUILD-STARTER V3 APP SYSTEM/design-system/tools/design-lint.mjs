#!/usr/bin/env node
/**
 * design-lint — static enforcement of the Master Design Guide Line.
 *
 * Usage:
 *   node tools/design-lint.mjs                 # lint the whole project
 *   node tools/design-lint.mjs src/app/page.tsx
 *   node tools/design-lint.mjs --json          # machine output (used by hooks)
 *   node tools/design-lint.mjs --staged        # only git-staged files
 *
 * Exit codes:  0 clean · 1 blocking violations · 2 warnings only (with --strict)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, "rules.json"), "utf8"));

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const strict = args.includes("--strict");
const staged = args.includes("--staged");
const targets = args.filter((a) => !a.startsWith("--"));
const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();

/* ------------------------------------------------------------ file walk */

const SKIP_DIRS = new Set([
  "node_modules", ".next", ".git", "dist", "build", "out", "coverage",
  ".turbo", ".vercel", "public", ".design",
]);
const LINT_EXT = new Set([".tsx", ".jsx", ".ts", ".js", ".css", ".mjs"]);

function walk(dir, acc = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    if (e.name.startsWith(".") && e.name !== ".claude") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(p, acc);
    } else if (LINT_EXT.has(path.extname(e.name))) {
      acc.push(p);
    }
  }
  return acc;
}

/* --------------------------------------------------------------- helpers */

const rel = (p) => path.relative(ROOT, p) || p;

function lineOf(src, index) {
  return src.slice(0, index).split("\n").length;
}

function snippet(src, index, len = 90) {
  const start = src.lastIndexOf("\n", index) + 1;
  let end = src.indexOf("\n", index);
  if (end === -1) end = src.length;
  return src.slice(start, Math.min(end, start + len)).trim();
}

/** Strip comments and import lines so we don't flag prose or package names. */
function stripNoise(src) {
  // Blank comments but PRESERVE newlines — otherwise every reported line
  // number after a JSDoc header is wrong, and those numbers are what the
  // hooks feed back to the agent.
  const blank = (m) => m.replace(/[^\n]/g, " ");
  return src
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:/])\/\/[^\n]*/g, blank);
}

/**
 * Match a complete JSX opening tag, brace-aware.
 * A naive /<Tag[^>]*>/ is defeated by any arrow function in an attribute
 * (`onClick={() => x}`) — the `>` of `=>` terminates the match early, which
 * silently disables several rules and creates false positives on others.
 */
function jsxTags(src, tagPattern) {
  const out = [];
  const open = new RegExp(`<(${tagPattern})(?=[\\s/>])`, "g");
  let m;
  while ((m = open.exec(src))) {
    let i = open.lastIndex;
    let depth = 0;
    let quote = null;
    while (i < src.length) {
      const c = src[i];
      if (quote) {
        if (c === quote && src[i - 1] !== "\\") quote = null;
      } else if (c === '"' || c === "'" || c === "`") {
        quote = c;
      } else if (c === "{") {
        depth++;
      } else if (c === "}") {
        depth--;
      } else if (c === ">" && depth === 0) {
        break;
      }
      i++;
    }
    out.push({ index: m.index, tag: m[1], text: src.slice(m.index, i + 1) });
    open.lastIndex = i + 1;
  }
  return out;
}

/**
 * Single-pass glob -> RegExp. Must be one pass: sequential .replace() calls
 * corrupt the regex syntax they themselves introduce (a `?` replacement will
 * eat the `?` in a `(?:...)` group created a step earlier).
 */
const globCache = new Map();
function globToRegExp(pattern) {
  if (globCache.has(pattern)) return globCache.get(pattern);
  let out = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "*") {
      if (pattern[i + 1] === "*") {
        if (pattern[i + 2] === "/") {
          out += "(?:[^/]*\\/)*"; // **/ matches zero or more path segments
          i += 2;
        } else {
          out += ".*";
          i += 1;
        }
      } else {
        out += "[^/]*";
      }
    } else if (c === "?") {
      out += "[^/]";
    } else if (".+^${}()|[]\\".includes(c)) {
      out += "\\" + c;
    } else {
      out += c;
    }
  }
  const re = new RegExp(`^${out}$`);
  globCache.set(pattern, re);
  return re;
}

function globMatch(pattern, filePath) {
  return globToRegExp(pattern).test(filePath.split(path.sep).join("/"));
}

/** Detectors that examine the project as a whole, not one file at a time. */
const PROJECT_LEVEL = new Set(["contract-required", "file-must-not-exist"]);

function applies(rule, filePath) {
  const r = rel(filePath).split(path.sep).join("/");
  if (rule.excludes?.some((g) => globMatch(g, r))) return false;
  if (rule.allowIn?.some((g) => globMatch(g, r))) return false;
  if (!rule.appliesTo || rule.appliesTo.includes("*")) return true;
  return rule.appliesTo.some((g) => globMatch(g, r));
}

/* ------------------------------------------------------- custom detectors */

const detectors = {
  /** JSX <input>/<Input> with a placeholder but no id/aria-label to bind a label. */
  "jsx-input-without-label"(src) {
    const out = [];
    for (const t of jsxTags(src, "input|Input|textarea|Textarea")) {
      if (!/\bplaceholder=/.test(t.text)) continue;
      if (/\btype=["'](?:hidden|submit|button)["']/.test(t.text)) continue;
      if (/\bid=/.test(t.text) || /\baria-label(?:ledby)?=/.test(t.text)) continue;
      out.push(t.index);
    }
    return out;
  },

  /** <div onClick> and friends — invisible to keyboard and AT. */
  "clickable-non-control"(src) {
    const out = [];
    for (const t of jsxTags(src, "div|span|li|td|p|section|article|header|footer|nav")) {
      if (!/\son(?:Click|MouseDown|MouseUp)\s*=/.test(t.text)) continue;
      // Acceptable when it has been given a role AND keyboard access
      const hasRole = /\brole=["'](?:button|link|tab|menuitem|option|switch)["']/.test(t.text);
      const hasTab = /\btabIndex=\{?\s*0/.test(t.text);
      const hasKey = /\sonKey(?:Down|Up|Press)\s*=/.test(t.text);
      if (hasRole && hasTab && hasKey) continue;
      out.push(t.index);
    }
    return out;
  },

  /**
   * Images carrying no accessible name at all.
   *
   * React Native has no `alt` convention the way the web does. The accessible
   * name comes from `accessibilityLabel`; `alt` is accepted too because
   * expo-image and RN 0.73+ alias it. And an image can legitimately have NO name
   * when it is decorative, provided it is explicitly hidden from assistive tech —
   * announcing "expo-logo.png" is worse than announcing nothing.
   *
   * Requiring `alt` alone (the web rule this started as) rejected the API the
   * design law itself recommends first, so correct RN code failed the gate.
   */
  "image-without-alt"(src) {
    const out = [];
    for (const t of jsxTags(src, "img|Image")) {
      const named =
        /(?:^|\s)alt\s*=/.test(t.text) ||
        /(?:^|\s)accessibilityLabel\s*=/.test(t.text) ||
        /(?:^|\s)aria-label\s*=/.test(t.text);
      const decorative =
        /(?:^|\s)accessibilityElementsHidden(?:\s|=|\/|>)/.test(t.text) ||
        /(?:^|\s)importantForAccessibility\s*=\s*["'{]?\s*(?:no|no-hide-descendants)/.test(t.text) ||
        /(?:^|\s)aria-hidden(?:\s|=|\/|>)/.test(t.text) ||
        /(?:^|\s)accessible\s*=\s*\{?\s*false/.test(t.text);
      if (!named && !decorative) out.push(t.index);
    }
    return out;
  },

  /** next/image `priority` — deprecated in Next 16. */
  "image-priority-prop"(src) {
    const out = [];
    for (const t of jsxTags(src, "Image")) {
      if (/\spriority(?:\s|=|\/|>)/.test(t.text)) out.push(t.index);
    }
    return out;
  },

  /** fill or responsive images without `sizes`. */
  "image-without-sizes"(src) {
    const out = [];
    for (const t of jsxTags(src, "Image")) {
      if (!/\sfill(?:\s|=|\/|>)/.test(t.text)) continue;
      if (/\ssizes\s*=/.test(t.text)) continue;
      out.push(t.index);
    }
    return out;
  },

  /** target="_blank" without rel. */
  "blank-without-rel"(src) {
    const out = [];
    for (const t of jsxTags(src, "a|Link")) {
      if (!/\starget=["']_blank["']/.test(t.text)) continue;
      if (/\srel\s*=/.test(t.text)) continue;
      out.push(t.index);
    }
    return out;
  },

  /**
   * FIX for the previously dead DS-021: find interactive elements sized below
   * the 24px floor. The old lookahead required "onClick"/"Button" to appear
   * after the class without crossing a quote, which never happens in real JSX.
   */
  "small-tap-target"(src) {
    const SMALL = /\b(?:h|w|size)-(?:0\.5|1|1\.5|2|2\.5|3|3\.5|4|5)\b/;
    const out = [];
    for (const t of jsxTags(src, "button|Button|a|Link|input|Input|[A-Z][A-Za-z]*Trigger")) {
      const cls = t.text.match(/className=(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/);
      const value = cls ? cls[1] ?? cls[2] ?? cls[3] ?? "" : "";
      if (!value || !SMALL.test(value)) continue;
      // A small icon inside a properly sized control is fine; we only flag
      // when the CONTROL itself is small.
      if (/\b(?:h|size)-(?:9|10|11|12|14|16)\b|\bmin-h-/.test(value)) continue;
      out.push(t.index);
    }
    return out;
  },

  /**
   * globals.css must carry a reduced-motion block.
   * Only fires when a specific file is linted (hooks path); the whole-project
   * run handles it in projectChecks() so it is never reported twice.
   */
  "requires-reduced-motion-block"(src, file) {
    if (!/globals\.css$/.test(file)) return [];
    if (!targets.length && !staged) return [];
    return /prefers-reduced-motion/.test(src) ? [] : [0];
  },

  "file-must-not-exist"(_src, file) {
    return fs.existsSync(file) ? [0] : [];
  },

  /** Emoji inside JSX text or as a child, not in a string used for copy. */
  "emoji-in-jsx"(src) {
    const out = [];
    // Pictographic emoji only. Deliberately excludes typographic marks that
    // live in the same blocks — check marks, stars, arrows, (tm), (r).
    const emoji =
      /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}]/gu;
    const re = />\s*([^<>{}\n]{0,40})</g;
    let m;
    while ((m = re.exec(src))) {
      if (emoji.test(m[1])) out.push(m.index);
      emoji.lastIndex = 0;
    }
    return out;
  },

  /**
   * Primary nav hidden behind a toggle at all breakpoints.
   * Flags a menu/hamburger trigger that is NOT constrained to small screens.
   */
  "desktop-hamburger"(src) {
    const out = [];
    const re =
      /<(?:button|Button|SheetTrigger|DrawerTrigger)\b[^>]*>(?:[\s\S]{0,200}?)(?:Menu|Hamburger|AlignJustify|PanelLeft)\b/g;
    let m;
    while ((m = re.exec(src))) {
      const around = src.slice(Math.max(0, m.index - 300), m.index + 300);
      // Acceptable when explicitly hidden from md: upward
      const scopedToMobile =
        /\bmd:hidden\b|\blg:hidden\b|\bsm:hidden\b/.test(around);
      if (!scopedToMobile) out.push(m.index);
    }
    return out;
  },

  /** Long prose blocks with no measure constraint anywhere in the file. */
  "prose-without-measure"(src) {
    const hasMeasure =
      /max-w-(?:prose|(?:\d?xl)|sm|md|lg|screen-[a-z]+|\[[^\]]+\])/.test(src);
    if (hasMeasure) return [];
    const out = [];
    const re = /<p\b[^>]*>([\s\S]{200,}?)<\/p>/g;
    let m;
    while ((m = re.exec(src))) out.push(m.index);
    return out;
  },

  /** More than one default-variant Button in a single file. */
  "multiple-primary-cta"(src) {
    // Scope to a single component's return block rather than the whole file,
    // so three separate one-CTA components are not flagged.
    const out = [];
    const blocks = [...src.matchAll(/\breturn\s*\(/g)];
    const bounds = blocks.map((b, i) => [
      b.index,
      i + 1 < blocks.length ? blocks[i + 1].index : src.length,
    ]);
    if (!bounds.length) bounds.push([0, src.length]);
    for (const [start, end] of bounds) {
      const region = src.slice(start, end);
      const primaries = jsxTags(region, "Button").filter(
        (t) => !/variant=["'](?:secondary|outline|ghost|link|destructive)["']/.test(t.text)
      );
      if (primaries.length > 1) out.push(start + primaries[1].index);
    }
    return out;
  },

  /** DESIGN-CONTRACT.md must exist before UI files may be written. */
  "contract-required"() {
    const p = path.join(ROOT, "DESIGN-CONTRACT.md");
    return fs.existsSync(p) ? [] : [0];
  },
};

/* ------------------------------------------------------------- validators */

const validators = {
  divisibleBy4: (captured) => {
    const n = parseFloat(captured);
    return Number.isFinite(n) && n % 4 === 0;
  },
};

/* ------------------------------------------------------------------ lint */

function lintFile(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return [];
  }
  const src = stripNoise(raw);
  const findings = [];

  for (const rule of RULES.rules) {
    const d = rule.detect || {};
    if (PROJECT_LEVEL.has(d.type)) continue; // handled once, in projectChecks()
    if (!applies(rule, file)) continue;

    if (d.type === "regex") {
      const re = new RegExp(d.pattern, "gu");
      let m;
      while ((m = re.exec(src))) {
        // Optional value validation (e.g. spacing must be divisible by 4)
        if (rule.validate) {
          const captured = m.slice(1).find((g) => g != null);
          if (captured != null && validators[rule.validate]?.(captured)) continue;
        }
        // Optional "must have X nearby" escape (e.g. outline-none + focus-visible)
        if (rule.requireNearby) {
          const w = rule.nearbyWindow ?? 300;
          const around = src.slice(
            Math.max(0, m.index - w),
            Math.min(src.length, m.index + w)
          );
          if (new RegExp(rule.requireNearby).test(around)) continue;
        }
        findings.push({
          rule: rule.id,
          name: rule.name,
          severity: rule.severity,
          file: rel(file),
          line: lineOf(src, m.index),
          snippet: snippet(raw, m.index),
          fix: rule.fix,
        });
      }
    } else if (detectors[d.type]) {
      for (const idx of detectors[d.type](src, file)) {
        findings.push({
          rule: rule.id,
          name: rule.name,
          severity: rule.severity,
          file: rel(file),
          line: lineOf(src, idx),
          snippet: snippet(raw, idx),
          fix: rule.fix,
        });
      }
    }
  }
  return findings;
}

/* -------------------------------------------------------- project checks */

function projectChecks() {
  const findings = [];

  // DS-019 (App Edition): NativeWind REQUIRES a tailwind.config, so the web
  // "config must not exist" check is removed. The single source of truth is
  // theme.ts, generated from the contract (see rules.json DS-019).

  // DS-025: contract must exist if any UI source is present
  const contract = path.join(ROOT, "DESIGN-CONTRACT.md");
  if (!fs.existsSync(contract)) {
    const hasUi = walk(ROOT).some((f) => /\.(tsx|jsx)$/.test(f));
    if (hasUi) {
      const rule = RULES.rules.find((r) => r.id === "DS-025");
      findings.push({
        rule: rule.id, name: rule.name, severity: rule.severity,
        file: "DESIGN-CONTRACT.md", line: 0,
        snippet: "(missing)", fix: rule.fix,
      });
    }
  }

  // DS-016 (App Edition): React Native has no globals.css reduced-motion block —
  // Reduce Motion is honoured in code (useReducedMotion / AccessibilityInfo) and
  // verified on-device, not by the linter (see rules.json DS-016).

  return findings;
}

/* ---------------------------------------------------------- waiver logic */

/**
 * Waivers come from two places, and ONLY these two. A previous version fell
 * back to scanning the whole contract, which meant prose such as "we never
 * violate DS-001" silently disabled that rule project-wide.
 *
 *   1. the `waivers:` key in the YAML frontmatter — inline list or block list
 *   2. rows of the "## Waivers" table, first column
 *
 * Waiver root is separate from lint root: the PreToolUse hook lints a temp
 * copy of the proposed file, but waivers must still be read from the real
 * project. Without this, waivers are ignored at write time and an agent
 * following the block message's own advice can never unblock itself.
 */
function loadWaivers() {
  const root = process.env.MDGL_WAIVER_ROOT || ROOT;
  const p = path.join(root, "DESIGN-CONTRACT.md");
  if (!fs.existsSync(p)) return new Set();
  const src = fs.readFileSync(p, "utf8");
  const ids = new Set();
  const RULE = /\b((?:DS|BAN)-\d{2,3})\b/g;

  // 1. frontmatter
  const fm = src.match(/^---\n([\s\S]*?)\n---/);
  if (fm) {
    const inline = fm[1].match(/^waivers:[ \t]*(\[[^\]]*\])[ \t]*$/m);
    if (inline) {
      for (const m of inline[1].matchAll(RULE)) ids.add(m[1]);
    } else {
      const block = fm[1].match(/^waivers:[ \t]*\n((?:[ \t]+-[^\n]*\n?)*)/m);
      if (block) for (const m of block[1].matchAll(RULE)) ids.add(m[1]);
    }
  }

  // 2. the Waivers table — first cell of each row only
  const table = src.match(/^##+\s*(?:\d+\.\s*)?Waivers\s*$([\s\S]*?)(?=^##\s|\Z)/m);
  if (table) {
    for (const line of table[1].split("\n")) {
      const cell = line.match(/^\|\s*`?((?:DS|BAN)-\d{2,3})`?\s*\|/);
      if (cell) ids.add(cell[1]);
    }
  }
  return ids;
}

/* ------------------------------------------------------------------ main */

async function main() {
  let files;
  if (staged) {
    const { spawnSync } = await import("node:child_process");
    const r = spawnSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACM"], {
      cwd: ROOT, encoding: "utf8",
    });
    files = (r.stdout || "")
      .split("\n")
      .map((f) => f.trim())
      .filter((f) => f && LINT_EXT.has(path.extname(f)))
      .map((f) => path.resolve(ROOT, f))
      .filter((f) => fs.existsSync(f));
  } else if (targets.length) {
    files = targets.map((t) => path.resolve(ROOT, t)).filter((f) => fs.existsSync(f));
  } else {
    files = walk(ROOT);
  }

  const waived = loadWaivers();
  let findings = [...files.flatMap(lintFile)];
  if (!targets.length) findings.push(...projectChecks());

  findings = findings.map((f) =>
    waived.has(f.rule) ? { ...f, severity: "waived" } : f
  );

  const blocking = findings.filter((f) => f.severity === "block");
  const warnings = findings.filter((f) => f.severity === "warn");

  if (asJson) {
    process.stdout.write(
      JSON.stringify(
        { ok: blocking.length === 0, filesScanned: files.length, blocking, warnings },
        null,
        2
      )
    );
  } else {
    const bold = (s) => `\x1b[1m${s}\x1b[0m`;
    const red = (s) => `\x1b[31m${s}\x1b[0m`;
    const yel = (s) => `\x1b[33m${s}\x1b[0m`;
    const dim = (s) => `\x1b[2m${s}\x1b[0m`;

    const print = (list, colour, label) => {
      if (!list.length) return;
      console.log(`\n${bold(colour(label))}\n`);
      for (const f of list) {
        console.log(`  ${colour(f.rule)}  ${f.file}:${f.line}  ${bold(f.name)}`);
        if (f.snippet) console.log(`    ${dim(f.snippet)}`);
        console.log(`    ${dim("→ " + f.fix)}\n`);
      }
    };

    print(blocking, red, `BLOCKING (${blocking.length})`);
    print(warnings, yel, `WARNINGS (${warnings.length})`);

    if (!blocking.length && !warnings.length) {
      console.log(`\n\x1b[32m✓ design-lint clean\x1b[0m  (${files.length} files)\n`);
    } else {
      console.log(
        dim(`\n${files.length} files scanned · ${blocking.length} blocking · ${warnings.length} warnings\n`)
      );
    }
  }

  if (blocking.length) process.exit(1);
  if (strict && warnings.length) process.exit(2);
  process.exit(0);
}

await main();
