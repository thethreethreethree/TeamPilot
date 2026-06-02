#!/usr/bin/env node
// Pass 2: theme-aware migration of `text-white` and `hover:text-white`.
//
// Why this can't be a blind global replace: `text-white` is correct INSIDE
// elements whose background is a brand fill (crimson button, gradient logo,
// colored badge) — white-on-crimson works on both modes. But `text-white`
// on a theme-aware surface (bg-surface, bg-base) renders white-on-white in
// light mode → invisible. We have to inspect each className string.
//
// Strategy: tokenize className strings, decide per-string whether the
// element has a brand/fill background. If yes, leave text-white. If no,
// swap text-white → text-primary and hover:text-white → hover:text-primary.

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

// Class fragments that indicate a brand fill / opaque background on the
// SAME element — if any of these appear in a className together with
// `text-white`, the white stays.
const FILL_INDICATORS = [
  "bg-[#C8232C]",
  "bg-[#A91D24]",
  "bg-[#8A1820]",
  "bg-crimson",
  "bg-brand",
  "bg-gradient-to-",         // any gradient
  "bg-crimson-metallic",
  "bg-emerald-",
  "bg-amber-",
  "bg-violet-",
  "bg-blue-",
  "bg-red-",
  "bg-pink-",
  "bg-green-",
  "bg-yellow-",
  "bg-orange-",
  "bg-purple-",
  "bg-rose-",
  "bg-fuchsia-",
  "bg-indigo-",
  "bg-sky-",
  "bg-teal-",
  "bg-cyan-",
  "bg-black",
];

function hasFill(classString) {
  return FILL_INDICATORS.some((tok) => classString.includes(tok));
}

function swapInClassString(s) {
  if (hasFill(s)) return s; // intentional white-on-fill, leave alone
  let next = s;
  next = next.replace(/(^|\s)hover:text-white(\s|$)/g, "$1hover:text-primary$2");
  next = next.replace(/(^|\s)text-white(\s|$)/g, "$1text-primary$2");
  return next;
}

// Iterate over each className="..." (and className={"..."}) string and
// rewrite the contents in place. This regex handles double-quoted and
// template-literal className values; cn(...) and complex JS expressions
// inside braces are also covered because we still match any quoted string.
const CLASSNAME_RE =
  /(className\s*=\s*\{?)(["'`])([\s\S]*?)\2/g;
const QUOTED_STRING_INSIDE_CN_RE =
  /(["'`])((?:[^"'`\\]|\\.)+?)\1/g;

function rewriteFile(code) {
  // First, fast path: handle plain className="..." attrs.
  let mutated = code.replace(CLASSNAME_RE, (m, lead, q, body) => {
    return lead + q + swapInClassString(body) + q;
  });
  // Second pass: inside cn(...)/clsx(...) calls there are bare quoted
  // string literals that hold class fragments. Walk those too.
  mutated = mutated.replace(/\b(cn|clsx|cx|classNames)\s*\(([\s\S]*?)\)/g, (m, fn, args) => {
    const fixed = args.replace(QUOTED_STRING_INSIDE_CN_RE, (mm, q, body) => {
      // Heuristic: only rewrite if the body looks like Tailwind classes
      // (contains spaces, or a Tailwind-shaped token). Avoids touching
      // unrelated quoted strings (URLs, messages).
      if (!/\btext-white\b/.test(body)) return mm;
      return q + swapInClassString(body) + q;
    });
    return `${fn}(${fixed})`;
  });
  return mutated;
}

// ─── Apply ───────────────────────────────────────────────────────────

const files = execSync(
  "git ls-files src -- '*.ts' '*.tsx'",
  { encoding: "utf8" }
)
  .split("\n")
  .filter(Boolean);

let touched = 0;
let totalSwaps = 0;

for (const file of files) {
  const before = readFileSync(file, "utf8");
  if (!/text-white\b/.test(before)) continue;
  const after = rewriteFile(before);
  if (after !== before) {
    // Count text-white instances removed (rough indicator).
    const swaps =
      (before.match(/text-white\b/g) ?? []).length -
      (after.match(/text-white\b/g) ?? []).length;
    writeFileSync(file, after, "utf8");
    touched++;
    totalSwaps += swaps;
    console.log(`  ${file}  (${swaps} swapped)`);
  }
}

console.log("");
console.log(`✓ Swapped ${totalSwaps} text-white → text-primary across ${touched} files.`);
console.log(`  (text-white left in place anywhere a brand/colored fill was on the same element.)`);
