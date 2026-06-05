#!/usr/bin/env node
// One-shot batch migrator: replaces hard-coded brand hex utilities with
// theme-aware semantic ones so light + dark surface scales actually flip.
//
// Why one atomic pass: surface (`bg-*`) and foreground (`text-*`) must
// migrate in lockstep, or mid-migration the page renders illegible
// (dark text on dark surface in light mode, vice versa). See §1.5 of the
// constitution — holistic over local.
//
// Run from repo root:  node scripts/theme-migrate.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

// ─── The mapping table — single source of truth ──────────────────────
// Surface and foreground entries are listed together for each
// abstraction layer so the lockstep intent is visible.

const MAP = [
  // ── Page / surface scale ──
  ["bg-[#0c0d16]", "bg-base"],
  ["bg-[#12141f]", "bg-surface"],
  ["bg-[#1a1d2e]", "bg-surface-raised"],
  ["bg-[#252840]", "bg-surface-raised"],
  ["bg-[#3a3f5c]", "bg-surface-raised"],
  ["bg-[#1F3050]", "bg-surface-raised"],
  ["bg-[#152339]", "bg-surface-raised"],

  // ── Borders ──
  ["border-[#252840]", "border-default"],
  ["border-[#3a3f5c]", "border-strong"],
  ["border-[#1F3050]", "border-default"],

  // ── Foreground / text — paired with the surfaces above ──
  ["text-[#e8eaf6]", "text-primary"],
  ["text-[#8895c4]", "text-secondary"],
  ["text-[#5a6399]", "text-muted"],
  ["text-[#3a3f5c]", "text-muted"],
  ["text-[#5F7290]", "text-muted"],

  // ── Brand foreground — contrast-aware swap ──
  // crimson-400 (#F75663) is bright crimson, legible on dark navy but
  // washed-out on white. `text-brand` resolves to crimson-400 in dark
  // mode and crimson-600 (#A91D24) in light, so contrast survives both.
  ["text-[#F75663]", "text-brand"],
  ["text-[#C8232C]", "text-brand"],
  // Same idea for arc cyan.
  ["text-[#7DDCE8]", "text-active-text"],

  // ── Brand fills that stay (mode-agnostic) ──
  // bg-[#C8232C] crimson fill — white-on-crimson works on both modes.
  // bg-[#A91D24] crimson hover — same.
  // border-[#C8232C], border-[#5EC8E0] — brand borders work on both.
];

// ─── Apply ───────────────────────────────────────────────────────────

const files = execSync(
  "git ls-files src -- '*.ts' '*.tsx'",
  { encoding: "utf8" }
)
  .split("\n")
  .filter(Boolean);

let totalReplacements = 0;
let touchedFiles = 0;

for (const file of files) {
  const original = readFileSync(file, "utf8");
  let next = original;
  let local = 0;
  for (const [from, to] of MAP) {
    // Plain literal replacement — Tailwind arbitrary values use bracket
    // syntax that has regex meaning, so we deliberately avoid regex here.
    const before = next;
    next = next.split(from).join(to);
    local += (before.length - next.length === 0 && before === next)
      ? 0
      : (before.match(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length;
  }
  if (next !== original) {
    writeFileSync(file, next, "utf8");
    touchedFiles++;
    totalReplacements += local;
    console.log(`  ${file}  (${local} replacements)`);
  }
}

console.log("");
console.log(`✓ Migrated ${totalReplacements} literals across ${touchedFiles} files.`);
