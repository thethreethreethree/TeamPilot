#!/usr/bin/env node
/**
 * gate — the single source of truth for "is this allowed to ship".
 *
 * Runs every check in order, writes .design/gate-report.json, and exits
 * non-zero if anything blocking remains. The Stop hook reads that report,
 * so an agent cannot end its turn on a failing build.
 *
 * Usage:
 *   node tools/gate.mjs                    # static gates only (fast)
 *   node tools/gate.mjs --url http://localhost:3000 --routes / /pricing
 *   node tools/gate.mjs --json
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const argv = process.argv.slice(2);
const asJson = argv.includes("--json");
const flag = (n) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : null;
};

const OUT_DIR = path.join(ROOT, ".design");
const REPORT = path.join(OUT_DIR, "gate-report.json");

const run = (args, opts = {}) =>
  spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT },
    maxBuffer: 32 * 1024 * 1024,
    ...opts,
  });

const gates = [];
const add = (id, name, status, detail, items = []) =>
  gates.push({ id, name, status, detail, items });

/**
 * Immediate subdirectories of ROOT that carry a package.json.
 *
 * The project root is not always the app root: a workspace opened on a parent
 * folder, or a monorepo, puts the app one level down. G2 already handled this
 * because design-lint walks the tree, but G3 and G4 looked only at ROOT — so on
 * that layout the token gate reported "no token file found" and the typecheck
 * reported "skip" forever. Both are gates that CANNOT RUN, which is materially
 * worse than a gate that fails: a skipped gate reads as an absence of problems.
 *
 * One level only; dot-directories and node_modules are skipped, so this never
 * wanders into a dependency's own package.
 */
const APP_DIRS = (() => {
  try {
    return fs
      .readdirSync(ROOT, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules")
      .map((e) => e.name)
      .filter((name) => fs.existsSync(path.join(ROOT, name, "package.json")));
  } catch {
    return [];
  }
})();

/* -------------------------------------------------- G1: design contract */

const contractPath = path.join(ROOT, "DESIGN-CONTRACT.md");
const hasContract = fs.existsSync(contractPath);
let contract = "";
if (hasContract) contract = fs.readFileSync(contractPath, "utf8");

if (!hasContract) {
  add("G1", "Design contract", "fail",
    "DESIGN-CONTRACT.md is missing. No art direction, no token derivation, nothing to verify against. Run /design-intake.");
} else {
  const required = ["direction", "color", "type", "navigation", "voice"];
  const missing = required.filter((k) => !new RegExp(`^\\s*${k}\\s*:`, "im").test(contract));
  // Catch every placeholder shape the template ships: <WORDS>, <#RRGGBB>,
  // <0-360>, <top-visible | …>, and bare <>.
  const unfilled = [
    ...contract.matchAll(/<>/g),
    ...contract.matchAll(/<((?:#RRGGBB|[A-Z0-9][^<>\n]{1,60}))>/g),
  ].map((m) => (m[1] || "<>").trim());
  if (missing.length) {
    add("G1", "Design contract", "fail",
      `DESIGN-CONTRACT.md is incomplete. Missing section(s): ${missing.join(", ")}`);
  } else if (unfilled.length) {
    add("G1", "Design contract", "fail",
      `DESIGN-CONTRACT.md still contains unfilled placeholders: ${[...new Set(unfilled)].slice(0, 6).join(", ")}`);
  } else {
    add("G1", "Design contract", "pass", "present and complete");
  }
}

/* ---------------------------------------------------- G2: static lint */

const lint = run([path.join(HERE, "design-lint.mjs"), "--json"]);
let lintData = null;
try {
  lintData = JSON.parse(lint.stdout || "{}");
} catch {
  lintData = null;
}
if (!lintData) {
  add("G2", "Design lint", "error", `design-lint did not produce output: ${(lint.stderr || "").slice(0, 300)}`);
} else if (lintData.blocking.length) {
  add("G2", "Design lint", "fail",
    `${lintData.blocking.length} blocking violation(s) across ${lintData.filesScanned} files`,
    lintData.blocking.map((b) => `${b.rule} ${b.file}:${b.line} — ${b.name}`));
} else {
  add("G2", "Design lint", "pass",
    `clean (${lintData.filesScanned} files, ${lintData.warnings.length} warnings)`,
    lintData.warnings.slice(0, 10).map((w) => `${w.rule} ${w.file}:${w.line} — ${w.name}`));
}

/* --------------------------------------------------- G3: token contrast */

// theme.ts FIRST. On an App-Edition project it is the file the app actually
// loads — React Native cannot evaluate oklch(), so token-gen --theme emits
// resolved hex there and the NativeWind config consumes it. This gate previously
// looked only for globals.css, which meant G3 on an Expo project either failed
// forever ("no globals.css found") or was satisfied by a legacy CSS file no
// screen imports: a token gate that never touched the app's real tokens.
const TOKEN_PATHS = [
  "theme.ts", "src/theme.ts", "lib/theme.ts", "styles/theme.ts",
  "app/globals.css", "src/app/globals.css", "styles/globals.css", "src/styles/globals.css",
];
const globals = [
  ...TOKEN_PATHS.map((p) => path.join(ROOT, p)),
  ...APP_DIRS.flatMap((dir) => TOKEN_PATHS.map((p) => path.join(ROOT, dir, p))),
].find((p) => fs.existsSync(p));

if (!globals) {
  add("G3", "Token contrast", hasContract ? "fail" : "skip",
    "no token file found. Generate one: node tools/token-gen.mjs --theme theme.ts " +
    "(React Native), or --out app/globals.css (web, legacy)");
} else {
  const tok = run([path.join(HERE, "contrast-audit.mjs"), "--file", globals, "--json"]);
  let data = null;
  try { data = JSON.parse(tok.stdout || "{}"); } catch { /* noop */ }
  if (!data) {
    add("G3", "Token contrast", "error", `contrast-audit failed: ${(tok.stderr || "").slice(0, 300)}`);
  } else if (data.failures?.length) {
    add("G3", "Token contrast", "fail",
      `${data.failures.length} token pair(s) below WCAG 2.2 AA`,
      data.failures.map((f) => `${f.theme}: ${f.fg} on ${f.bg} = ${f.ratio}:1 (min ${f.required})`));
  } else {
    add("G3", "Token contrast", "pass", `${data.checked} token pairs pass AA`);
  }
}

/* ------------------------------------------------------- G4: typecheck */

// Typecheck the app, wherever it is. ROOT first; otherwise the first subdirectory
// carrying BOTH a package.json and a tsconfig.json — the same one-level-down
// discovery G3 uses. tsc runs with cwd set to that directory so it reads the app's
// own tsconfig, its path aliases and its node_modules, exactly as running
// `npx tsc --noEmit` from inside the app would.
const tsRoot = [ROOT, ...APP_DIRS.map((d) => path.join(ROOT, d))].find(
  (dir) =>
    fs.existsSync(path.join(dir, "package.json")) &&
    fs.existsSync(path.join(dir, "tsconfig.json"))
);

if (!tsRoot) {
  const anyPkg = [ROOT, ...APP_DIRS.map((d) => path.join(ROOT, d))].some((dir) =>
    fs.existsSync(path.join(dir, "package.json"))
  );
  add("G4", "Typecheck", "skip", anyPkg ? "no tsconfig.json" : "no package.json");
} else {
  const where = path.relative(ROOT, tsRoot) || ".";
  const tsc = spawnSync("npx", ["--no-install", "tsc", "--noEmit"], {
    cwd: tsRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    // npx is a .cmd shim on Windows; without a shell, spawnSync cannot find it
    // and the gate reports "tsc unavailable" on a project whose types are fine.
    shell: process.platform === "win32",
  });
  if (tsc.status === 0) add("G4", "Typecheck", "pass", `tsc --noEmit clean (${where})`);
  else {
    const errs = (tsc.stdout || "").split("\n").filter((l) => /error TS/.test(l));
    add("G4", "Typecheck", errs.length ? "fail" : "skip",
      errs.length ? `${errs.length} TypeScript error(s) in ${where}` : `tsc unavailable in ${where}`,
      errs.slice(0, 10));
  }
}

/* ---------------------------------------------------- G5: runtime audit */

const url = flag("url");
if (url) {
  const routesIdx = argv.indexOf("--routes");
  const routes = [];
  if (routesIdx >= 0) {
    for (let i = routesIdx + 1; i < argv.length && !argv[i].startsWith("--"); i++) routes.push(argv[i]);
  }
  const rt = run([
    path.join(HERE, "runtime-audit.mjs"), "--url", url,
    ...(routes.length ? ["--routes", ...routes] : []), "--json",
  ]);
  let data = null;
  try { data = JSON.parse(rt.stdout || "{}"); } catch { /* noop */ }
  if (!data) {
    add("G5", "Runtime audit", "error",
      `runtime-audit failed (is the dev server running at ${url}?): ${(rt.stderr || "").slice(0, 300)}`);
  } else if (data.blocking.length) {
    add("G5", "Runtime audit", "fail",
      `${data.blocking.length} blocking issue(s) in the rendered page`,
      data.blocking.slice(0, 20).map((b) => `${b.route}@${b.viewport} ${b.gate}: ${b.detail}`));
  } else {
    add("G5", "Runtime audit", "pass",
      `rendered pages clean (${data.warnings.length} warnings)`,
      data.warnings.slice(0, 8).map((w) => `${w.route}@${w.viewport} ${w.gate}: ${w.detail}`));
  }
} else {
  add("G5", "Runtime audit", "skip",
    "not run. Start the dev server and re-run: node tools/gate.mjs --url http://localhost:3000");
}

/* ------------------------------------------------------------- verdict */

const failed = gates.filter((g) => g.status === "fail" || g.status === "error");
const skipped = gates.filter((g) => g.status === "skip");
const ok = failed.length === 0;

const report = {
  generatedAt: new Date().toISOString(),
  root: ROOT,
  ok,
  verdict: ok
    ? skipped.length
      ? "PASS (with skipped gates — runtime audit is required before shipping)"
      : "PASS"
    : "BLOCKED",
  gates,
  failedGateIds: failed.map((g) => g.id),
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const c = { pass: "\x1b[32m", fail: "\x1b[31m", error: "\x1b[31m", skip: "\x1b[2m" };
  const mark = { pass: "✓", fail: "✗", error: "✗", skip: "–" };
  console.log("\n\x1b[1mDESIGN GATE\x1b[0m\n");
  for (const g of gates) {
    console.log(`  ${c[g.status]}${mark[g.status]} ${g.id}  ${g.name.padEnd(18)}\x1b[0m ${g.detail}`);
    for (const it of g.items.slice(0, 12)) console.log(`        \x1b[2m${it}\x1b[0m`);
  }
  console.log(
    ok
      ? `\n\x1b[32m\x1b[1m${report.verdict}\x1b[0m\n`
      : `\n\x1b[31m\x1b[1mBLOCKED\x1b[0m — ${failed.length} gate(s) failed. Fix them, then re-run \x1b[1mnode tools/gate.mjs\x1b[0m\n`
  );
  console.log(`\x1b[2mreport: ${path.relative(ROOT, REPORT)}\x1b[0m\n`);
}

process.exit(ok ? 0 : 1);
