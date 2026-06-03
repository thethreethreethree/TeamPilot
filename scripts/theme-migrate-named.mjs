#!/usr/bin/env node
// Pass 3: migrate the *named* Tailwind scale references that the first
// two passes missed — `bg-navy-900`, `text-navy-300`, `border-navy-700`,
// `text-crimson-400`, etc. These compile to literal navy/crimson colors
// regardless of theme, just like `bg-[#0A1429]` did.
//
// Plus literal stragglers the first audit revealed:
//   divide-[#1a1d2e], placeholder-[#3a3f5c]
//
// Lockstep-paired the same way as theme-migrate.mjs.

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const MAP = [
  // ── Surfaces (named navy scale → semantic) ──
  // Order: longer patterns FIRST so `bg-navy-800/50` matches before
  // `bg-navy-800`. JS Array literal order is preserved by Object.entries.
  ["bg-navy-900", "bg-base"],
  ["bg-navy-800", "bg-surface"],
  ["bg-navy-700", "bg-surface-raised"],
  ["bg-navy-600", "bg-surface-raised"],

  // ── Borders ──
  ["border-navy-700", "border-default"],
  ["border-navy-600", "border-default"],
  ["border-navy-500", "border-strong"],
  ["border-navy-400", "border-strong"],

  // ── Text ──
  ["text-navy-100", "text-primary"],
  ["text-navy-200", "text-secondary"],
  ["text-navy-300", "text-muted"],
  ["text-navy-400", "text-secondary"],

  // ── Placeholder ──
  ["placeholder-navy-300", "placeholder:text-muted"],
  ["placeholder-navy-400", "placeholder:text-muted"],
  ["placeholder-[#3a3f5c]", "placeholder:text-muted"],

  // ── Divide ──
  ["divide-[#1a1d2e]", "divide-default"],
  ["divide-navy-700", "divide-default"],
  ["divide-navy-600", "divide-default"],

  // ── Contrast-aware brand text (was always-bright crimson) ──
  ["text-crimson-400", "text-brand"],
  ["text-crimson-300", "text-brand"],
  ["text-crimson-500", "text-brand"],
];

const files = execSync(
  "git ls-files src -- '*.ts' '*.tsx'",
  { encoding: "utf8" }
)
  .split("\n")
  .filter(Boolean)
  // Untracked chats pages from Phase 1 — must also be migrated.
  .concat([
    "src/app/dashboard/chats/page.tsx",
    "src/app/dashboard/chats/[id]/page.tsx",
  ]);

let total = 0;
let touched = 0;

for (const file of files) {
  let original;
  try {
    original = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  let next = original;
  let local = 0;
  for (const [from, to] of MAP) {
    const before = next;
    next = next.split(from).join(to);
    if (before !== next) {
      const matches = before.split(from).length - 1;
      local += matches;
    }
  }
  if (next !== original) {
    writeFileSync(file, next, "utf8");
    touched++;
    total += local;
    console.log(`  ${file}  (${local} replacements)`);
  }
}

console.log("");
console.log(`✓ Migrated ${total} named-scale references across ${touched} files.`);
